import { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionGuardProps {
  children: ReactNode;
  bypass?: boolean;
}

export function SubscriptionGuard({ children, bypass = false }: SubscriptionGuardProps) {
  const bypassOnboardingGates = import.meta.env.VITE_BYPASS_ONBOARDING_GATES === "true";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: activeOrgId, isLoading: orgLoading } = useActiveOrg();
  const { subscription, isLoading: subscriptionLoading, trialExpired } = useOrgPlanStatus(activeOrgId ?? undefined);
  const isOnboardingPath = location.pathname === "/onboarding";
  const isMerchantSettingsPath = /^\/merchants\/[^/]+\/settings\/?$/.test(location.pathname);

  const { data: merchantCount = 0, isLoading: merchantLoading } = useQuery({
    queryKey: ["onboarding-merchant-count", activeOrgId ?? null],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("merchants")
        .select("id", { count: "exact", head: true })
        .eq("org_id", activeOrgId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: merchantOnboarding, isLoading: merchantOnboardingLoading } = useQuery({
    queryKey: ["merchant-onboarding-guard", activeOrgId ?? null],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data: merchants, error: merchantErr } = await supabase
        .from("merchants")
        .select("id,status,created_at")
        .eq("org_id", activeOrgId!)
        .order("created_at", { ascending: true });
      if (merchantErr) throw merchantErr;

      const primaryMerchant = (merchants ?? []).find((merchant) => merchant.status === "active") ?? merchants?.[0] ?? null;
      if (!primaryMerchant) {
        return {
          hasMerchant: false,
          merchantId: null as string | null,
          redirectPath: "/merchants",
          setupComplete: false,
        };
      }

      const { data: settings, error: settingsErr } = await supabase
        .from("merchant_settings")
        .select("onboarding_step,credentials_valid,webhook_challenge_valid,connectivity_outbound_ok,connectivity_inbound_ok")
        .eq("org_id", activeOrgId!)
        .eq("merchant_id", primaryMerchant.id)
        .maybeSingle();
      if (settingsErr) throw settingsErr;

      const setupComplete = Boolean(
        settings
        && settings.onboarding_step >= 3
        && settings.credentials_valid
        && settings.webhook_challenge_valid
        && settings.connectivity_outbound_ok
        && settings.connectivity_inbound_ok,
      );

      return {
        hasMerchant: true,
        merchantId: primaryMerchant.id,
        redirectPath: `/merchants/${primaryMerchant.id}/settings`,
        setupComplete,
      };
    },
  });

  const onboardingComplete = !!activeOrgId && merchantCount > 0;
  const merchantSetupComplete = !!merchantOnboarding?.setupComplete;

  if (bypass || bypassOnboardingGates) {
    if (bypassOnboardingGates) {
      // eslint-disable-next-line no-console
      console.warn("[SubscriptionGuard] VITE_BYPASS_ONBOARDING_GATES=true: skipping onboarding/setup gating");
    }
    return <>{children}</>;
  }

  if (orgLoading || subscriptionLoading || merchantLoading || merchantOnboardingLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboardingComplete && !isOnboardingPath) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingComplete && isOnboardingPath) {
    if (!merchantSetupComplete && merchantOnboarding?.redirectPath) {
      return <Navigate to={merchantOnboarding.redirectPath} replace />;
    }
    return <Navigate to="/merchants" replace />;
  }

  if (onboardingComplete && !merchantSetupComplete && !isMerchantSettingsPath) {
    return <Navigate to={merchantOnboarding?.redirectPath ?? "/merchants"} replace />;
  }

  if (subscription?.status === "past_due" || subscription?.status === "canceled") {
    if (location.pathname !== "/billing" && !isOnboardingPath && !isMerchantSettingsPath) {
      return <Navigate to="/billing" replace />;
    }
    return <>{children}</>;
  }

  if (trialExpired && location.pathname !== "/billing" && !isOnboardingPath && !isMerchantSettingsPath) {
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
