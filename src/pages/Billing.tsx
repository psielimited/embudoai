import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";

export default function Billing() {
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const { data: activeOrgId } = useActiveOrg();
  const { subscription, trialDaysRemaining, overQuota } = useOrgPlanStatus(activeOrgId ?? undefined);

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentPlanName = subscription?.subscription_plans?.name ?? "Unknown";
  const messageLimit = subscription?.subscription_plans?.message_limit ?? 0;
  const messagesUsed = subscription?.messages_used ?? 0;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Manage plan access, usage, and subscription status."
        breadcrumbs={[{ label: "Billing" }]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Subscription
              <Badge variant="outline">{subscription?.status ?? "unknown"}</Badge>
            </CardTitle>
            <CardDescription>
              Plan: {currentPlanName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Usage: {messagesUsed}/{messageLimit > 0 ? messageLimit : "∞"} messages</p>
            {subscription?.status === "trial" && trialDaysRemaining !== null && (
              <p>Trial days remaining: {Math.max(0, trialDaysRemaining)}</p>
            )}
            {overQuota && <p className="text-destructive">Quota exceeded for current cycle.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade Options</CardTitle>
            <CardDescription>Select a plan. Payment wiring is a stub for now.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  ${Number(plan.monthly_price).toLocaleString()} / month
                </p>
                <p className="text-sm text-muted-foreground">Limit: {plan.message_limit} conversations</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={pendingPlan === plan.id}
                    onClick={() => {
                      setPendingPlan(plan.id);
                      toast.info("Plan change checkout is not wired yet.");
                      setPendingPlan(null);
                    }}
                  >
                    Change plan
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/pricing">View details</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancel Subscription</CardTitle>
            <CardDescription>Cancellation is currently handled manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                toast.info("Cancel flow is a stub. Contact billing@embudex.com.");
              }}
            >
              Cancel subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
