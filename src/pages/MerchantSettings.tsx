import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useMerchant } from "@/hooks/useMerchants";
import { useMerchantSettings } from "@/hooks/useMerchantSettings";
import { callEdge } from "@/lib/edge";
import {
  META_EMBEDDED_SIGNUP_CONFIG_ID_SANDBOX,
  getMetaEmbeddedSignupConfigIdProd,
  getMetaRedirectUri,
} from "@/lib/meta/constants";
import { loadFacebookSdk } from "@/lib/meta/fbSdk";
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

type HealthStatus = "pass" | "fail" | "unknown" | "blocked_sandbox";

function normalizeStatus(status: string | null | undefined, legacyPass?: boolean, hasError?: boolean): HealthStatus {
  if (status === "pass" || status === "fail" || status === "unknown" || status === "blocked_sandbox") return status;
  if (legacyPass === true) return "pass";
  if (legacyPass === false || hasError) return "fail";
  return "unknown";
}

function statusBadge(
  status: HealthStatus,
  passLabel = "Pass",
  failLabel = "Fail",
  unknownLabel = "Unknown",
  blockedLabel = "Blocked (Sandbox)",
) {
  if (status === "pass") {
    return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">{passLabel}</Badge>;
  }
  if (status === "fail") {
    return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">{failLabel}</Badge>;
  }
  if (status === "blocked_sandbox") {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">{blockedLabel}</Badge>;
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

function parseSandboxErrorPayload(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function registrationBadge(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "registered") {
    return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Registered</Badge>;
  }
  if (normalized === "verified_not_registered" || normalized === "otp_verified") {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Verified - Pending Register</Badge>;
  }
  if (normalized === "otp_requested") {
    return <Badge variant="outline">OTP Requested</Badge>;
  }
  if (normalized === "registration_failed" || normalized === "otp_verification_failed" || normalized === "otp_request_failed") {
    return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Action required</Badge>;
  }
  if (normalized === "not_verified" || normalized === "expired") {
    return <Badge variant="outline">Not Verified</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
}

type TemplateRow = {
  name: string;
  status: string;
  category: string;
  language: string;
};

type EmbeddedStatus = "idle" | "connecting" | "exchanging" | "validating" | "done" | "error";

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
  const { signOut, isSandbox } = useAuth();
  const { merchantId } = useParams<{ merchantId: string }>();
  const isWizardRoute = location.pathname.startsWith("/onboarding/whatsapp/");
  const [testRecipient, setTestRecipient] = useState("");
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus>("idle");
  const [otpCode, setOtpCode] = useState("");
  const [registrationPin, setRegistrationPin] = useState("");
  const [otpLanguage, setOtpLanguage] = useState("en_US");
  const [otpMethod, setOtpMethod] = useState<"SMS" | "VOICE">("SMS");

  const { data: merchant, isLoading: isLoadingMerchant } = useMerchant(merchantId!);
  const {
    settings,
    isLoading: isLoadingSettings,
    error,
    refreshStatus,
    validateCredentials,
    sendTestOutbound,
    checkInboundMarker,
    getRegistrationStatus,
    requestRegistrationCode,
    verifyRegistrationCode,
    registerPhoneNumber,
    isRefreshing,
    isValidating,
    isSendingTest,
    isCheckingInbound,
    isCheckingRegistration,
    isRequestingRegistrationCode,
    isVerifyingRegistrationCode,
    isRegisteringPhoneNumber,
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
  const outboundErrorPayload = parseSandboxErrorPayload(settings?.last_outbound_error ?? settings?.connectivity_outbound_error);
  const inboundErrorPayload = parseSandboxErrorPayload(settings?.inbound_error);
  const outboundSandboxBlocked = outboundStatus === "blocked_sandbox" || outboundErrorPayload?.sandbox_blocked === true;
  const inboundSandboxBlocked = inboundStatus === "blocked_sandbox" || inboundErrorPayload?.sandbox_blocked === true;
  const settingsRecord = toRecord(settings);
  const codeVerificationStatus = toStringOrNull(settingsRecord?.code_verification_status) ?? "UNKNOWN";
  const phoneRegistrationStatus = toStringOrNull(settingsRecord?.phone_registration_status) ?? "unknown";
  const registrationError = toStringOrNull(settingsRecord?.registration_error);
  const registrationCheckedAt = toStringOrNull(settingsRecord?.registration_checked_at);
  const otpRequestedAt = toStringOrNull(settingsRecord?.otp_requested_at);
  const otpVerifiedAt = toStringOrNull(settingsRecord?.otp_verified_at);
  const tokenScopeStatus = toStringOrNull(settingsRecord?.token_scope_status) ?? "unknown";

  const registrationReady = isSandbox || phoneRegistrationStatus === "registered";
  const merchantSetupComplete = Boolean(
    (credsStatus === "pass" || settings?.credentials_valid)
      && (webhookStatus === "pass" || settings?.webhook_challenge_valid)
      && (outboundStatus === "pass" || outboundStatus === "blocked_sandbox" || settings?.connectivity_outbound_ok)
      && (inboundStatus === "pass" || inboundStatus === "blocked_sandbox" || settings?.connectivity_inbound_ok)
      && registrationReady,
  );
  const embeddedStepLabel: Record<EmbeddedStatus, string> = {
    idle: "Ready to connect",
    connecting: "Opening Meta signup",
    exchanging: "Exchanging authorization code",
    validating: "Validating account",
    done: "Connection complete",
    error: "Connection failed",
  };
  const embeddedBusy = embeddedStatus === "connecting" || embeddedStatus === "exchanging" || embeddedStatus === "validating";

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
    const recipient = testRecipient.trim();
    if (!recipient) {
      toast.error("Please enter a test recipient number");
      return;
    }
    try {
      const result = await sendTestOutbound(recipient) as { sandbox_blocked?: boolean };
      if (result?.sandbox_blocked) {
        toast.info("Blocked by Meta sandbox constraints; not a code failure.");
      } else {
        toast.success("Test outbound sent");
      }
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Outbound test failed");
    }
  };

  const onCheckInbound = async () => {
    try {
      const result = await checkInboundMarker(testRecipient.trim() || undefined) as { sandbox_blocked?: boolean };
      if (result?.sandbox_blocked) {
        toast.info("Inbound checks are sandbox-limited; webhook verification remains the key signal.");
      } else {
        toast.success("Inbound marker check completed");
      }
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Inbound marker check failed");
    }
  };

  const onGetRegistrationStatus = async () => {
    try {
      await getRegistrationStatus();
      toast.success("Registration status refreshed");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to refresh registration status");
    }
  };

  const onRequestOtp = async () => {
    try {
      const result = await requestRegistrationCode({ code_method: otpMethod, language: otpLanguage.trim() || "en_US" }) as {
        already_verified?: boolean;
      };
      if (result?.already_verified) {
        toast.info("Phone already verified. Proceed to the Register step.");
      } else {
        toast.success(`OTP requested via ${otpMethod}`);
      }
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to request OTP");
    }
  };

  const onVerifyOtp = async () => {
    const code = otpCode.trim();
    if (!/^\d{4,8}$/.test(code)) {
      toast.error("Enter a valid OTP code (4-8 digits).");
      return;
    }
    try {
      await verifyRegistrationCode(code);
      toast.success("OTP verified.");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to verify OTP");
    }
  };

  const onRegisterPhone = async () => {
    const pin = registrationPin.trim();
    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN must be exactly 6 digits.");
      return;
    }
    try {
      await registerPhoneNumber(pin);
      toast.success("Phone registered successfully.");
    } catch (invokeError) {
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to register phone");
    }
  };

  const onEmbeddedSignupConnect = async () => {
    if (!merchantId) return;

    try {
      setEmbeddedStatus("connecting");
      await loadFacebookSdk();
      const redirectUri = getMetaRedirectUri();

      const init = await callEdge<{ ok?: boolean; state?: string; error?: string }>("meta-embedded-signup-init", {
        merchant_id: merchantId,
        redirect_uri: redirectUri,
      });
      const state = init?.state;
      if (!state) throw new Error(init?.error ?? "Could not initialize Meta signup state");
      sessionStorage.setItem(`embudex.meta.state.${merchantId}`, state);

      let hintedWabaId: string | null = null;
      let hintedPhoneId: string | null = null;
      const listener = (event: MessageEvent) => {
        if (!event.origin.includes("facebook.com")) return;
        try {
          const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          const payload = (raw as Record<string, unknown>)?.data ?? raw;
          const parsed = payload as Record<string, unknown>;
          const waba = parsed?.waba_id ?? parsed?.business_account_id ?? parsed?.whatsapp_business_account_id;
          const phone = parsed?.phone_number_id ?? parsed?.phone_id;
          if (typeof waba === "string") hintedWabaId = waba;
          if (typeof phone === "string") hintedPhoneId = phone;
        } catch {
          // Ignore non-JSON payloads from SDK internals.
        }
      };
      window.addEventListener("message", listener);

      let code: string | undefined;
      try {
        const embeddedConfigId = isSandbox
          ? META_EMBEDDED_SIGNUP_CONFIG_ID_SANDBOX
          : getMetaEmbeddedSignupConfigIdProd();
        const authResponse = await new Promise<{ code?: string }>((resolve) => {
          window.FB?.login(
            (response) => resolve({ code: response?.authResponse?.code }),
            {
              config_id: embeddedConfigId,
              response_type: "code",
              override_default_response_type: true,
              extras: { setup: {} },
            },
          );
        });
        code = authResponse.code;
      } finally {
        window.removeEventListener("message", listener);
      }

      if (!code) {
        setEmbeddedStatus("error");
        toast.error("Meta signup was cancelled or did not return an authorization code.");
        return;
      }

      setEmbeddedStatus("exchanging");
      const result = await callEdge<{ ok?: boolean; error?: string }>("meta-embedded-signup-exchange", {
        merchant_id: merchantId,
        code,
        state,
        redirect_uri: redirectUri,
        waba_id: hintedWabaId,
        phone_number_id: hintedPhoneId,
      });
      if (result?.ok === false) throw new Error(result.error ?? "Failed to exchange Meta authorization code");

      setEmbeddedStatus("validating");
      await refreshStatus();
      setEmbeddedStatus("done");
      toast.success("WhatsApp connected successfully.");
    } catch (invokeError) {
      setEmbeddedStatus("error");
      toast.error(invokeError instanceof Error ? invokeError.message : "Failed to connect WhatsApp");
    }
  };

  const onAbortAndLogout = async () => {
    const { error: signOutError } = await signOut();
    if (signOutError) {
      toast.error(signOutError.message || "Failed to log out");
      return;
    }
    navigate("/login", { replace: true });
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
            {isSandbox && (
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">SANDBOX MODE</Badge>
            )}
            {overallBadge}
            {isWizardRoute && (
              <Button variant="ghost" onClick={() => void onAbortAndLogout()}>
                Abort and log out
              </Button>
            )}
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

      {isSandbox && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Sandbox Mode</AlertTitle>
          <AlertDescription>
            This account is running Meta sandbox onboarding. Some outbound/inbound checks can be blocked by Meta constraints.
          </AlertDescription>
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

      {!isSandbox && isWizardRoute && !merchantSetupComplete && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Phone registration required</AlertTitle>
          <AlertDescription>
            Complete OTP verification and phone registration before finishing onboarding.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">Connection identity and credential health.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="md:col-span-2 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Connect with Meta {isSandbox ? "(Sandbox)" : "(Production)"}</CardTitle>
              <CardDescription>
                Use Facebook/Meta Embedded Signup to connect a WhatsApp Business account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={embeddedStatus === "error" ? "destructive" : embeddedStatus === "done" ? "secondary" : "outline"}>
                  {embeddedStepLabel[embeddedStatus]}
                </Badge>
                <Button onClick={() => void onEmbeddedSignupConnect()} disabled={embeddedBusy}>
                  {embeddedBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {(isSandbox ? settings?.whatsapp_sandbox_phone_number_id : settings?.meta_phone_number_id) ? "Reconnect WhatsApp" : "Connect WhatsApp via Meta"}
                </Button>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  {isSandbox ? "Sandbox WABA ID" : "Meta WABA ID"}: {(isSandbox ? settings?.whatsapp_sandbox_waba_id : settings?.meta_waba_id) ?? "Not connected"}
                </p>
                <p>
                  {isSandbox ? "Sandbox Phone Number ID" : "Meta Phone Number ID"}: {(isSandbox ? settings?.whatsapp_sandbox_phone_number_id : settings?.meta_phone_number_id) ?? "Not connected"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Phone Number ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">
                {maskTail(
                  isSandbox
                    ? settings?.whatsapp_sandbox_phone_number_id
                    : (settings?.whatsapp_phone_number_id ?? settings?.meta_phone_number_id),
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">WABA ID</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">
                {maskTail(isSandbox ? settings?.whatsapp_sandbox_waba_id : (settings?.whatsapp_waba_id ?? settings?.meta_waba_id))}
              </p>
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
          <h2 className="text-base font-semibold">Phone Registration</h2>
          <p className="text-sm text-muted-foreground">
            Complete OTP verification and registration for the connected phone number.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registration Status</CardTitle>
            <CardDescription>
              Last checked: {formatTs(registrationCheckedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSandbox && (
              <Alert>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Registration unavailable in sandbox</AlertTitle>
                <AlertDescription>
                  OTP verification and phone registration are only supported for production phone numbers.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {registrationBadge(phoneRegistrationStatus)}
              <Badge variant="outline">Code verification: {codeVerificationStatus}</Badge>
              <Badge variant="outline">Token scopes: {tokenScopeStatus}</Badge>
            </div>
            {registrationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Registration error</AlertTitle>
                <AlertDescription>{registrationError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">OTP Requested At</p>
                <p className="text-sm">{formatTs(otpRequestedAt)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">OTP Verified At</p>
                <p className="text-sm">{formatTs(otpVerifiedAt)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Phone Number ID</p>
                <p className="text-sm font-mono">
                  {maskTail(
                    isSandbox
                      ? settings?.whatsapp_sandbox_phone_number_id
                      : (settings?.whatsapp_phone_number_id ?? settings?.meta_phone_number_id),
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void onGetRegistrationStatus()}
                disabled={isSandbox || isCheckingRegistration}
              >
                {isCheckingRegistration ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Refresh registration status
              </Button>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">1) Request OTP</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={otpMethod === "SMS" ? "default" : "outline"}
                  onClick={() => setOtpMethod("SMS")}
                >
                  SMS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={otpMethod === "VOICE" ? "default" : "outline"}
                  onClick={() => setOtpMethod("VOICE")}
                >
                  VOICE
                </Button>
                <Input
                  className="w-[140px]"
                  value={otpLanguage}
                  onChange={(event) => setOtpLanguage(event.target.value)}
                  placeholder="en_US"
                />
                <Button
                  variant="outline"
                  onClick={() => void onRequestOtp()}
                  disabled={isSandbox || isRequestingRegistrationCode}
                >
                  {isRequestingRegistrationCode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Request OTP
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">2) Verify OTP</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-[180px]"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="OTP code"
                />
                <Button
                  variant="outline"
                  onClick={() => void onVerifyOtp()}
                  disabled={isSandbox || isVerifyingRegistrationCode}
                >
                  {isVerifyingRegistrationCode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Verify code
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">3) Register Phone</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-[180px]"
                  value={registrationPin}
                  onChange={(event) => setRegistrationPin(event.target.value)}
                  placeholder="6-digit PIN"
                />
                <Button onClick={() => void onRegisterPhone()} disabled={isSandbox || isRegisteringPhoneNumber}>
                  {isRegisteringPhoneNumber ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Register
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
              {statusBadge(inboundStatus, "Inbound OK", "Inbound issue", "No inbound yet", "Blocked by Sandbox")}
              <p className="text-xs text-muted-foreground">{formatTs(settings?.last_inbound_at ?? settings?.last_webhook_received_at)}</p>
              {inboundSandboxBlocked && (
                <p className="text-xs text-amber-700">Blocked by Meta sandbox constraints; not a code failure.</p>
              )}
              {settings?.inbound_error && !inboundSandboxBlocked && (
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
              {outboundSandboxBlocked && (
                <p className="text-xs text-amber-700">Blocked by Meta sandbox constraints; not a code failure.</p>
              )}
              {(settings?.last_outbound_error ?? settings?.connectivity_outbound_error) && !outboundSandboxBlocked && (
                <p className="text-xs text-destructive line-clamp-3">{settings?.last_outbound_error ?? settings?.connectivity_outbound_error}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Outbound Status</CardTitle>
            </CardHeader>
            <CardContent>{statusBadge(outboundStatus, "Healthy", "Failing", "Unknown", "Blocked by Sandbox")}</CardContent>
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
          <p className="text-sm text-muted-foreground">
            {isSandbox ? "Template data can be limited in sandbox mode." : "Approval summary and template inventory."}
          </p>
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

        {!isSandbox && templateRows.length > 0 && (
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
