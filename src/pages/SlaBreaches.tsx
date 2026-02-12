import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSlaEvents } from "@/hooks/useReporting";
import { Loader2, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function SlaBreaches() {
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const { data: events = [], isLoading } = useSlaEvents({
    resolved: false,
    sla_type: slaFilter === "all" ? undefined : slaFilter,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="SLA Breaches" description="Active SLA violations requiring attention" />

      <div className="flex items-center gap-3 mb-4">
        <Select value={slaFilter} onValueChange={setSlaFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="NO_ACTIVITY">No Activity</SelectItem>
            <SelectItem value="TASK_OVERDUE">Task Overdue</SelectItem>
            <SelectItem value="TIME_IN_STAGE">Time in Stage</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{events.length} active breaches</span>
      </div>

      <div className="space-y-2">
        {events.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active SLA breaches. Great work!</p>
            </CardContent>
          </Card>
        )}

        {events.map((ev) => {
          const details = (ev.details || {}) as Record<string, any>;
          const age = formatDistanceToNow(new Date(ev.created_at), { addSuffix: true });

          return (
            <Card key={ev.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.severity === "breach" ? "destructive" : "secondary"} className="text-xs">
                      {ev.severity}
                    </Badge>
                    <span className="font-medium text-sm">{ev.sla_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {age}
                    </span>
                    {details.stage_name && <span>Stage: {details.stage_name}</span>}
                    {details.task_title && <span>Task: {details.task_title}</span>}
                    {details.threshold_hours && <span>Threshold: {details.threshold_hours}h</span>}
                    {details.threshold_days && <span>Threshold: {details.threshold_days}d</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/pipeline/opportunities/${ev.entity_id}`}>
                    <ExternalLink className="h-4 w-4 mr-1" /> View
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
