import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, CircleDot, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAgentActions, useAgentRuns } from "@/hooks/useAgentRuns";
import type { AiAgentRun } from "@/types/database";

function RunStatusBadge({ status }: { status: AiAgentRun["status"] }) {
  if (status === "completed") return <Badge variant="secondary">completed</Badge>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;
  if (status === "skipped") return <Badge variant="outline">skipped</Badge>;
  return <Badge variant="outline">started</Badge>;
}

function ActionStatusIcon({ status }: { status: "pending" | "executed" | "failed" | "skipped" }) {
  if (status === "executed") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "skipped") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <CircleDot className="h-4 w-4 text-muted-foreground" />;
}

function AgentActions({ runId }: { runId: string }) {
  const { data: actions = [], isLoading } = useAgentActions(runId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading actions...</p>;
  if (actions.length === 0) return <p className="text-sm text-muted-foreground">No actions recorded.</p>;

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <div key={action.id} className="rounded-md border p-2 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <ActionStatusIcon status={action.status} />
            <span className="font-medium">{action.action_type}</span>
            <Badge variant="outline" className="ml-auto">{action.status}</Badge>
          </div>
          {action.error && <p className="text-xs text-destructive">{action.error}</p>}
          <p className="text-xs text-muted-foreground break-words">{JSON.stringify(action.payload)}</p>
        </div>
      ))}
    </div>
  );
}

export function AgentRunPanel({ conversationId }: { conversationId?: string }) {
  const { data: runs = [], isLoading } = useAgentRuns(conversationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading agent runs...</p>}
        {!isLoading && runs.length === 0 && (
          <p className="text-sm text-muted-foreground">No agent runs yet.</p>
        )}
        {runs.map((run) => {
          const extracted = (run.output?.extracted ?? {}) as Record<string, unknown>;
          const intent = String(extracted.intent ?? "unknown");
          const leadScore = Number(extracted.lead_score ?? 0);
          const entities = extracted.entities ?? {};

          return (
            <details key={run.id} className="rounded-md border p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <RunStatusBadge status={run.status} />
                  <Badge variant="outline">{run.model}</Badge>
                  <Badge variant="outline">intent: {intent}</Badge>
                  <Badge variant="outline">score: {leadScore}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </span>
                </div>
              </summary>
              <Separator className="my-3" />
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium mb-1">Entities</p>
                  <p className="text-xs text-muted-foreground break-words">{JSON.stringify(entities)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Actions</p>
                  <AgentActions runId={run.id} />
                </div>
                {run.error && <p className="text-xs text-destructive">{run.error}</p>}
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}
