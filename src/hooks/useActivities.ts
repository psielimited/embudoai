import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId, getUserOrThrow } from "@/lib/auth";

export function useActivities(opportunityId?: string) {
  return useQuery({
    queryKey: ["activities", opportunityId],
    enabled: !!opportunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("entity_type", "opportunity")
        .eq("entity_id", opportunityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entity_id: string;
      activity_type: string;
      description?: string;
    }) => {
      const user = await getUserOrThrow();
      const orgId = await getActiveOrgId();
      const { data, error } = await supabase
        .from("activities")
        .insert({
          entity_type: "opportunity",
          entity_id: params.entity_id,
          activity_type: params.activity_type,
          description: params.description || null,
          created_by: user.id,
          org_id: orgId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["activities", vars.entity_id] });
    },
  });
}
