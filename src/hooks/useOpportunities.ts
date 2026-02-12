import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getActiveOrgId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", user.id)
    .single();
  if (!data?.active_org_id) throw new Error("No active org");
  return data.active_org_id;
}

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
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
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/move-opportunity-stage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(params),
        }
      );

      const result = await resp.json();
      if (!resp.ok) {
        const err = new Error(result.error_code || result.error || "Move failed");
        (err as any).data = result;
        (err as any).status = resp.status;
        throw err;
      }
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}
