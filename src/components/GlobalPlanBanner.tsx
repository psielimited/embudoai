import { AlertTriangle } from "lucide-react";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";

export function GlobalPlanBanner() {
  const { data: activeOrgId } = useActiveOrg();
  const { subscription, overQuota, pastDue, trialExpired, trialDaysRemaining } = useOrgPlanStatus(activeOrgId ?? undefined);

  if (!subscription) return null;

  let message: string | null = null;

  if (pastDue) {
    message = "Subscription is past due. Outbound sends may be blocked until billing is resolved.";
  } else if (trialExpired) {
    message = "Trial has expired. Upgrade to resume full messaging capabilities.";
  } else if (overQuota) {
    message = "Message quota exceeded for this billing cycle. Upgrade plan or wait for reset.";
  } else if (subscription.status === "trial" && trialDaysRemaining !== null && trialDaysRemaining < 3) {
    message = `Trial expires in ${Math.max(0, trialDaysRemaining)} day(s).`;
  }

  if (!message) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-amber-900">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>{message}</span>
      </div>
    </div>
  );
}
