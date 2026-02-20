import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AiAgentAction, AiAgentRun } from "@/types/database";

export function useAgentRuns(conversationId?: string) {
  return useQuery({
    queryKey: ["ai-agent-runs", conversationId ?? null],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_agent_runs")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as AiAgentRun[];
    },
  });
}

export function useAgentActions(runId?: string) {
  return useQuery({
    queryKey: ["ai-agent-actions", runId ?? null],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_agent_actions")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiAgentAction[];
    },
  });
}
