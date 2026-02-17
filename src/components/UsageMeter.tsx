import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function UsageMeter() {
  const { data: activeOrgId } = useActiveOrg();
  const { subscription, trialDaysRemaining } = useOrgPlanStatus(activeOrgId ?? undefined);

  if (!subscription) return null;

  const used = subscription.messages_used ?? 0;
  const limit = subscription.subscription_plans?.message_limit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const meterClassName =
    pct > 90 ? "text-red-600" : pct > 70 ? "text-amber-600" : "text-emerald-600";
  const indicatorClassName =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="hidden min-w-[220px] max-w-[280px] lg:block">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Usage</span>
        <span className={cn("font-medium", meterClassName)}>
          {used}/{limit > 0 ? limit : "∞"}
        </span>
      </div>
      <Progress
        value={pct}
        className="mt-1 h-2 [&>div]:transition-all"
        indicatorClassName={indicatorClassName}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px] uppercase">
          {subscription.subscription_plans?.name ?? "Plan"}
        </Badge>
        {subscription.status === "trial" && trialDaysRemaining !== null && (
          <span className="text-[10px] text-muted-foreground">
            Trial: {Math.max(0, trialDaysRemaining)}d
          </span>
        )}
      </div>
    </div>
  );
}
