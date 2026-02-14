import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId, getUserOrThrow } from "@/lib/auth";
import { callEdge } from "@/lib/edge";
import { useActiveOrg } from "@/hooks/useOrg";

export function useOpportunities(pipelineId?: string) {
  return useQuery({
    queryKey: ["opportunities", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,name,amount,status,stage_id,version,owner_user_id,expected_close_date,created_at,updated_at")
        .eq("pipeline_id", pipelineId!)
        .eq("status", "open");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opp: {
      name: string;
      pipeline_id: string;
      stage_id: string;
      amount?: number;
      expected_close_date?: string;
    }) => {
      const user = await getUserOrThrow();
      const orgId = await getActiveOrgId();
      const { data, error } = await supabase
        .from("opportunities")
        .insert({ ...opp, owner_user_id: user.id, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity-stats"] });
    },
  });
}

export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      opportunity_id: string;
      to_stage_id: string;
      expected_version: number;
    }) => callEdge("move-opportunity-stage", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity-stats"] });
    },
  });
}

export function useOpportunityStats(pipelineId?: string) {
  const { data: orgId } = useActiveOrg();

  return useQuery({
    queryKey: ["opportunity-stats", orgId ?? null, pipelineId ?? null],
    enabled: !!orgId,
    queryFn: async () => {
      let query = supabase
        .from("opportunities")
        .select("status,stage_id,updated_at")
        .eq("org_id", orgId!);

      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
      }

      const { data: opps, error } = await query;
      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);
      const movedToday = opps?.filter((o) => o.updated_at.slice(0, 10) === today).length ?? 0;
      const won = opps?.filter((o) => o.status === "won").length ?? 0;
      const lost = opps?.filter((o) => o.status === "lost").length ?? 0;
      const open = opps?.filter((o) => o.status === "open").length ?? 0;

      const byStageCounts: Record<string, number> = {};
      for (const o of opps ?? []) {
        if (o.status === "open") {
          byStageCounts[o.stage_id] = (byStageCounts[o.stage_id] || 0) + 1;
        }
      }

      return { movedToday, won, lost, open, byStageCounts };
    },
  });
}
