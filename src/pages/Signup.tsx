import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, Building2, Store, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { callEdge } from "@/lib/edge";
import { invalidateActiveOrgCache } from "@/lib/auth";

const knownPlans: Record<string, { label: string; trial: string }> = {
  free: { label: "Free", trial: "No trial, starts active" },
  starter: { label: "Starter", trial: "7-day trial included" },
  growth: { label: "Growth", trial: "7-day trial included" },
  pro: { label: "Pro", trial: "7-day trial included" },
};

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [country, setCountry] = useState("Dominican Republic");

  const planParam = (searchParams.get("plan") ?? "free").toLowerCase();
  const selectedPlan = useMemo(() => knownPlans[planParam] ?? { label: planParam, trial: "Trial policy by plan" }, [planParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const signUpRes = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpRes.error) {
        throw signUpRes.error;
      }

      if (!signUpRes.data.session) {
        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        if (signInRes.error) {
          throw signInRes.error;
        }
      }

      await callEdge("bootstrap-signup", {
        plan: planParam,
        org_name: orgName.trim(),
        merchant_name: merchantName.trim(),
        country: country.trim(),
      });

      invalidateActiveOrgCache();
      toast.success("Account created. Let’s connect WhatsApp.");
      navigate("/onboarding", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl">Start Free Trial</CardTitle>
            <Badge variant="outline">{selectedPlan.label}</Badge>
          </div>
          <CardDescription>
            Create your Embudex workspace. {selectedPlan.trial}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  className="pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="org-name" className="pl-10" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant-name">Business name</Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="merchant-name" className="pl-10" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} required />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="country">Country</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="country" className="pl-10" value={country} onChange={(e) => setCountry(e.target.value)} required />
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create workspace
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/pricing">Back to pricing</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
