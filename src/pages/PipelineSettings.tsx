import { useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useCreateStage,
  useDeleteStage,
  usePipeline,
  useReorderStages,
  useUpdateStage,
  useUpsertStageGate,
} from "@/hooks/usePipeline";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type StageRow = Database["public"]["Tables"]["stages"]["Row"];
type StageGateRow = Database["public"]["Tables"]["stage_gates"]["Row"];

function toCsv(values: string[]) {
  return values.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PipelineSettings() {
  const { data: pipelineData, isLoading } = usePipeline();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const reorderStages = useReorderStages();
  const deleteStage = useDeleteStage();
  const upsertStageGate = useUpsertStageGate();

  const [createOpen, setCreateOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [orderedStages, setOrderedStages] = useState<StageRow[]>([]);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [stageEdits, setStageEdits] = useState<
    Record<string, { name: string; requiredFields: string; requiredActivityTypes: string; maxDaysInStage: string }>
  >({});

  useEffect(() => {
    if (!pipelineData) return;
    setOrderedStages(pipelineData.stages);
  }, [pipelineData]);

  useEffect(() => {
    if (!pipelineData) return;
    const next: Record<string, { name: string; requiredFields: string; requiredActivityTypes: string; maxDaysInStage: string }> = {};
    for (const stage of pipelineData.stages) {
      const gate = pipelineData.gates.find((item) => item.stage_id === stage.id);
      next[stage.id] = {
        name: stage.name,
        requiredFields: toCsv(gate?.required_fields ?? []),
        requiredActivityTypes: toCsv(gate?.required_activity_types ?? []),
        maxDaysInStage: gate?.max_days_in_stage ? String(gate.max_days_in_stage) : "",
      };
    }
    setStageEdits(next);
  }, [pipelineData]);

  const gateByStageId = useMemo(() => {
    const map = new Map<string, StageGateRow>();
    for (const gate of pipelineData?.gates ?? []) map.set(gate.stage_id, gate);
    return map;
  }, [pipelineData?.gates]);

  const handleCreateStage = async () => {
    if (!pipelineData || !newStageName.trim()) return;
    try {
      await createStage.mutateAsync({ pipelineId: pipelineData.pipeline.id, name: newStageName.trim() });
      toast.success("Stage created");
      setCreateOpen(false);
      setNewStageName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to create stage");
    }
  };

  const handleSaveStage = async (stageId: string) => {
    const edits = stageEdits[stageId];
    if (!edits) return;
    const parsedDays = edits.maxDaysInStage.trim() ? Number(edits.maxDaysInStage) : null;
    if (parsedDays !== null && (!Number.isInteger(parsedDays) || parsedDays <= 0)) {
      toast.error("Stage SLA days must be a positive whole number");
      return;
    }

    try {
      await Promise.all([
        updateStage.mutateAsync({ id: stageId, name: edits.name }),
        upsertStageGate.mutateAsync({
          stageId,
          requiredFields: parseCsv(edits.requiredFields),
          requiredActivityTypes: parseCsv(edits.requiredActivityTypes),
          maxDaysInStage: parsedDays,
        }),
      ]);
      toast.success("Stage settings saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save stage settings");
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    try {
      await deleteStage.mutateAsync({ stageId });
      toast.success("Stage deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete stage");
    }
  };

  const handleDragStart = (stageId: string) => {
    setDraggedStageId(stageId);
  };

  const handleDrop = async (targetStageId: string) => {
    if (!draggedStageId || draggedStageId === targetStageId) {
      setDraggedStageId(null);
      return;
    }
    const sourceIndex = orderedStages.findIndex((stage) => stage.id === draggedStageId);
    const targetIndex = orderedStages.findIndex((stage) => stage.id === targetStageId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedStageId(null);
      return;
    }

    const next = [...orderedStages];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setOrderedStages(next.map((stage, index) => ({ ...stage, position: index })));
    setDraggedStageId(null);

    try {
      await reorderStages.mutateAsync({ orderedIds: next.map((stage) => stage.id) });
      toast.success("Stage order updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update stage order");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pipelineData) return null;

  return (
    <>
      <PageHeader
        title="Pipeline Settings"
        description="Manage stages, gate criteria, and stage-level SLA thresholds"
        breadcrumbs={[
          { label: "Pipeline", href: "/pipeline" },
          { label: "Settings" },
        ]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Stage
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{pipelineData.pipeline.name}</CardTitle>
          <CardDescription>Drag stages to reorder. Save each stage after editing gate criteria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderedStages.map((stage) => {
            const edits = stageEdits[stage.id];
            const gate = gateByStageId.get(stage.id);
            return (
              <div
                key={stage.id}
                className="rounded-lg border p-3 space-y-3 bg-card"
                draggable
                onDragStart={() => handleDragStart(stage.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(stage.id)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label htmlFor={`name-${stage.id}`}>Stage Name</Label>
                    <Input
                      id={`name-${stage.id}`}
                      value={edits?.name ?? stage.name}
                      onChange={(event) =>
                        setStageEdits((current) => ({
                          ...current,
                          [stage.id]: {
                            ...(current[stage.id] ?? {
                              name: stage.name,
                              requiredFields: toCsv(gate?.required_fields ?? []),
                              requiredActivityTypes: toCsv(gate?.required_activity_types ?? []),
                              maxDaysInStage: gate?.max_days_in_stage ? String(gate.max_days_in_stage) : "",
                            }),
                            name: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete stage {stage.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone. Stages with open opportunities cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => void handleDeleteStage(stage.id)}
                        >
                          Delete Stage
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`fields-${stage.id}`}>Required Fields</Label>
                    <Input
                      id={`fields-${stage.id}`}
                      value={edits?.requiredFields ?? ""}
                      onChange={(event) =>
                        setStageEdits((current) => ({
                          ...current,
                          [stage.id]: {
                            ...(current[stage.id] ?? {
                              name: stage.name,
                              requiredFields: "",
                              requiredActivityTypes: "",
                              maxDaysInStage: "",
                            }),
                            requiredFields: event.target.value,
                          },
                        }))
                      }
                      placeholder="amount, expected_close_date"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`activities-${stage.id}`}>Required Activity Types</Label>
                    <Input
                      id={`activities-${stage.id}`}
                      value={edits?.requiredActivityTypes ?? ""}
                      onChange={(event) =>
                        setStageEdits((current) => ({
                          ...current,
                          [stage.id]: {
                            ...(current[stage.id] ?? {
                              name: stage.name,
                              requiredFields: "",
                              requiredActivityTypes: "",
                              maxDaysInStage: "",
                            }),
                            requiredActivityTypes: event.target.value,
                          },
                        }))
                      }
                      placeholder="call, meeting"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`sla-${stage.id}`}>Stage SLA (days, optional)</Label>
                    <Input
                      id={`sla-${stage.id}`}
                      type="number"
                      min={1}
                      value={edits?.maxDaysInStage ?? ""}
                      onChange={(event) =>
                        setStageEdits((current) => ({
                          ...current,
                          [stage.id]: {
                            ...(current[stage.id] ?? {
                              name: stage.name,
                              requiredFields: "",
                              requiredActivityTypes: "",
                              maxDaysInStage: "",
                            }),
                            maxDaysInStage: event.target.value,
                          },
                        }))
                      }
                      placeholder="14"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handleSaveStage(stage.id)}
                    disabled={updateStage.isPending || upsertStageGate.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" /> Save Stage
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-stage-name">Stage Name</Label>
            <Input
              id="new-stage-name"
              value={newStageName}
              onChange={(event) => setNewStageName(event.target.value)}
              placeholder="Proposal"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateStage()} disabled={!newStageName.trim() || createStage.isPending}>
              {createStage.isPending ? "Adding..." : "Add Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
