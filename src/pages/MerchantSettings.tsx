import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Store,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { PlanSummary } from "@/components/PlanSummary";
import {
  useDeactivateMerchant,
  useMerchant,
  useMerchantSettings,
  useRunMerchantOnboardingCheck,
  useUpdateMerchant,
} from "@/hooks/useMerchants";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
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
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { data: merchant, isLoading } = useMerchant(merchantId!);
  const { data: merchantSettings } = useMerchantSettings(merchantId);
  const { data: activeOrgId } = useActiveOrg();
  const { subscription, trialDaysRemaining, overQuota, trialExpired } = useOrgPlanStatus(activeOrgId ?? undefined);
  const updateMerchant = useUpdateMerchant();
  const deactivateMerchant = useDeactivateMerchant();
  const onboardingCheck = useRunMerchantOnboardingCheck();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!merchant || initialized) return;
    setPhoneNumberId(merchant.whatsapp_phone_number_id ?? "");
    setVerifyToken(merchant.whatsapp_verify_token ?? "");
    setAppSecret(merchant.whatsapp_app_secret ?? "");
    setAccessToken(merchant.whatsapp_access_token ?? "");
    setInitialized(true);
  }, [merchant, initialized]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const step = useMemo(() => {
    if (merchantSettings?.onboarding_step) return merchantSettings.onboarding_step;
    return 1;
  }, [merchantSettings]);

  const plan = subscription?.subscription_plans;
  const canRunConnectivityTest = !!subscription
    && (subscription.status === "active" || subscription.status === "trial")
    && !trialExpired
    && !overQuota;
  const showUpgradeCta = Boolean(
    (plan && (!plan.ai_enabled || !plan.automation_enabled))
      || overQuota
      || (subscription?.status === "trial" && (trialDaysRemaining ?? 99) < 3),
  );

  const handleSaveCredentials = async () => {
    if (!merchantId) return;

    await updateMerchant.mutateAsync({
      id: merchantId,
      updates: {
        whatsapp_phone_number_id: phoneNumberId || null,
        whatsapp_verify_token: verifyToken || null,
        whatsapp_app_secret: appSecret || null,
        whatsapp_access_token: accessToken || null,
      },
    });
  };

  const handleValidateCredentials = async () => {
    if (!merchantId) return;

    try {
      await handleSaveCredentials();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`${merchant?.name ?? "Merchant"} Settings`}
        breadcrumbs={[
          { label: "Merchants", href: "/merchants" },
          { label: merchant?.name ?? "...", href: `/merchants/${merchantId}/conversations` },
          { label: "Settings" },
        ]}
      />

      <div className="space-y-6">
        {merchant?.status === "inactive" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Inactive merchant</AlertTitle>
            <AlertDescription>
              This merchant is archived. Conversations and workflows should be treated as read-only until reactivated.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Merchant Status</CardTitle>
            <CardDescription>Toggle whether this merchant is active in your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{merchant?.status === "active" ? "Active" : "Inactive"}</p>
              <p className="text-sm text-muted-foreground">
                Inactive merchants are hidden by default from merchant list views.
              </p>
            </div>
            <Switch
              checked={merchant?.status === "active"}
              onCheckedChange={handleStatusToggle}
              disabled={updateMerchant.isPending || deactivateMerchant.isPending}
            />
          </CardContent>
        </Card>

        <PlanSummary
          subscription={subscription}
          trialDaysRemaining={trialDaysRemaining}
          overQuota={overQuota}
          showUpgradeCta={showUpgradeCta}
        />

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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={step >= 1 ? "secondary" : "outline"}>Step 1</Badge>
              <Badge variant={step >= 2 ? "secondary" : "outline"}>Step 2</Badge>
              <Badge variant={step >= 3 ? "secondary" : "outline"}>Step 3</Badge>
              <span className="text-xs text-muted-foreground">Current step: {step}</span>
            </div>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Step 1 - Credential Entry</h3>

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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                <div className="space-y-2">
                  <Label htmlFor="appSecret">app_secret</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="appSecret"
                      type={showSecret ? "text" : "password"}
                      value={appSecret}
                      onChange={(event) => setAppSecret(event.target.value)}
                      placeholder="Meta app secret"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setShowSecret((value) => !value)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessToken">access_token</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="accessToken"
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(event) => setAccessToken(event.target.value)}
                      placeholder="Meta access token"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setShowToken((value) => !value)}>
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

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
                <Button
                  onClick={() => void handleValidateCredentials()}
                  disabled={updateMerchant.isPending || onboardingCheck.isPending}
                >
                  {onboardingCheck.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save and Validate Step 1
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Step 2 - Connectivity Test</h3>

              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Usage Panel</p>
                <p className="text-muted-foreground">
                  {subscription?.messages_used ?? 0} / {plan?.message_limit ?? 0} messages used this cycle
                  {subscription?.status === "trial" && trialDaysRemaining !== null
                    ? ` • Trial ends in ${Math.max(0, trialDaysRemaining)} day(s)`
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
              </div>
            </section>

            <Separator />

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
            </section>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Archive this merchant. You can reactivate later from the status toggle.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Archiving hides this merchant from default list views and marks it inactive.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={merchant?.status === "inactive" || deactivateMerchant.isPending}>
                  Deactivate Merchant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate {merchant?.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive the merchant and remove it from active lists until reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDeactivate()}
                  >
                    Confirm Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <div>
          <Button variant="outline" onClick={() => navigate(`/merchants/${merchantId}/conversations`)}>
            Back to Conversations
          </Button>
        </div>
      </div>
    </>
  );
}
