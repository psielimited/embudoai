import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, Clock3, Info } from "lucide-react";
import { useConversationTimeline } from "@/hooks/useReporting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConversationTimelineProps {
  conversationId?: string;
}

function severityIcon(severity: string | null) {
  switch (severity) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warn":
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function severityVariant(severity: string | null): "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "error":
      return "destructive";
    case "warn":
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

export function ConversationTimeline({ conversationId }: ConversationTimelineProps) {
  const { data: events = [], isLoading } = useConversationTimeline(conversationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversation Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading timeline...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={`${event.source_type}-${event.id}`} className="flex items-start gap-3">
                <div className="mt-0.5">{severityIcon(event.severity)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{event.event_type}</span>
                    <Badge variant={severityVariant(event.severity)} className="text-[10px] uppercase">
                      {event.severity ?? "info"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {event.source_type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {typeof event.metadata === "object" ? JSON.stringify(event.metadata) : String(event.metadata)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
