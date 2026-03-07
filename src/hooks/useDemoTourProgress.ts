import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/edge";

export type DemoTourStepId =
  | "dashboard"
  | "conversations"
  | "pipeline"
  | "merchant_settings"
  | "reports";

type DemoTourProgressResponse = {
  ok: boolean;
  action: "get_progress" | "complete_step" | "reset_progress";
  completed_steps: DemoTourStepId[];
  completed_at?: string | null;
};

export function useDemoTourProgress(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["demo-tour-progress"],
    enabled,
    queryFn: () =>
      callEdge<DemoTourProgressResponse>("demo-tour-progress", {
        action: "get_progress",
      }),
  });

  const completeStep = useMutation({
    mutationFn: (step: DemoTourStepId) =>
      callEdge<DemoTourProgressResponse>("demo-tour-progress", {
        action: "complete_step",
        step,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demo-tour-progress"] });
    },
  });

  const resetProgress = useMutation({
    mutationFn: () =>
      callEdge<DemoTourProgressResponse>("demo-tour-progress", {
        action: "reset_progress",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demo-tour-progress"] });
    },
  });

  return {
    query,
    completeStep,
    resetProgress,
  };
}

