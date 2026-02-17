import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMerchants } from "@/hooks/useMerchants";
import { useOpsTimelineErrors } from "@/hooks/useReporting";

export default function OpsConsole() {
  const [severity, setSeverity] = useState("error");
  const [functionName, setFunctionName] = useState("all");
  const [merchantId, setMerchantId] = useState("all");

  const { data: merchants = [] } = useMerchants();
  const { data: events = [], isLoading } = useOpsTimelineErrors({
    severity,
    functionName,
    merchantId,
  });

  return (
    <>
      <PageHeader
        title="Ops Console"
        description="Operational error stream across messaging, callbacks, and automation"
        breadcrumbs={[{ label: "Ops Console" }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="all">All severities</SelectItem>
          </SelectContent>
        </Select>

        <Select value={functionName} onValueChange={setFunctionName}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Function" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All functions</SelectItem>
            <SelectItem value="send-whatsapp-message">send-whatsapp-message</SelectItem>
            <SelectItem value="whatsapp-webhook">whatsapp-webhook</SelectItem>
            <SelectItem value="ingest-message">ingest-message</SelectItem>
            <SelectItem value="outbound-worker">outbound-worker</SelectItem>
          </SelectContent>
        </Select>

        <Select value={merchantId} onValueChange={setMerchantId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Merchant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All merchants</SelectItem>
            {merchants.map((merchant) => (
              <SelectItem key={merchant.id} value={merchant.id}>
                {merchant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">{events.length} events</span>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading ops events...</CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">No events for the selected filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card key={`${event.source_type}-${event.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{event.event_type}</span>
                      <Badge variant="destructive" className="text-[10px] uppercase">
                        {event.severity ?? "error"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {event.source_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground break-all">
                      {typeof event.metadata === "object" ? JSON.stringify(event.metadata) : String(event.metadata)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
