import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId, getUserOrThrow } from "@/lib/auth";
import { callEdge } from "@/lib/edge";

export function useOpportunities(pipelineId?: string) {
  return useQuery({
    queryKey: ["opportunities", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("pipeline_id", pipelineId!);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}
