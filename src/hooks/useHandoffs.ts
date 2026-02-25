import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callEdge } from "@/lib/edge";
import type { ConversationHandoff, ConversationSuggestion } from "@/types/database";

export function useConversationHandoff(conversationId?: string) {
  return useQuery({
    queryKey: ["conversation-handoff", conversationId ?? null],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversation_handoffs")
        .select("*")
        .eq("conversation_id", conversationId)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as ConversationHandoff | null;
    },
  });
}

export function useConversationSuggestions(conversationId?: string) {
  return useQuery({
    queryKey: ["conversation-suggestions", conversationId ?? null],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversation_suggestions")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as ConversationSuggestion | null;
    },
  });
}

export function useAcknowledgeHandoff(conversationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (handoffId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: handoff } = await (supabase as any)
        .from("conversation_handoffs")
        .select("id,org_id,merchant_id,conversation_id")
        .eq("id", handoffId)
        .maybeSingle();
      const { error } = await (supabase as any)
        .from("conversation_handoffs")
        .update({
          status: "acknowledged",
          acknowledged_by_user_id: user?.id ?? null,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", handoffId);
      if (error) throw error;

      if (handoff) {
        await (supabase as any).from("channel_events").insert({
          org_id: handoff.org_id,
          merchant_id: handoff.merchant_id,
          channel: "whatsapp",
          provider: "meta",
          event_type: "handoff_acknowledged",
          provider_event_id: `handoff_ack_${handoff.conversation_id}_${Date.now()}`,
          external_contact: null,
          severity: "info",
          payload: { handoff_id: handoffId, user_id: user?.id ?? null },
        }).then(() => undefined).catch(() => undefined);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["conversation-handoff", conversationId ?? null] });
      await qc.invalidateQueries({ queryKey: ["conversation-timeline", conversationId ?? null] });
    },
  });
}

export function useResolveHandoff(conversationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (handoffId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: handoff } = await (supabase as any)
        .from("conversation_handoffs")
        .select("id,org_id,merchant_id,conversation_id")
        .eq("id", handoffId)
        .maybeSingle();

      const { error: handoffErr } = await (supabase as any)
        .from("conversation_handoffs")
        .update({
          status: "resolved",
          resolved_by_user_id: user?.id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", handoffId);
      if (handoffErr) throw handoffErr;

      if (conversationId) {
        const { error: convErr } = await supabase
          .from("conversations")
          .update({
            status: "open",
            handoff_active: false,
            handoff_reason_code: null,
            handoff_reason_text: null,
            ai_paused: false,
          } as any)
          .eq("id", conversationId);
        if (convErr) throw convErr;
      }

      if (handoff) {
        await (supabase as any).from("channel_events").insert({
          org_id: handoff.org_id,
          merchant_id: handoff.merchant_id,
          channel: "whatsapp",
          provider: "meta",
          event_type: "handoff_resolved",
          provider_event_id: `handoff_resolved_${handoff.conversation_id}_${Date.now()}`,
          external_contact: null,
          severity: "info",
          payload: { handoff_id: handoffId, user_id: user?.id ?? null },
        }).then(() => undefined).catch(() => undefined);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["conversation-handoff", conversationId ?? null] });
      await qc.invalidateQueries({ queryKey: ["conversation", conversationId ?? null] });
      await qc.invalidateQueries({ queryKey: ["conversation-timeline", conversationId ?? null] });
    },
  });
}

export function useGenerateSuggestions(conversationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { handoffId?: string; reasonCode?: string; reasonText?: string }) => {
      if (!conversationId) throw new Error("conversationId is required");
      return await callEdge<{ ok: boolean; suggestion_id: string }>("ai-handoff-assist", {
        conversation_id: conversationId,
        handoff_id: params?.handoffId ?? null,
        trigger: "manual",
        reason_code: params?.reasonCode ?? "manual_request",
        reason_text: params?.reasonText ?? "Manual suggestion generation",
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["conversation-suggestions", conversationId ?? null] });
    },
  });
}

export function useMarkSuggestionUsed(conversationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await (supabase as any)
        .from("conversation_suggestions")
        .update({ status: "used" })
        .eq("id", suggestionId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["conversation-suggestions", conversationId ?? null] });
    },
  });
}
