import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Globe, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { callEdge } from "@/lib/edge";
import { invalidateActiveOrgCache } from "@/lib/auth";

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [country, setCountry] = useState("Dominican Republic");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [provisioningStep, setProvisioningStep] = useState(0);

  const plan = useMemo(() => localStorage.getItem("embudex.signup_plan") ?? "free", []);
  const provisioningMessages = useMemo(
    () => [
      "Creating your organization",
      "Applying organization settings",
      "Creating your merchant workspace",
      "Finalizing your onboarding profile",
      "Preparing your merchants workspace",
      "Preparing your workspace…",
    ],
    [],
  );

  useEffect(() => {
    const checkExisting = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const activeOrgId = profile?.active_org_id ?? null;
      if (activeOrgId) {
        const { data: existingMerchant } = await supabase
          .from("merchants")
          .select("id")
          .eq("org_id", activeOrgId);
        const merchantId = existingMerchant?.[0]?.id;
        if (merchantId) {
          navigate(`/merchants/${merchantId}/settings`, { replace: true });
          return;
        }
      }

      setIsLoading(false);
    };

    void checkExisting();
  }, [navigate, user]);

  const handleProvision = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setProvisioningStep(0);
    try {
      const result = await callEdge<{ org_id?: string }>("provision-org-and-merchant", {
        plan,
        org_name: orgName.trim(),
        merchant_name: merchantName.trim(),
        country: country.trim(),
        timezone: timezone.trim(),
      });
      setProvisioningStep(3);
      invalidateActiveOrgCache();
      localStorage.removeItem("embudex.signup_plan");
      setProvisioningStep(4);

      const orgId = result?.org_id ?? (await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("user_id", user?.id ?? "")
        .maybeSingle()).data?.active_org_id;

      let provisionedMerchantId: string | null = null;
      if (orgId) {
        const start = Date.now();
        let ready = false;
        while (Date.now() - start < 10_000) {
          const { data: merchants, error } = await supabase
            .from("merchants")
            .select("id")
            .eq("org_id", orgId);
          const merchantId = merchants?.[0]?.id ?? null;
          if (!error && merchantId) {
            provisionedMerchantId = merchantId;
            ready = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!ready) {
          throw new Error("Workspace is still provisioning. Please try again in a moment.");
        }
      }

      // Step 5: Invalidate SubscriptionGuard queries so it sees fresh data
      setProvisioningStep(5);
      queryClient.removeQueries({ queryKey: ["onboarding-merchant-count"] });
      queryClient.removeQueries({ queryKey: ["merchant-onboarding-guard"] });
      queryClient.removeQueries({ queryKey: ["active-org"] });

      // Pre-fill the cache so SubscriptionGuard doesn't redirect back
      if (orgId) {
        queryClient.setQueryData(["onboarding-merchant-count", orgId], 1);
      }

      // Brief delay to let guard settle before navigation
      await new Promise((resolve) => setTimeout(resolve, 600));

      toast.success("Workspace setup complete.");
      navigate(
        provisionedMerchantId ? `/merchants/${provisionedMerchantId}/settings` : "/merchants",
        { replace: true },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provisioning failed");
      setProvisioningStep(0);
      setIsSubmitting(false);
      return;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Setting up your workspace</CardTitle>
              <CardDescription>
                This usually takes a few seconds. Do not close this tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {provisioningMessages.map((message, index) => {
                const isDone = index < provisioningStep;
                const isActive = index === provisioningStep;
                return (
                  <div key={message} className="flex items-center gap-2 text-sm">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className={isActive ? "text-foreground font-medium" : "text-muted-foreground"}>{message}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding - Step 1: Organization Setup</CardTitle>
            <CardDescription>
              Confirm your workspace details. Org and default merchant are created after email confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What should I enter?</p>
              <p>
                <span className="font-medium">Organization name</span>: your company/workspace name (example:{" "}
                <span className="italic">Mindose Media Group</span>).
              </p>
              <p>
                <span className="font-medium">Merchant / business name</span>: the specific brand/store that will receive WhatsApp conversations
                (example: <span className="italic">Psi E-Limited</span> or <span className="italic">Acme Downtown Store</span>).
              </p>
            </div>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProvision}>
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="org-name"
                    className="pl-10"
                    placeholder="Mindose Media Group"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This is your main workspace. You can add multiple merchants under one organization.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant-name">Merchant / business name</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="merchant-name"
                    className="pl-10"
                    placeholder="Psi E-Limited"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This is the first WhatsApp-connected business profile in your organization.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="country" className="pl-10" value={country} onChange={(e) => setCountry(e.target.value)} required />
                </div>
                <p className="text-xs text-muted-foreground">Used for WhatsApp setup hints and regional defaults.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Used for SLA timers, reports, and message timestamps.</p>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
