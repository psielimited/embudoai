import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type StageRow = Database["public"]["Tables"]["stages"]["Row"];
type StageGateRow = Database["public"]["Tables"]["stage_gates"]["Row"];
type PipelineRow = Database["public"]["Tables"]["pipelines"]["Row"];

type PipelineData = {
  pipeline: PipelineRow;
  stages: StageRow[];
  gates: StageGateRow[];
};

function normalizeStages(stages: StageRow[]) {
  return [...stages].sort((a, b) => a.position - b.position);
}

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline-default"],
    queryFn: async () => {
      const orgId = await getActiveOrgId();

      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .select("*")
        .eq("is_default", true)
        .eq("org_id", orgId)
        .single();
      if (pErr) throw pErr;

      const { data: stages, error: sErr } = await supabase
        .from("stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .eq("org_id", orgId)
        .order("position");
      if (sErr) throw sErr;

      const stageIds = (stages ?? []).map((stage) => stage.id);
      const { data: gates, error: gErr } = await supabase
        .from("stage_gates")
        .select("*")
        .eq("org_id", orgId)
        .in("stage_id", stageIds.length > 0 ? stageIds : ["00000000-0000-0000-0000-000000000000"]);
      if (gErr) throw gErr;

      return { pipeline, stages: stages ?? [], gates: gates ?? [] } as PipelineData;
    },
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, name }: { pipelineId: string; name: string }) => {
      const orgId = await getActiveOrgId();
      const { data: existing, error: existingErr } = await supabase
        .from("stages")
        .select("position")
        .eq("pipeline_id", pipelineId)
        .eq("org_id", orgId)
        .order("position", { ascending: false })
        .limit(1);
      if (existingErr) throw existingErr;

      const nextPosition = (existing?.[0]?.position ?? -1) + 1;
      const { data, error } = await supabase
        .from("stages")
        .insert({
          org_id: orgId,
          pipeline_id: pipelineId,
          name: name.trim(),
          position: nextPosition,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as StageRow;
    },
    onSuccess: (stage) => {
      qc.setQueryData<PipelineData>(["pipeline-default"], (current) => {
        if (!current) return current;
        return {
          ...current,
          stages: normalizeStages([...current.stages, stage]),
        };
      });
      qc.invalidateQueries({ queryKey: ["pipeline-default"] });
    },
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from("stages")
        .update({ name: name.trim() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as StageRow;
    },
    onSuccess: (stage) => {
      qc.setQueryData<PipelineData>(["pipeline-default"], (current) => {
        if (!current) return current;
        return {
          ...current,
          stages: current.stages.map((item) => (item.id === stage.id ? stage : item)),
        };
      });
      qc.invalidateQueries({ queryKey: ["pipeline-default"] });
    },
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      const updates = orderedIds.map((id, index) => ({ id, position: index }));
      for (const update of updates) {
        const { error } = await supabase.from("stages").update({ position: update.position }).eq("id", update.id);
        if (error) throw error;
      }
      return updates;
    },
    onMutate: async ({ orderedIds }) => {
      const previous = qc.getQueryData<PipelineData>(["pipeline-default"]);
      qc.setQueryData<PipelineData>(["pipeline-default"], (current) => {
        if (!current) return current;
        const byId = new Map(current.stages.map((stage) => [stage.id, stage]));
        return {
          ...current,
          stages: orderedIds
            .map((id, index) => {
              const stage = byId.get(id);
              if (!stage) return null;
              return { ...stage, position: index };
            })
            .filter(Boolean) as StageRow[],
        };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["pipeline-default"], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-default"] });
    },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId }: { stageId: string }) => {
      const { count, error: countError } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", stageId)
        .eq("status", "open");
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error("Cannot delete a stage with open opportunities");
      }

      const { error } = await supabase.from("stages").delete().eq("id", stageId);
      if (error) throw error;
      return stageId;
    },
    onSuccess: (stageId) => {
      qc.setQueryData<PipelineData>(["pipeline-default"], (current) => {
        if (!current) return current;
        return {
          ...current,
          stages: current.stages.filter((stage) => stage.id !== stageId),
          gates: current.gates.filter((gate) => gate.stage_id !== stageId),
        };
      });
      qc.invalidateQueries({ queryKey: ["pipeline-default"] });
    },
  });
}

export function useUpsertStageGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      stageId: string;
      requiredFields: string[];
      requiredActivityTypes: string[];
      maxDaysInStage: number | null;
    }) => {
      const orgId = await getActiveOrgId();
      const { data: existing, error: existingError } = await supabase
        .from("stage_gates")
        .select("id")
        .eq("stage_id", params.stageId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (existingError) throw existingError;

      const payload: Record<string, any> = {
        stage_id: params.stageId,
        org_id: orgId,
        required_fields: params.requiredFields,
        required_activity_types: params.requiredActivityTypes,
        max_days_in_stage: params.maxDaysInStage,
      };

      if ((existing ?? []).length > 0) {
        const { data, error } = await supabase
          .from("stage_gates")
          .update(payload as any)
          .eq("id", existing![0].id)
          .select("*")
          .single();
        if (error) throw error;
        return data as StageGateRow;
      }

      const { data, error } = await supabase.from("stage_gates").insert(payload as any).select("*").single();
      if (error) throw error;
      return data as StageGateRow;
    },
    onSuccess: (gate) => {
      qc.setQueryData<PipelineData>(["pipeline-default"], (current) => {
        if (!current) return current;
        const without = current.gates.filter((item) => item.stage_id !== gate.stage_id);
        return { ...current, gates: [...without, gate] };
      });
      qc.invalidateQueries({ queryKey: ["pipeline-default"] });
    },
  });
}
