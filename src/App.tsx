import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return React.lazy(() =>
    factory().catch((err) => {
      // If chunk fails to load, reload the page once
      const key = "chunk_reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves, page will reload
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}

const LandingPage = lazyRetry(() => import("@/pages/LandingPage"));
const PricingPage = lazyRetry(() => import("@/pages/PricingPage"));
const Signup = lazyRetry(() => import("@/pages/Signup"));
const Billing = lazyRetry(() => import("@/pages/Billing"));
const AuthCallback = lazyRetry(() => import("@/pages/AuthCallback"));
const PrivacyPolicy = lazyRetry(() => import("@/pages/PrivacyPolicy"));
const DataDeletionPolicy = lazyRetry(() => import("@/pages/DataDeletionPolicy"));
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const MerchantList = lazyRetry(() => import("@/pages/MerchantList"));
const MerchantConversations = lazyRetry(() => import("@/pages/MerchantConversations"));
const ConversationDetail = lazyRetry(() => import("@/pages/ConversationDetail"));
const PipelineBoard = lazyRetry(() => import("@/pages/PipelineBoard"));
const PipelineSettings = lazyRetry(() => import("@/pages/PipelineSettings"));
const OpportunityDetail = lazyRetry(() => import("@/pages/OpportunityDetail"));
const AutomationRules = lazyRetry(() => import("@/pages/AutomationRules"));
const SlaBreaches = lazyRetry(() => import("@/pages/SlaBreaches"));
const Reports = lazyRetry(() => import("@/pages/Reports"));
const OpsConsole = lazyRetry(() => import("@/pages/OpsConsole"));
const OrgSettings = lazyRetry(() => import("@/pages/OrgSettings"));
const OrgUsers = lazyRetry(() => import("@/pages/OrgUsers"));
const OrgTeams = lazyRetry(() => import("@/pages/OrgTeams"));
const LeadList = lazyRetry(() => import("@/pages/LeadList"));
const LeadDetail = lazyRetry(() => import("@/pages/LeadDetail"));
const ContactList = lazyRetry(() => import("@/pages/ContactList"));
const ContactDetail = lazyRetry(() => import("@/pages/ContactDetail"));
const Conversations = lazyRetry(() => import("@/pages/Conversations"));
const ImportLeads = lazyRetry(() => import("@/pages/ImportLeads"));
const MerchantSettings = lazyRetry(() => import("@/pages/MerchantSettings"));
const Onboarding = lazyRetry(() => import("@/pages/Onboarding"));
const Login = lazyRetry(() => import("@/pages/Login"));
const NotFound = lazyRetry(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedDashboard({
  children,
  bypassSubscriptionGuard = false,
}: {
  children: React.ReactNode;
  bypassSubscriptionGuard?: boolean;
}) {
  return (
    <ProtectedRoute>
      <SubscriptionGuard bypass={bypassSubscriptionGuard}>
        <DashboardLayout>{children}</DashboardLayout>
      </SubscriptionGuard>
    </ProtectedRoute>
  );
}

function ProtectedOnboarding({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <SubscriptionGuard>{children}</SubscriptionGuard>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
            <Route path="/pricing" element={<PublicLayout><PricingPage /></PublicLayout>} />
            <Route path="/privacy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
            <Route path="/data-deletion" element={<PublicLayout><DataDeletionPolicy /></PublicLayout>} />
            <Route path="/billing" element={<ProtectedDashboard><Billing /></ProtectedDashboard>} />
            <Route path="/onboarding" element={<ProtectedOnboarding><Navigate to="/onboarding/organization" replace /></ProtectedOnboarding>} />
            <Route path="/onboarding/organization" element={<ProtectedOnboarding><Onboarding /></ProtectedOnboarding>} />
            <Route path="/onboarding/whatsapp/:merchantId/:wizardStep" element={<ProtectedOnboarding><MerchantSettings /></ProtectedOnboarding>} />
            <Route path="/dashboard" element={<ProtectedDashboard><Dashboard /></ProtectedDashboard>} />
            <Route path="/pipeline" element={<ProtectedDashboard><PipelineBoard /></ProtectedDashboard>} />
            <Route path="/pipeline/settings" element={<ProtectedDashboard><PipelineSettings /></ProtectedDashboard>} />
            <Route path="/pipeline/opportunities/:opportunityId" element={<ProtectedDashboard><OpportunityDetail /></ProtectedDashboard>} />
            <Route path="/automation" element={<ProtectedDashboard><AutomationRules /></ProtectedDashboard>} />
            <Route path="/dashboard/sla" element={<ProtectedDashboard><SlaBreaches /></ProtectedDashboard>} />
            <Route path="/dashboard/reports" element={<ProtectedDashboard><Reports /></ProtectedDashboard>} />
            <Route path="/ops" element={<ProtectedDashboard><OpsConsole /></ProtectedDashboard>} />
            <Route path="/org/settings" element={<ProtectedDashboard><OrgSettings /></ProtectedDashboard>} />
            <Route path="/org/users" element={<ProtectedDashboard><OrgUsers /></ProtectedDashboard>} />
            <Route path="/org/teams" element={<ProtectedDashboard><OrgTeams /></ProtectedDashboard>} />
            <Route path="/merchants" element={<ProtectedDashboard><MerchantList /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/conversations" element={<ProtectedDashboard><MerchantConversations /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/conversations/:conversationId" element={<ProtectedDashboard><ConversationDetail /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/settings" element={<ProtectedOnboarding><MerchantSettings /></ProtectedOnboarding>} />
            <Route path="/leads" element={<ProtectedDashboard><LeadList /></ProtectedDashboard>} />
            <Route path="/leads/:leadId" element={<ProtectedDashboard><LeadDetail /></ProtectedDashboard>} />
            <Route path="/contacts" element={<ProtectedDashboard><ContactList /></ProtectedDashboard>} />
            <Route path="/contacts/:contactId" element={<ProtectedDashboard><ContactDetail /></ProtectedDashboard>} />
            <Route path="/conversations" element={<ProtectedDashboard><Conversations /></ProtectedDashboard>} />
            <Route path="/imports" element={<ProtectedDashboard><ImportLeads /></ProtectedDashboard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
