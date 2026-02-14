import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Conversation } from "@/types/database";
import { callEdge } from "@/lib/edge";

interface ConversationWorkflowProps {
  conversation: Conversation;
}

export function ConversationWorkflow({ conversation }: ConversationWorkflowProps) {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const callAssign = async (updates: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const data = await callEdge<{ ok?: boolean; error?: string }>("assign-conversation", {
        conversation_id: conversation.id,
        ...updates,
      });

      if (data.ok) {
        toast.success("Conversation updated");
        queryClient.invalidateQueries({ queryKey: ["conversation", conversation.id] });
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Network error");
    } finally {
      setUpdating(false);
    }
  };

  // SLA indicator
  const hasSlaRisk = conversation.last_inbound_at && (
    !conversation.last_outbound_at ||
    new Date(conversation.last_outbound_at) < new Date(conversation.last_inbound_at)
  );
  const waitingMinutes = hasSlaRisk && conversation.last_inbound_at
    ? Math.round((Date.now() - new Date(conversation.last_inbound_at).getTime()) / 60000)
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {/* Status */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select
          value={conversation.status}
          onValueChange={(v) => callAssign({ status: v })}
          disabled={updating}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="waiting_on_customer">Waiting on Customer</SelectItem>
            <SelectItem value="needs_handoff">Needs Handoff</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Priority</Label>
        <Select
          value={conversation.priority}
          onValueChange={(v) => callAssign({ priority: v })}
          disabled={updating}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI Pause toggle */}
      <div className="flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground">AI</Label>
        <Switch
          checked={!conversation.ai_paused && conversation.ai_enabled}
          onCheckedChange={(checked) => callAssign({ ai_paused: !checked })}
          disabled={updating || !conversation.ai_enabled}
        />
        {conversation.ai_paused && (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
            Paused
          </Badge>
        )}
      </div>

      {/* SLA indicator */}
      {hasSlaRisk && waitingMinutes > 0 && (
        <div className="flex items-center gap-1.5">
          {waitingMinutes > 30 ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className={`text-xs font-medium ${waitingMinutes > 30 ? "text-destructive" : "text-amber-600"}`}>
            {waitingMinutes}m awaiting reply
          </span>
        </div>
      )}
    </div>
  );
}
