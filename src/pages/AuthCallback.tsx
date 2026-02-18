import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

async function resolveDestination() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const activeOrgId = profile?.active_org_id ?? null;
  if (!activeOrgId) return "/onboarding";

  const { count } = await supabase
    .from("merchants")
    .select("id", { count: "exact", head: true })
    .eq("org_id", activeOrgId);

  if ((count ?? 0) === 0) return "/onboarding";

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id,status,created_at")
    .eq("org_id", activeOrgId)
    .order("created_at", { ascending: true });

  const primaryMerchant = (merchants ?? []).find((merchant) => merchant.status === "active") ?? merchants?.[0] ?? null;
  if (!primaryMerchant) return "/onboarding";

  const { data: settings } = await supabase
    .from("merchant_settings")
    .select("onboarding_step,credentials_valid,webhook_challenge_valid,connectivity_outbound_ok,connectivity_inbound_ok")
    .eq("merchant_id", primaryMerchant.id)
    .eq("org_id", activeOrgId)
    .maybeSingle();

  const merchantSetupComplete = Boolean(
    settings
      && settings.onboarding_step >= 3
      && settings.credentials_valid
      && settings.webhook_challenge_valid
      && settings.connectivity_outbound_ok
      && settings.connectivity_inbound_ok,
  );

  return merchantSetupComplete ? "/merchants" : `/merchants/${primaryMerchant.id}/settings`;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      await supabase.auth.getSession();

      const plan = searchParams.get("plan");
      if (plan) {
        localStorage.setItem("embudex.signup_plan", plan);
      }

      const destination = await resolveDestination();
      navigate(destination, { replace: true });
    };

    void run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
