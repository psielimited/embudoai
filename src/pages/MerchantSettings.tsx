import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/edge";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Loader2,
  Link2,
  Store,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { PlanSummary } from "@/components/PlanSummary";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import {
  useDeactivateMerchant,
  useMerchant,
  useMerchantCredentials,
  useMerchantSettings,
  useRunMerchantOnboardingCheck,
  useUpdateMerchant,
  useUpdateMerchantCredentials,
} from "@/hooks/useMerchants";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { META_CONFIG_ID, getMetaRedirectUri } from "@/lib/meta/constants";
import { loadFacebookSdk } from "@/lib/meta/fbSdk";

function StepStatus({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === true) {
    return (
      <Badge className="gap-1" variant="secondary">
        <CheckCircle2 className="h-3.5 w-3.5" /> {label}
      </Badge>
    );
  }

  if (ok === false) {
    return (
      <Badge className="gap-1" variant="destructive">
        <XCircle className="h-3.5 w-3.5" /> {label}
      </Badge>
    );
  }

  return (
    <Badge className="gap-1" variant="outline">
      <CircleDot className="h-3.5 w-3.5" /> {label}
    </Badge>
  );
}

function formatTs(ts: string | null | undefined) {
  if (!ts) return "Not available";
  return `${new Date(ts).toLocaleString()} (${formatDistanceToNow(new Date(ts), { addSuffix: true })})`;
}

export default function MerchantSettings() {
  const { merchantId, wizardStep } = useParams<{ merchantId: string; wizardStep?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: merchant, isLoading } = useMerchant(merchantId!);
  const { data: merchantSettings } = useMerchantSettings(merchantId);
  const { data: credentials } = useMerchantCredentials(merchantId);
  const { data: activeOrgId } = useActiveOrg();
  const { subscription, trialDaysRemaining, overQuota, trialExpired } = useOrgPlanStatus(activeOrgId ?? undefined);
  const updateMerchant = useUpdateMerchant();
  const updateCredentials = useUpdateMerchantCredentials();
  const deactivateMerchant = useDeactivateMerchant();
  const onboardingCheck = useRunMerchantOnboardingCheck();
  const queryClient = useQueryClient();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [embeddedStatus, setEmbeddedStatus] = useState<"idle" | "connecting" | "exchanging" | "provisioning" | "validating" | "done" | "error">("idle");

  useEffect(() => {
    if (!credentials || initialized) return;
    setPhoneNumberId(credentials.whatsapp_phone_number_id ?? "");
    setVerifyToken(credentials.whatsapp_verify_token ?? "");
    setAccessToken(credentials.whatsapp_access_token ?? "");
    setAppSecret(credentials.whatsapp_app_secret ?? "");
    setInitialized(true);
  }, [credentials, initialized]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const onboardingStep = useMemo(() => {
    if (merchantSettings?.onboarding_step) return merchantSettings.onboarding_step;
    return 1;
  }, [merchantSettings]);
  const onboardingWizardBase = `/onboarding/whatsapp/${merchantId}`;
  const wizardSteps = ["credentials", "connectivity", "status"] as const;
  const isWizardRoute = location.pathname.startsWith("/onboarding/whatsapp/");
  const activeWizardStep = wizardSteps.includes((wizardStep as typeof wizardSteps[number]) ?? "credentials")
    ? (wizardStep as typeof wizardSteps[number])
    : "credentials";
  const activeWizardStepNumber = wizardSteps.indexOf(activeWizardStep) + 1;

  const plan = subscription?.subscription_plans;
  const merchantLimit = (() => {
    const normalized = (plan?.name ?? "").toLowerCase();
    if (normalized.includes("free")) return 1;
    if (normalized.includes("starter")) return 1;
    if (normalized.includes("growth")) return 2;
    if (normalized.includes("pro")) return null;
    return 1;
  })();
  const isSingleMerchantTier = merchantLimit === 1;
  const canRunConnectivityTest = !!subscription
    && (subscription.status === "active" || subscription.status === "trial")
    && !trialExpired
    && !overQuota;
  const showUpgradeCta = Boolean(
    (plan && (!plan.ai_enabled || !plan.automation_enabled))
      || overQuota
      || (subscription?.status === "trial" && (trialDaysRemaining ?? 99) < 3),
  );
  const merchantWizardComplete = Boolean(
    merchantSettings
      && merchantSettings.onboarding_step >= 3
      && merchantSettings.credentials_valid
      && merchantSettings.webhook_challenge_valid
      && merchantSettings.connectivity_outbound_ok
      && merchantSettings.connectivity_inbound_ok,
  );
  const isMerchantSetupPending = !merchantWizardComplete;
  const canAdvanceFromCredentials = Boolean(merchantSettings?.credentials_valid && merchantSettings?.webhook_challenge_valid);
  const canAdvanceFromConnectivity = Boolean(merchantSettings?.connectivity_outbound_ok && merchantSettings?.connectivity_inbound_ok);
  const showStep1Section = !isWizardRoute || activeWizardStep === "credentials";
  const showStep2Section = !isWizardRoute || activeWizardStep === "connectivity";
  const showStep3Section = !isWizardRoute || activeWizardStep === "status";
  const onboardingFlowStep = isWizardRoute ? activeWizardStepNumber + 1 : 4;
  const isAdmin = credentials !== null;
  const manualSetupEnabled = import.meta.env.VITE_FEATURE_FLAG_MANUAL_WA_SETUP === "true";
  const canEditCredentials = manualSetupEnabled && (isAdmin || isMerchantSetupPending);

  const handleSaveCredentials = async () => {
    if (!merchantId) return;

    await updateCredentials.mutateAsync({
      merchantId,
      credentials: {
        whatsapp_phone_number_id: phoneNumberId || null,
        whatsapp_verify_token: verifyToken || null,
        whatsapp_app_secret: appSecret || null,
        whatsapp_access_token: accessToken || null,
      },
    });
  };

  const handleValidateCredentials = async () => {
    if (!merchantId) return;
    const missing: string[] = [];
    if (!phoneNumberId.trim()) missing.push("phone_number_id");
    if (!accessToken.trim()) missing.push("access_token");
    if (!verifyToken.trim()) missing.push("verify_token");
    if (missing.length > 0) {
      toast.error(`Please enter: ${missing.join(", ")}`);
      return;
    }

    try {
      await handleSaveCredentials();
      const { data: persisted, error: persistedError } = await supabase
        .from("merchants")
        .select("whatsapp_phone_number_id,whatsapp_access_token,whatsapp_verify_token")
        .eq("id", merchantId)
        .maybeSingle();
      if (persistedError) throw persistedError;
      if (!persisted?.whatsapp_phone_number_id || !persisted?.whatsapp_access_token || !persisted?.whatsapp_verify_token) {
        toast.error("Credentials could not be persisted yet. Please save again or check permissions.");
        return;
      }
      const result = await onboardingCheck.mutateAsync({
        merchantId,
        action: "validate_credentials",
      });

      if (result.ok) {
        toast.success("Credentials validated and webhook challenge simulation passed");
      } else {
        toast.error(String(result.error ?? "Credential validation failed"));
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to validate credentials");
    }
  };

  const handleConnectivityOutbound = async () => {
    if (!merchantId) return;

    try {
      const result = await onboardingCheck.mutateAsync({
        merchantId,
        action: "connectivity_test_outbound",
        payload: { test_to: testRecipient.trim() },
      });

      if (result.ok) {
        toast.success("Test outbound message sent");
      } else {
        toast.error(String(result.error ?? "Outbound test failed"));
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed outbound connectivity test");
    }
  };

  const handleConnectivityInbound = async () => {
    if (!merchantId) return;

    try {
      const result = await onboardingCheck.mutateAsync({
        merchantId,
        action: "check_inbound_marker",
        payload: { expected_from: testRecipient.trim() || undefined },
      });

      if (result.ok) {
        toast.success("Inbound webhook marker detected");
      } else {
        toast.error("No inbound marker found yet");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed inbound marker check");
    }
  };

  const handleRefreshStatus = async () => {
    if (!merchantId) return;

    try {
      await onboardingCheck.mutateAsync({ merchantId, action: "refresh_status" });
      toast.success("Status refreshed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to refresh status");
    }
  };

  const handleStatusToggle = async (checked: boolean) => {
    if (!merchantId) return;
    const nextStatus = checked ? "active" : "inactive";
    try {
      await updateMerchant.mutateAsync({
        id: merchantId,
        updates: { status: nextStatus },
      });
      toast.success(`Merchant marked ${nextStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update merchant status");
    }
  };

  const handleDeactivate = async () => {
    if (!merchantId) return;
    try {
      await deactivateMerchant.mutateAsync(merchantId);
      toast.success("Merchant archived");
    } catch (error) {
      console.error(error);
      toast.error("Failed to archive merchant");
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message || "Failed to sign out");
      return;
    }
    navigate("/login", { replace: true });
  };

  const goToWizardStep = (target: (typeof wizardSteps)[number]) => {
    navigate(`${onboardingWizardBase}/${target}`);
  };

  const embeddedStepLabel: Record<typeof embeddedStatus, string> = {
    idle: "Ready to connect",
    connecting: "Opening Meta Embedded Signup",
    exchanging: "Exchanging authorization code",
    provisioning: "Provisioning WhatsApp assets",
    validating: "Running validation checks",
    done: "Connection complete",
    error: "Connection failed",
  };

  const handleEmbeddedSignupConnect = async () => {
    if (!merchantId) return;
    try {
      setEmbeddedStatus("connecting");
      await loadFacebookSdk();
      const redirectUri = getMetaRedirectUri();

      const init = await callEdge<{ ok: boolean; state: string }>("meta-embedded-signup-init", {
        merchant_id: merchantId,
        redirect_uri: redirectUri,
      });
      const state = init.state;
      sessionStorage.setItem(`embudex.meta.state.${merchantId}`, state);

      let hintedWabaId: string | null = null;
      let hintedPhoneId: string | null = null;
      const listener = (event: MessageEvent) => {
        if (!event.origin.includes("facebook.com")) return;
        try {
          const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          const payload = raw?.data ?? raw;
          const waba = payload?.waba_id ?? payload?.business_account_id ?? payload?.whatsapp_business_account_id;
          const phone = payload?.phone_number_id ?? payload?.phone_id;
          if (typeof waba === "string") hintedWabaId = waba;
          if (typeof phone === "string") hintedPhoneId = phone;
        } catch {
          // ignore
        }
      };
      window.addEventListener("message", listener);

      const authResponse = await new Promise<{ code?: string }>((resolve) => {
        window.FB?.login(
          (response) => resolve({ code: response?.authResponse?.code }),
          {
            config_id: META_CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
            },
          },
        );
      });
      window.removeEventListener("message", listener);

      const code = authResponse.code;
      if (!code) {
        setEmbeddedStatus("error");
        toast.error("Meta signup was cancelled or did not return an authorization code.");
        return;
      }

      setEmbeddedStatus("exchanging");
      const result = await callEdge<{ ok: boolean; status?: Record<string, string> }>(
        "meta-embedded-signup-exchange",
        {
          merchant_id: merchantId,
          code,
          state,
          redirect_uri: redirectUri,
          waba_id: hintedWabaId,
          phone_number_id: hintedPhoneId,
        },
      );

      setEmbeddedStatus("validating");
      queryClient.invalidateQueries({ queryKey: ["merchant-settings", merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-credentials", merchantId] });

      if (result.ok) {
        setEmbeddedStatus("done");
        toast.success("WhatsApp connected successfully.");
      } else {
        setEmbeddedStatus("error");
        toast.error("Connection failed.");
      }
    } catch (error) {
      console.error(error);
      setEmbeddedStatus("error");
      toast.error(error instanceof Error ? error.message : "Failed to connect WhatsApp");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <PageHeader
          title={`${merchant?.name ?? "Merchant"} Settings`}
          description={isMerchantSetupPending ? "Complete the WhatsApp onboarding wizard to unlock dashboard access." : undefined}
          breadcrumbs={isWizardRoute ? [
            { label: "Onboarding", href: "/onboarding/organization" },
            { label: "WhatsApp Setup" },
          ] : [
            { label: "Merchants", href: "/merchants" },
            { label: merchant?.name ?? "...", href: `/merchants/${merchantId}/conversations` },
            { label: "Settings" },
          ]}
          actions={(
            <Button variant="outline" onClick={() => void handleSignOut()}>
              Log out
            </Button>
          )}
        />

        {merchant?.status === "inactive" && !isMerchantSetupPending && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inactive merchant</AlertTitle>
            <AlertDescription>
              This merchant is archived. Conversations and workflows should be treated as read-only until reactivated.
            </AlertDescription>
          </Alert>
        )}

        {merchantWizardComplete && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>WhatsApp onboarding complete</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                All setup steps passed. You can now proceed to the dashboard and use features available in your plan.
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/merchants")}>
                  Merchants
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              WhatsApp Merchant Onboarding Wizard
            </CardTitle>
            <CardDescription>
              Guided setup to validate credentials, test connectivity, and monitor operational status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <OnboardingProgress
              activeStep={onboardingFlowStep}
              stepLabels={["Organization", "WhatsApp Credentials", "Connectivity Test", "Status Review"]}
              helperText={`Technical step: ${onboardingStep}/3`}
            />

            {!isWizardRoute && <Separator />}

            {showStep1Section && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Step 1 - Connect WhatsApp (Embedded Signup)</h3>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">Connect from Meta in one click</p>
                <p className="text-muted-foreground">
                  This flow uses Meta Embedded Signup with your platform configuration and stores credentials server-side.
                </p>
                <p className="text-muted-foreground">
                  No copy/paste of access token, app secret, or phone number ID is required.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Connection status</p>
                  <Badge variant={embeddedStatus === "error" ? "destructive" : embeddedStatus === "done" ? "secondary" : "outline"}>
                    {embeddedStepLabel[embeddedStatus]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void handleEmbeddedSignupConnect()}
                    disabled={embeddedStatus === "connecting" || embeddedStatus === "exchanging" || onboardingCheck.isPending}
                  >
                    {embeddedStatus === "connecting" || embeddedStatus === "exchanging" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Connect WhatsApp
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>WABA ID: {(merchantSettings as any)?.meta_waba_id ?? "Not connected"}</p>
                  <p>Phone Number ID: {(merchantSettings as any)?.meta_phone_number_id ?? merchant?.whatsapp_phone_number_id ?? "Not connected"}</p>
                </div>
              </div>

              {manualSetupEnabled && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Manual setup fallback enabled</AlertTitle>
                  <AlertDescription>
                    This is an admin-only escape hatch. Embedded Signup remains the default path.
                  </AlertDescription>
                </Alert>
              )}

              {canEditCredentials && (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Manual credential override</summary>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumberId">phone_number_id</Label>
                      <Input
                        id="phoneNumberId"
                        value={phoneNumberId}
                        onChange={(event) => setPhoneNumberId(event.target.value)}
                        placeholder="e.g. 123456789012345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verifyToken">verify_token</Label>
                      <Input
                        id="verifyToken"
                        value={verifyToken}
                        onChange={(event) => setVerifyToken(event.target.value)}
                        placeholder="Webhook verify token"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="accessToken">access_token</Label>
                      <Input
                        id="accessToken"
                        value={accessToken}
                        onChange={(event) => setAccessToken(event.target.value)}
                        placeholder="Meta access token"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        onClick={() => void handleValidateCredentials()}
                        disabled={updateCredentials.isPending || onboardingCheck.isPending}
                      >
                        {onboardingCheck.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Save and Validate Manual Credentials
                      </Button>
                    </div>
                  </div>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <StepStatus ok={merchantSettings?.credentials_valid ?? null} label="Access token validation" />
                <StepStatus ok={merchantSettings?.webhook_challenge_valid ?? null} label="Webhook challenge simulation" />
              </div>

              {(merchantSettings?.credentials_error || merchantSettings?.webhook_challenge_error) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation issues</AlertTitle>
                  <AlertDescription>
                    {merchantSettings.credentials_error ?? merchantSettings.webhook_challenge_error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2">
                {isWizardRoute && (
                  <Button
                    variant="outline"
                    onClick={() => goToWizardStep("connectivity")}
                    disabled={!canAdvanceFromCredentials}
                  >
                    Continue to Step 2
                  </Button>
                )}
              </div>
            </section>
            )}

            {!isWizardRoute && <Separator />}

            {showStep2Section && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Step 2 - Connectivity Test</h3>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">Testing tips</p>
                <p className="text-muted-foreground">Use a WhatsApp number that can receive test messages from your current Meta/WABA setup.</p>
                <p className="text-muted-foreground">Send in E.164 format, for example: `18095551234`.</p>
                <p className="text-muted-foreground">After sending outbound test, reply from that number and run inbound marker check.</p>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Usage Panel</p>
                <p className="text-muted-foreground">
                  {subscription?.messages_used ?? 0} / {plan?.message_limit ?? 0} messages used this cycle
                  {subscription?.status === "trial" && trialDaysRemaining !== null
                    ? ` - Trial ends in ${Math.max(0, trialDaysRemaining)} day(s)`
                    : ""}
                </p>
              </div>

              {!canRunConnectivityTest && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Connectivity test blocked by plan</AlertTitle>
                  <AlertDescription>
                    {overQuota
                      ? `Usage limit reached (${subscription?.messages_used ?? 0}/${plan?.message_limit ?? 0}). Upgrade to continue testing outbound sends.`
                      : trialExpired
                        ? "Trial expired. Upgrade plan to continue outbound testing."
                        : "Subscription must be active or trial to run connectivity tests."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="testRecipient">Test recipient phone (E.164)</Label>
                <Input
                  id="testRecipient"
                  value={testRecipient}
                  onChange={(event) => setTestRecipient(event.target.value)}
                  placeholder="e.g. 18095551234"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StepStatus ok={merchantSettings?.connectivity_outbound_ok ?? null} label="Outbound test" />
                <StepStatus ok={merchantSettings?.connectivity_inbound_ok ?? null} label="Inbound webhook marker" />
              </div>

              {merchantSettings?.connectivity_outbound_error && (
                <p className="text-xs text-destructive">Last outbound test error: {merchantSettings.connectivity_outbound_error}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleConnectivityOutbound()}
                  disabled={onboardingCheck.isPending || !testRecipient.trim() || !canRunConnectivityTest}
                >
                  Trigger Test Outbound
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleConnectivityInbound()}
                  disabled={onboardingCheck.isPending}
                >
                  Check Inbound Marker
                </Button>
                {isWizardRoute && (
                  <>
                    <Button variant="ghost" onClick={() => goToWizardStep("credentials")}>
                      Back to Step 1
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => goToWizardStep("status")}
                      disabled={!canAdvanceFromConnectivity}
                    >
                      Continue to Step 3
                    </Button>
                  </>
                )}
              </div>
            </section>
            )}

            <Separator />

            {showStep3Section && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Step 3 - Status Panel</h3>
                <Button variant="outline" size="sm" onClick={() => void handleRefreshStatus()} disabled={onboardingCheck.isPending}>
                  Refresh Status
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Last webhook received</p>
                  <p className="text-sm">{formatTs(merchantSettings?.last_webhook_received_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last outbound success</p>
                  <p className="text-sm">{formatTs(merchantSettings?.last_outbound_success_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last outbound failure</p>
                  <p className="text-sm">{formatTs(merchantSettings?.last_outbound_failure_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Token expiration</p>
                  <p className="text-sm">{merchantSettings?.token_expires_at ? formatTs(merchantSettings.token_expires_at) : "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Template approval state</p>
                  <p className="text-sm capitalize">{merchantSettings?.template_approval_state ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    Approved: {merchantSettings?.template_approved_count ?? 0}, Pending: {merchantSettings?.template_pending_count ?? 0}, Rejected: {merchantSettings?.template_rejected_count ?? 0}
                  </p>
                </div>
              </div>

              {isWizardRoute && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => goToWizardStep("connectivity")}>
                    Back to Step 2
                  </Button>
                  <Button onClick={() => navigate("/dashboard")} disabled={!merchantWizardComplete}>
                    Finish and open dashboard
                  </Button>
                </div>
              )}
            </section>
            )}
          </CardContent>
        </Card>

        <PlanSummary
          subscription={subscription}
          trialDaysRemaining={trialDaysRemaining}
          overQuota={overQuota}
          showUpgradeCta={showUpgradeCta}
        />

        {!isMerchantSetupPending && (
          <Card>
            <CardHeader>
              <CardTitle>Merchant Status</CardTitle>
              <CardDescription>
                {isSingleMerchantTier
                  ? "Single-merchant tier: keep one active merchant at a time."
                  : "Toggle whether this merchant is active in your workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{merchant?.status === "active" ? "Active" : "Inactive"}</p>
                <p className="text-sm text-muted-foreground">
                  {isSingleMerchantTier
                    ? "Archiving this merchant frees your single active merchant slot."
                    : "Inactive merchants are hidden by default from merchant list views."}
                </p>
              </div>
              <Switch
                checked={merchant?.status === "active"}
                onCheckedChange={handleStatusToggle}
                disabled={updateMerchant.isPending || deactivateMerchant.isPending}
              />
            </CardContent>
          </Card>
        )}

        {!isMerchantSetupPending && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                {isSingleMerchantTier
                  ? "Archive this merchant to free your single active slot. You can reactivate later."
                  : "Archive this merchant. You can reactivate later from the status toggle."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {isSingleMerchantTier
                  ? "Archiving marks this merchant inactive and pauses activity until you reactivate it or activate another merchant."
                  : "Archiving hides this merchant from default list views and marks it inactive."}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={merchant?.status === "inactive" || deactivateMerchant.isPending}>
                    Archive Merchant
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive {merchant?.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isSingleMerchantTier
                        ? "This will archive the merchant and free your single active merchant slot until you reactivate or create another merchant."
                        : "This will archive the merchant and remove it from active lists until reactivated."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void handleDeactivate()}
                    >
                      Confirm Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {!isMerchantSetupPending && (
          <div>
            <Button variant="outline" onClick={() => navigate(`/merchants/${merchantId}/conversations`)}>
              Back to Conversations
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
