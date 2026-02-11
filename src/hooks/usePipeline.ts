import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline-default"],
    queryFn: async () => {
      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .select("*")
        .eq("is_default", true)
        .single();
      if (pErr) throw pErr;

      const { data: stages, error: sErr } = await supabase
        .from("stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("position");
      if (sErr) throw sErr;

      const { data: gates, error: gErr } = await supabase
        .from("stage_gates")
        .select("*");
      if (gErr) throw gErr;

      return { pipeline, stages: stages ?? [], gates: gates ?? [] };
    },
  });
}
