import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveOrg, useOrgs } from "@/hooks/useOrg";
import { useMerchants } from "@/hooks/useMerchants";
import { useDemoTourProgress, type DemoTourStepId } from "@/hooks/useDemoTourProgress";
import { toast } from "sonner";

type DemoStep = {
  id: DemoTourStepId;
  title: string;
  description: string;
  match: (pathname: string) => boolean;
  resolvePath: () => string | null;
};

export function DemoTourGuide() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: activeOrgId } = useActiveOrg();
  const { data: orgs = [] } = useOrgs();
  const { data: merchants = [] } = useMerchants();

  const activeOrg = orgs.find((org) => org.id === activeOrgId) ?? null;
  const isDemoOrg = /\bdemo\b/i.test(activeOrg?.name ?? "");

  const { query, completeStep, resetProgress } = useDemoTourProgress(isDemoOrg);

  const firstMerchantId = merchants[0]?.id ?? null;

  const steps = useMemo<DemoStep[]>(
    () => [
      {
        id: "dashboard",
        title: "Review Dashboard Baseline",
        description: "Start on Dashboard and confirm baseline KPIs before running the demo flow.",
        match: (pathname) => pathname === "/dashboard",
        resolvePath: () => "/dashboard",
      },
      {
        id: "conversations",
        title: "Open Seeded Conversation",
        description: "Go to Conversations and open the seeded contact thread.",
        match: (pathname) => pathname === "/conversations",
        resolvePath: () => "/conversations",
      },
      {
        id: "pipeline",
        title: "Show Pipeline Movement",
        description: "Move to Pipeline and show the opportunity created from conversation activity.",
        match: (pathname) => pathname === "/pipeline",
        resolvePath: () => "/pipeline",
      },
      {
        id: "merchant_settings",
        title: "Confirm Channel Health",
        description: "Open Merchant Settings and confirm WhatsApp readiness checks are healthy.",
        match: (pathname) => /^\/merchants\/[^/]+\/settings\/?$/.test(pathname),
        resolvePath: () => (firstMerchantId ? `/merchants/${firstMerchantId}/settings` : null),
      },
      {
        id: "reports",
        title: "Close with Reporting",
        description: "Finish on Reports to connect operations to measurable outcomes.",
        match: (pathname) => pathname === "/dashboard/reports",
        resolvePath: () => "/dashboard/reports",
      },
    ],
    [firstMerchantId],
  );

  if (!isDemoOrg) return null;
  if (query.isLoading || query.isError) return null;

  const completed = new Set(query.data?.completed_steps ?? []);
  const nextStep = steps.find((step) => !completed.has(step.id));

  if (!nextStep) {
    return (
      <Card className="fixed bottom-6 right-6 z-50 w-full max-w-sm border-primary/40 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Demo Tour Complete</CardTitle>
            <Badge variant="secondary">5/5</Badge>
          </div>
          <CardDescription>All guided demo steps are complete for this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resetProgress.isPending}
            onClick={async () => {
              try {
                await resetProgress.mutateAsync();
                toast.success("Demo tour progress reset");
              } catch {
                toast.error("Failed to reset demo progress");
              }
            }}
          >
            {resetProgress.isPending ? "Resetting..." : "Reset Demo Tour Progress"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isOnCurrentStep = nextStep.match(location.pathname);
  const resolvedPath = nextStep.resolvePath();
  const completedCount = completed.size;

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-full max-w-sm border-primary/40 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{nextStep.title}</CardTitle>
          <Badge variant="secondary">{Math.min(completedCount + 1, 5)}/5</Badge>
        </div>
        <CardDescription>{nextStep.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isOnCurrentStep ? (
          <Button
            type="button"
            className="w-full"
            disabled={completeStep.isPending}
            onClick={async () => {
              try {
                await completeStep.mutateAsync(nextStep.id);
                toast.success("Demo step completed");
              } catch {
                toast.error("Failed to update demo step");
              }
            }}
          >
            {completeStep.isPending ? "Saving..." : "Mark Step Complete"}
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full"
            disabled={!resolvedPath}
            onClick={() => {
              if (!resolvedPath) return;
              navigate(resolvedPath);
            }}
          >
            Go To Next Step
          </Button>
        )}
        {!resolvedPath && nextStep.id === "merchant_settings" && (
          <p className="text-xs text-muted-foreground">
            Create or select a merchant first to continue this step.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

