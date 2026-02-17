import { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionGuardProps {
  children: ReactNode;
  bypass?: boolean;
}

export function SubscriptionGuard({ children, bypass = false }: SubscriptionGuardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: activeOrgId, isLoading: orgLoading } = useActiveOrg();
  const { subscription, isLoading: subscriptionLoading, trialExpired } = useOrgPlanStatus(activeOrgId ?? undefined);

  if (bypass) return <>{children}</>;

  if (orgLoading || subscriptionLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (subscription?.status === "past_due" || subscription?.status === "canceled") {
    if (location.pathname !== "/billing") {
      return <Navigate to="/billing" replace />;
    }
    return <>{children}</>;
  }

  if (trialExpired && location.pathname !== "/billing") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Trial Expired
            </CardTitle>
            <CardDescription>
              Your trial has ended. Upgrade your plan to continue outbound messaging and AI automation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => navigate("/billing")}>Go to Billing</Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
              }}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
