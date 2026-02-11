import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useActivities } from "@/hooks/useActivities";
import { useTasks, useCompleteTask } from "@/hooks/useTasks";
import { useAuditEvents } from "@/hooks/useAuditEvents";
import { usePipeline } from "@/hooks/usePipeline";
import { CreateActivityDialog } from "@/components/CreateActivityDialog";
import { Loader2, ArrowLeft, CheckCircle2, Clock, FileText } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function OpportunityDetail() {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  const [activityOpen, setActivityOpen] = useState(false);

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    enabled: !!opportunityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", opportunityId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: pipelineData } = usePipeline();
  const { data: activities = [] } = useActivities(opportunityId);
  const { data: tasks = [] } = useTasks(opportunityId);
  const { data: auditEvents = [] } = useAuditEvents(opportunityId);
  const completeTask = useCompleteTask();

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!opp) return <p>Not found</p>;

  const stageName = pipelineData?.stages.find((s) => s.id === opp.stage_id)?.name ?? "Unknown";

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pipeline")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pipeline
        </Button>
      </div>

      <PageHeader title={opp.name} description={`Stage: ${stageName} · Version ${opp.version}`} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Key Fields */}
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{opp.status}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{opp.amount != null ? `$${Number(opp.amount).toLocaleString()}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expected Close</span><span>{opp.expected_close_date || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>{opp.version}</span></div>
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Activities</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}>Log Activity</Button>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <Badge variant="secondary" className="capitalize text-xs">{a.activity_type}</Badge>
                    <div>
                      <p>{a.description || <span className="text-muted-foreground italic">No description</span>}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tasks</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {t.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={t.completed ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                    </div>
                    {!t.completed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={completeTask.isPending}
                        onClick={() => completeTask.mutate({ id: t.id, opportunity_id: opp.id })}
                      >
                        Complete
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Audit History</CardTitle></CardHeader>
          <CardContent>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map((ev) => {
                  const diff = ev.diff as any;
                  const fromStage = pipelineData?.stages.find((s) => s.id === diff?.from_stage_id)?.name ?? diff?.from_stage_id;
                  const toStage = pipelineData?.stages.find((s) => s.id === diff?.to_stage_id)?.name ?? diff?.to_stage_id;
                  return (
                    <li key={ev.id} className="text-sm border-l-2 border-primary/30 pl-3">
                      <p className="font-medium capitalize">{ev.event_type.replace(/_/g, " ")}</p>
                      {diff?.from_stage_id && (
                        <p className="text-muted-foreground">{fromStage} → {toStage}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{format(new Date(ev.created_at), "MMM d, HH:mm")}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {activityOpen && (
        <CreateActivityDialog
          open
          onClose={() => setActivityOpen(false)}
          opportunityId={opp.id}
        />
      )}
    </>
  );
}
