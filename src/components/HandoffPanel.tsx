import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bot, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAcknowledgeHandoff, useConversationHandoff, useConversationSuggestions, useGenerateSuggestions, useMarkSuggestionUsed, useResolveHandoff } from "@/hooks/useHandoffs";
import { toast } from "sonner";

type Props = {
  conversationId?: string;
  onUseReply: (text: string) => void;
  onSendReply: (text: string, suggestionId?: string) => Promise<void>;
};

export function HandoffPanel({ conversationId, onUseReply, onSendReply }: Props) {
  const { data: handoff, isLoading: handoffLoading } = useConversationHandoff(conversationId);
  const { data: suggestion, isLoading: suggestionLoading } = useConversationSuggestions(conversationId);
  const ackMutation = useAcknowledgeHandoff(conversationId);
  const resolveMutation = useResolveHandoff(conversationId);
  const generateMutation = useGenerateSuggestions(conversationId);
  const markSuggestionUsed = useMarkSuggestionUsed(conversationId);

  if (!conversationId) return null;
  if (!handoff && !handoffLoading) return null;

  const packet = (handoff?.packet ?? {}) as Record<string, unknown>;
  const extracted = (packet.extracted ?? {}) as Record<string, unknown>;
  const replies = ((suggestion?.suggestions as Record<string, unknown> | undefined)?.replies ?? []) as Array<Record<string, unknown>>;
  const nextSteps = ((suggestion?.suggestions as Record<string, unknown> | undefined)?.next_steps ?? []) as Array<Record<string, unknown>>;
  const risks = ((suggestion?.suggestions as Record<string, unknown> | undefined)?.risks ?? []) as string[];
  const questions = ((suggestion?.suggestions as Record<string, unknown> | undefined)?.questions ?? []) as string[];

  return (
    <Card className="border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Human Handoff
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {handoffLoading ? (
          <p className="text-sm text-muted-foreground">Loading handoff details...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{handoff?.reason_code ?? "unknown"}</Badge>
              <Badge variant="outline">{handoff?.status ?? "open"}</Badge>
              {handoff?.created_at && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
            {handoff?.reason_text && <p className="text-sm">{handoff.reason_text}</p>}
            {typeof packet.customer_summary === "string" && (
              <div className="rounded-md border p-3 text-sm">{packet.customer_summary}</div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {extracted.intent && <Badge variant="outline">intent: {String(extracted.intent)}</Badge>}
              {typeof extracted.lead_score !== "undefined" && (
                <Badge variant="outline">score: {String(extracted.lead_score)}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!handoff || handoff.status !== "open" || ackMutation.isPending}
                onClick={() => handoff && ackMutation.mutate(handoff.id)}
              >
                Acknowledge
              </Button>
              <Button
                size="sm"
                disabled={!handoff || resolveMutation.isPending}
                onClick={() => handoff && resolveMutation.mutate(handoff.id)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Resolve & Resume Automation
              </Button>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Suggested Replies
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate({ handoffId: handoff?.id })}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {generateMutation.isPending ? "Generating..." : "Generate suggestions"}
            </Button>
          </div>

          {suggestionLoading ? (
            <p className="text-sm text-muted-foreground">Loading suggestions...</p>
          ) : replies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active suggestions yet.</p>
          ) : (
            <div className="space-y-2">
              {replies.map((reply, idx) => {
                const text = String(reply.text ?? "").trim();
                if (!text) return null;
                return (
                  <div key={`${suggestion?.id}-${idx}`} className="rounded-md border p-3 space-y-2">
                    <p className="text-sm">{text}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onUseReply(text)}>
                        Use reply
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await onSendReply(text, suggestion?.id);
                          if (suggestion?.id) {
                            await markSuggestionUsed.mutateAsync(suggestion.id);
                            toast.success("Suggestion marked as used");
                          }
                        }}
                      >
                        Send now
                      </Button>
                      {reply.tone && <Badge variant="outline">{String(reply.tone)}</Badge>}
                      {reply.intent && <Badge variant="outline">{String(reply.intent)}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {nextSteps.length > 0 && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Next steps</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {nextSteps.map((step, idx) => (
                  <li key={`step-${idx}`} className="rounded border p-2">
                    <p className="font-medium">{String(step.title ?? "Step")}</p>
                    <p className="text-muted-foreground">{String(step.details ?? "")}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {(risks.length > 0 || questions.length > 0) && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Risks & open questions</summary>
              {risks.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">Risks</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {risks.map((risk, idx) => <li key={`risk-${idx}`}>{risk}</li>)}
                  </ul>
                </div>
              )}
              {questions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">Questions</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {questions.map((q, idx) => <li key={`q-${idx}`}>{q}</li>)}
                  </ul>
                </div>
              )}
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
