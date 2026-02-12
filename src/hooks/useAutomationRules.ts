import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getActiveOrgId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase.from("profiles").select("active_org_id").eq("user_id", user.id).single();
  if (!data?.active_org_id) throw new Error("No active org");
  return data.active_org_id;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  conditions: Record<string, any>;
  actions: Array<{
    type: "create_task" | "assign_owner";
    title?: string;
    due_in_hours?: number;
    assigned_to?: string;
    user_id?: string;
  }>;
  is_active: boolean;
  created_at: string;
}

export function useAutomationRules() {
  return useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AutomationRule[];
    },
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: {
      name: string;
      trigger_type: string;
      conditions: Record<string, any>;
      actions: any[];
    }) => {
      const orgId = await getActiveOrgId();
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({ ...rule, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}
