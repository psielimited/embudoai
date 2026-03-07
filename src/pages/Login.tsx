import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, Mail, Lock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCanResendConfirmation(false);
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message ?? "Login failed";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setCanResendConfirmation(true);
        toast.error("Email not confirmed. Please confirm your inbox link.");
      } else if (msg.toLowerCase().includes("invalid login credentials")) {
        toast.error("Invalid login credentials.");
      } else {
        toast.error(msg);
      }
    } else {
      toast.success("Welcome back");
    }
    setIsSubmitting(false);
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email resent.");
    }
    setIsResending(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (error) {
      toast.error(error.message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <section className="auth-form-panel">
          <div className="auth-form-wrap">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Welcome back to Embudex</h1>
              <p className="mt-3 text-sm text-slate-600">Sign in to continue managing conversations and pipeline in one place.</p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={handleGoogleSignIn}
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
                <span className="auth-divider px-3 text-slate-500">Or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="sr-only">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-xl border-slate-300 bg-white pl-12 text-base"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="sr-only">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-xl border-slate-300 bg-white pl-12 text-base"
                    required
                  />
                </div>
              </div>

              <div className="text-center text-sm text-slate-600">
                Use the same account you used during onboarding.
              </div>

              <Button type="submit" className="h-14 w-full rounded-xl text-lg font-semibold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>

              {canResendConfirmation && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full rounded-xl"
                  disabled={isResending}
                  onClick={handleResendConfirmation}
                >
                  {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Resend confirmation email
                </Button>
              )}

              <p className="text-center text-base text-slate-600">
                Don&apos;t have an account yet?{" "}
                <Link to="/signup" className="font-semibold text-slate-900 underline underline-offset-4">
                  Sign up
                </Link>
              </p>
              <p className="text-center text-sm text-slate-500">
                Need a plan first?{" "}
                <Link to="/pricing" className="font-medium text-slate-700 underline underline-offset-4">
                  Start free trial
                </Link>
              </p>
            </form>
          </div>
        </section>

        <aside className="auth-visual-panel hidden lg:flex">
          <div className="auth-shooting-star" />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col justify-center text-white">
            <h2 className="mb-8 text-center text-5xl font-semibold leading-tight">
              Run smarter conversations.
              <br />
              Close more deals with Embudex.
            </h2>
            <div className="mb-12 text-center text-sm uppercase tracking-[0.3em] text-slate-200/80">CRM + WhatsApp automation</div>
            <div className="auth-metric-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Qualified pipeline this month</p>
              <p className="mt-4 text-5xl font-semibold">$48,260</p>
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
