import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuditEvents(opportunityId?: string) {
  return useQuery({
    queryKey: ["audit-events", opportunityId],
    enabled: !!opportunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("*")
        .eq("opportunity_id", opportunityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
