import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Globe, Loader2, Store } from "lucide-react";
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
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [country, setCountry] = useState("Dominican Republic");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");

  const plan = useMemo(() => localStorage.getItem("embudex.signup_plan") ?? "free", []);

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
        const { count } = await supabase
          .from("merchants")
          .select("id", { count: "exact", head: true })
          .eq("org_id", activeOrgId);
        if ((count ?? 0) > 0) {
          navigate("/merchants", { replace: true });
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
    try {
      await callEdge("provision-org-and-merchant", {
        plan,
        org_name: orgName.trim(),
        merchant_name: merchantName.trim(),
        country: country.trim(),
        timezone: timezone.trim(),
      });
      invalidateActiveOrgCache();
      localStorage.removeItem("embudex.signup_plan");
      toast.success("Workspace setup complete.");
      navigate("/merchants", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provisioning failed");
    } finally {
      setIsSubmitting(false);
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
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding - Step 1: Organization Setup</CardTitle>
          <CardDescription>
            Confirm your workspace details. Org and default merchant are created after email confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProvision}>
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="org-name" className="pl-10" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant-name">Merchant / business name</Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="merchant-name" className="pl-10" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="country" className="pl-10" value={country} onChange={(e) => setCountry(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
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
  );
}
