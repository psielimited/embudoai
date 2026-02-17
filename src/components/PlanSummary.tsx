import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrgSubscriptionRow } from "@/hooks/useOrg";

interface PlanSummaryProps {
  subscription: OrgSubscriptionRow | null | undefined;
  trialDaysRemaining: number | null;
  overQuota: boolean;
  showUpgradeCta: boolean;
}

export function PlanSummary({ subscription, trialDaysRemaining, overQuota, showUpgradeCta }: PlanSummaryProps) {
  const plan = subscription?.subscription_plans;
  const messageLimit = plan?.message_limit ?? 0;
  const messagesUsed = subscription?.messages_used ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Plan Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plan</span>
          <Badge variant="outline">{plan?.name ?? "Unknown"}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subscription Status</span>
          <Badge variant={subscription?.status === "active" ? "secondary" : "outline"}>{subscription?.status ?? "unknown"}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Messages Used</span>
          <span>{messagesUsed} / {messageLimit}</span>
        </div>
        {trialDaysRemaining !== null && subscription?.status === "trial" && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trial Days Remaining</span>
            <span>{Math.max(0, trialDaysRemaining)}</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex items-center gap-2">
            {plan?.automation_enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            <span>Automation {plan?.automation_enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="flex items-center gap-2">
            {plan?.sla_monitoring_enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            <span>SLA Monitoring {plan?.sla_monitoring_enabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
        {overQuota && <p className="text-xs text-destructive">Message quota exceeded for current billing cycle.</p>}
        {showUpgradeCta && (
          <Button asChild className="w-full" variant="default">
            <a href="/pricing">
              Upgrade Plan
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
