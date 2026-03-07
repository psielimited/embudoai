import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

const knownPlans: Record<string, { label: string; trial: string }> = {
  free: { label: "Free", trial: "No trial, starts active" },
  starter: { label: "Starter", trial: "7-day trial included" },
  growth: { label: "Growth", trial: "7-day trial included" },
  pro: { label: "Pro", trial: "7-day trial included" },
};

export default function Signup() {
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      localStorage.setItem("embudex.signup_plan", planParam);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?plan=${encodeURIComponent(planParam)}`,
        },
      });

      if (error) throw error;

      toast.success("Check your email to confirm your account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <section className="auth-form-panel">
          <div className="auth-form-wrap">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Create your Embudex account</h1>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 text-slate-700">
                  {selectedPlan.label}
                </Badge>
                <span className="text-sm text-slate-600">{selectedPlan.trial}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={async () => {
                setIsGoogleLoading(true);
                localStorage.setItem("embudex.signup_plan", planParam);
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: `${window.location.origin}/auth/callback?plan=${encodeURIComponent(planParam)}`,
                });
                if (error) {
                  toast.error(error.message);
                  setIsGoogleLoading(false);
                }
              }}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue with Google
            </Button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-slate-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="auth-divider px-3 text-slate-500">Or sign up with email</span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="E-mail"
                    className="h-14 rounded-xl border-slate-300 bg-white pl-12 text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="sr-only">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    className="h-14 rounded-xl border-slate-300 bg-white pl-12 text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="sr-only">
                  Confirm password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    className="h-14 rounded-xl border-slate-300 bg-white pl-12 text-base"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="h-14 w-full rounded-xl text-lg font-semibold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign up
              </Button>

              <p className="text-center text-base text-slate-600">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-slate-900 underline underline-offset-4">
                  Sign in
                </Link>
              </p>

              <p className="text-center text-sm text-slate-500">
                By continuing, you agree to the trial and provisioning policy for your selected plan.
              </p>
              <p className="text-center text-sm text-slate-500">
                Need plan details?{" "}
                <Link to="/pricing" className="font-medium text-slate-700 underline underline-offset-4">
                  Back to pricing
                </Link>
              </p>
            </form>
          </div>
        </section>

        <aside className="auth-visual-panel hidden lg:flex">
          <div className="auth-shooting-star" />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col justify-center text-white">
            <h2 className="mb-8 text-center text-5xl font-semibold leading-tight">
              Build your AI sales engine.
              <br />
              Launch in minutes with Embudex.
            </h2>
            <div className="mb-12 text-center text-sm uppercase tracking-[0.3em] text-slate-200/80">Automate replies. Keep human control.</div>
            <div className="auth-metric-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Conversations handled this month</p>
              <p className="mt-4 text-5xl font-semibold">12,480</p>
              <p className="mt-1 text-base text-slate-300">March</p>
              <div className="mt-10 grid grid-cols-5 text-sm text-slate-300">
                <span>01</span>
                <span className="text-center">07</span>
                <span className="text-center">14</span>
                <span className="text-center">21</span>
                <span className="text-right">28</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
