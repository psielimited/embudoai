import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { usePipeline } from "@/hooks/usePipeline";
import { useOpportunities, useMoveOpportunityStage } from "@/hooks/useOpportunities";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CreateOpportunityDialog } from "@/components/CreateOpportunityDialog";
import { GateFailureModal } from "@/components/GateFailureModal";
import { CreateActivityDialog } from "@/components/CreateActivityDialog";
import { toast } from "sonner";

export default function PipelineBoard() {
  const navigate = useNavigate();
  const { data: pipelineData, isLoading } = usePipeline();
  const { data: opportunities = [] } = useOpportunities(pipelineData?.pipeline.id);
  const moveStage = useMoveOpportunityStage();

  const [createDialog, setCreateDialog] = useState<{ stageId: string; stageName: string } | null>(null);
  const [gateFailure, setGateFailure] = useState<{
    missingFields: string[];
    missingActivities: string[];
    opportunityId: string;
  } | null>(null);
  const [activityDialog, setActivityDialog] = useState<{
    opportunityId: string;
    defaultType?: string;
  } | null>(null);
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, oppId: string) => {
    setDraggedOppId(oppId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, toStageId: string) => {
      e.preventDefault();
      if (!draggedOppId) return;

      const opp = opportunities.find((o) => o.id === draggedOppId);
      if (!opp || opp.stage_id === toStageId) {
        setDraggedOppId(null);
        return;
      }

      try {
        await moveStage.mutateAsync({
          opportunity_id: opp.id,
          to_stage_id: toStageId,
          expected_version: opp.version,
        });
        toast.success("Stage updated");
      } catch (err: any) {
        if (err.status === 409 && err.data?.error_code === "STAGE_GATE_FAILED") {
          setGateFailure({
            missingFields: err.data.missing_fields || [],
            missingActivities: err.data.missing_activities || [],
            opportunityId: opp.id,
          });
        } else if (err.status === 409) {
          toast.error("Version conflict — board refreshed");
        } else {
          toast.error(err.message || "Failed to move");
        }
      }
      setDraggedOppId(null);
    },
    [draggedOppId, opportunities, moveStage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pipelineData) return null;
  const { pipeline, stages } = pipelineData;

  return (
    <>
      <PageHeader title={pipeline.name} description="Drag opportunities between stages" />

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
        {stages.map((stage) => {
          const stageOpps = opportunities.filter((o) => o.stage_id === stage.id);
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72 flex flex-col bg-muted/50 rounded-lg"
              onDrop={(e) => handleDrop(e, stage.id)}
              onDragOver={handleDragOver}
            >
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">{stage.name}</h3>
                  <span className="text-xs text-muted-foreground">{stageOpps.length}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setCreateDialog({ stageId: stage.id, stageName: stage.name })}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {stageOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onDragStart={handleDragStart}
                    onClick={() => navigate(`/pipeline/opportunities/${opp.id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {createDialog && (
        <CreateOpportunityDialog
          open
          onClose={() => setCreateDialog(null)}
          pipelineId={pipeline.id}
          stageId={createDialog.stageId}
          stageName={createDialog.stageName}
        />
      )}

      {gateFailure && (
        <GateFailureModal
          open
          onClose={() => setGateFailure(null)}
          missingFields={gateFailure.missingFields}
          missingActivities={gateFailure.missingActivities}
          onCreateActivity={(type) => {
            setActivityDialog({
              opportunityId: gateFailure.opportunityId,
              defaultType: type,
            });
            setGateFailure(null);
          }}
        />
      )}

      {activityDialog && (
        <CreateActivityDialog
          open
          onClose={() => setActivityDialog(null)}
          opportunityId={activityDialog.opportunityId}
          defaultType={activityDialog.defaultType}
        />
      )}
    </>
  );
}
