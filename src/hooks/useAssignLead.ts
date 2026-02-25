import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type LeadStage = Database["public"]["Enums"]["lead_stage"];

export function useAssignLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { leadId: string; assigneeUserId: string | null }) => {
      if (!user) throw new Error("You must be signed in");

      const timestamp = new Date().toISOString();

      const { error: leadError } = await supabase
        .from("leads")
        .update({
          assignee_user_id: params.assigneeUserId,
          assigned_at: params.assigneeUserId ? timestamp : null,
          assigned_by_user_id: params.assigneeUserId ? user.id : null,
        })
        .eq("id", params.leadId);

      if (leadError) throw leadError;

      const { error: conversationError } = await supabase
        .from("conversations")
        .update({ assignee_user_id: params.assigneeUserId })
        .eq("lead_id", params.leadId);

      if (conversationError) throw conversationError;

      return { ok: true };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-by-lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
  });
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { leadId: string; leadStage: LeadStage }) => {
      const { error } = await supabase
        .from("leads")
        .update({ lead_stage: params.leadStage })
        .eq("id", params.leadId);

      if (error) throw error;
      return { ok: true };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-by-lead", variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
  });
}
