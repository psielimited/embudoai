import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useMerchant } from "@/hooks/useMerchants";
import { useMerchantSettings } from "@/hooks/useMerchantSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

type HealthStatus = "pass" | "fail" | "unknown";

function normalizeStatus(status: string | null | undefined, legacyPass?: boolean, hasError?: boolean): HealthStatus {
  if (status === "pass" || status === "fail" || status === "unknown") return status;
  if (legacyPass === true) return "pass";
  if (legacyPass === false || hasError) return "fail";
  return "unknown";
}

function statusBadge(status: HealthStatus, passLabel = "Pass", failLabel = "Fail", unknownLabel = "Unknown") {
  if (status === "pass") {
    return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">{passLabel}</Badge>;
  }
  if (status === "fail") {
    return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">{failLabel}</Badge>;
  }
  return <Badge variant="outline">{unknownLabel}</Badge>;
}

function maskTail(value: string | null | undefined, tail = 6) {
  if (!value) return "Not available";
  const suffix = value.slice(-tail);
  return `******${suffix}`;
}

function formatTs(value: string | null | undefined) {
  if (!value) return "None";
  const d = new Date(value);
  return `${d.toLocaleString()} (${formatDistanceToNow(d, { addSuffix: true })})`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

type TemplateRow = {
  name: string;
  status: string;
  category: string;
  language: string;
};

function toTemplateRows(value: unknown): TemplateRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => toRecord(row))
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      name: String(row.name ?? "-"),
      status: String(row.status ?? "-"),
      category: String(row.category ?? "-"),
      language: String(row.language ?? row.language_code ?? "-"),
    }));
}

export default function MerchantSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { merchantId } = useParams<{ merchantId: string }>();
  const isWizardRoute = location.pathname.startsWith("/onboarding/whatsapp/");
  const [testRecipient, setTestRecipient] = useState("");

  const { data: merchant, isLoading: isLoadingMerchant } = useMerchant(merchantId!);
  const {
    settings,
    isLoading: isLoadingSettings,
    error,
    refreshStatus,
    validateCredentials,
    sendTestOutbound,
    checkInboundMarker,
    isRefreshing,
    isValidating,
    isSendingTest,
    isCheckingInbound,
  } = useMerchantSettings(merchantId);

  const credsStatus = normalizeStatus(
    settings?.creds_status,
    settings?.credentials_valid,
    Boolean(settings?.creds_error ?? settings?.credentials_error),
  );
  const webhookStatus = normalizeStatus(
    settings?.webhook_verify_status,
    settings?.webhook_challenge_valid,
    Boolean(settings?.webhook_verify_error ?? settings?.webhook_challenge_error),
  );
  const inboundStatus = normalizeStatus(
    settings?.inbound_status,
    settings?.connectivity_inbound_ok,
    Boolean(settings?.inbound_error),
  );
  const outboundStatus = normalizeStatus(
    settings?.outbound_status,
    settings?.connectivity_outbound_ok,
    Boolean(settings?.last_outbound_error ?? settings?.connectivity_outbound_error),
  );

  const overallStatus: "connected" | "action_required" | "unknown" = useMemo(() => {
    if (credsStatus === "pass" && webhookStatus === "pass" && outboundStatus !== "fail") {
      return "connected";
    }
    if (credsStatus === "fail" || webhookStatus === "fail" || outboundStatus === "fail") {
      return "action_required";
    }
    return "unknown";
  }, [credsStatus, webhookStatus, outboundStatus]);

  const overallBadge = useMemo(() => {
    if (overallStatus === "connected") {
      return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Connected</Badge>;
    }
    if (overallStatus === "action_required") {
      return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Action required</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  }, [overallStatus]);

  const lastUpdatedText = settings?.updated_at
    ? formatDistanceToNow(new Date(settings.updated_at), { addSuffix: true })
    : "not available";

  const templateSummary = toRecord(settings?.templates_summary);
  const templateRows = toTemplateRows(templateSummary?.templates);
  const approvedCount = toNumber(templateSummary?.approved_count, settings?.template_approved_count ?? 0);
  const pendingCount = toNumber(templateSummary?.pending_count, settings?.template_pending_count ?? 0);
  const rejectedCount = toNumber(templateSummary?.rejected_count, settings?.template_rejected_count ?? 0);

  const merchantSetupComplete = Boolean(
    (credsStatus === "pass" || settings?.credentials_valid)
    && (webhookStatus === "pass" || settings?.webhook_challenge_valid)
    && (outboundStatus === "pass" || settings?.connectivity_outbound_ok)
    && (inboundStatus === "pass" || settings?.connectivity_inbound_ok),
  );

  const onRefresh = async () => {
    try {
      await refreshStatus();
      toast.success("Health status refreshed");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to refresh status");
    }
  };

  const onValidateAccount = async () => {
    try {
      await validateCredentials();
      toast.success("Account validation completed");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Validation failed");
    }
  };

  const onSendTest = async () => {
    try {
      await sendTestOutbound(testRecipient.trim() || undefined);
      toast.success("Test outbound sent");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Outbound test failed");
    }
  };

  const onCheckInbound = async () => {
    try {
      await checkInboundMarker(testRecipient.trim() || undefined);
      toast.success("Inbound marker check completed");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Inbound marker check failed");
    }
  };

  if (isLoadingMerchant || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title="WhatsApp"
        description={`Last updated ${lastUpdatedText}`}
        breadcrumbs={isWizardRoute ? [{ label: "Onboarding" }, { label: "WhatsApp" }] : [{ label: "Merchants", href: "/merchants" }, { label: merchant?.name ?? "Merchant", href: `/merchants/${merchantId}/conversations` }, { label: "WhatsApp" }]}
        actions={
          <div className="flex items-center gap-2">
            {overallBadge}
            <Button variant="outline" onClick={() => void onRefresh()} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load WhatsApp health snapshot</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Unexpected error"}</AlertDescription>
        </Alert>
      )}

      {merchantSetupComplete && isWizardRoute && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Setup completed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>All checks passed. You can proceed to the dashboard.</span>
            <Button size="sm" onClick={() => navigate("/dashboard")}>Open Dashboard</Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Connection identity and credential health.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Phone Number ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">{maskTail(settings?.whatsapp_phone_number_id ?? settings?.meta_phone_number_id)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">WABA ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">{maskTail(settings?.whatsapp_waba_id ?? settings?.meta_waba_id)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Business ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">{maskTail(settings?.whatsapp_business_id)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(credsStatus)}
              <p className="text-xs text-muted-foreground">{formatTs(settings?.creds_checked_at ?? settings?.credentials_last_checked_at)}</p>
              {(settings?.creds_error ?? settings?.credentials_error) && (
                <p className="text-xs text-destructive line-clamp-3">{settings?.creds_error ?? settings?.credentials_error}</p>
              )}
              <Button variant="outline" size="sm" onClick={() => void onValidateAccount()} disabled={isValidating}>
                {isValidating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                Validate account
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Webhook</h2>
          <p className="text-sm text-muted-foreground">Verification and inbound delivery health.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Webhook Verified</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(webhookStatus)}
              <p className="text-xs text-muted-foreground">{formatTs(settings?.webhook_verified_at ?? settings?.webhook_challenge_last_checked_at)}</p>
              {(settings?.webhook_verify_error ?? settings?.webhook_challenge_error) && (
                <p className="text-xs text-destructive line-clamp-3">{settings?.webhook_verify_error ?? settings?.webhook_challenge_error}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Inbound Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(inboundStatus, "Inbound OK", "Inbound issue", "No inbound yet")}
              <p className="text-xs text-muted-foreground">{formatTs(settings?.last_inbound_at ?? settings?.last_webhook_received_at)}</p>
              {settings?.inbound_error && (
                <p className="text-xs text-destructive line-clamp-3">{settings.inbound_error}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Inbound Marker</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono break-all">{settings?.last_inbound_event_id ?? "Not available"}</p>
            </CardContent>
          </Card>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced-webhook">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Inbound marker id: {settings?.last_inbound_event_id ?? "Not available"}</p>
                <p>Legacy inbound marker: {settings?.connectivity_inbound_marker ?? "Not available"}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Connectivity</h2>
          <p className="text-sm text-muted-foreground">Outbound delivery checks and inbound marker verification.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Last Outbound Success</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{formatTs(settings?.last_outbound_success_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Last Outbound Failure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{formatTs(settings?.last_outbound_failure_at)}</p>
              {(settings?.last_outbound_error ?? settings?.connectivity_outbound_error) && (
                <p className="text-xs text-destructive line-clamp-3">{settings?.last_outbound_error ?? settings?.connectivity_outbound_error}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Outbound Status</CardTitle>
            </CardHeader>
            <CardContent>{statusBadge(outboundStatus, "Healthy", "Failing", "Unknown")}</CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Run Checks</CardTitle>
            <CardDescription>Use your test recipient in E.164 format (example: 18095551234).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:max-w-sm">
              <Label htmlFor="testRecipient">Test recipient</Label>
              <Input
                id="testRecipient"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="18095551234"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void onSendTest()} disabled={isSendingTest}>
                {isSendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send test message
              </Button>
              <Button variant="outline" onClick={() => void onCheckInbound()} disabled={isCheckingInbound}>
                {isCheckingInbound ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Check inbound marker
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Templates</h2>
          <p className="text-sm text-muted-foreground">Approval summary and template inventory.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
            <CardDescription>Last checked: {formatTs(settings?.templates_checked_at ?? settings?.token_last_checked_at)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-xl font-semibold">{approvedCount}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-semibold">{pendingCount}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-xl font-semibold">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>

        {templateRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Template list</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 font-medium">Language</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateRows.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-b last:border-0">
                        <td className="py-2 pr-4">{row.name}</td>
                        <td className="py-2 pr-4">{row.status}</td>
                        <td className="py-2 pr-4">{row.category}</td>
                        <td className="py-2">{row.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
