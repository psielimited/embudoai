import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageSkeleton } from "@/components/PageSkeleton";

const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const MerchantList = React.lazy(() => import("@/pages/MerchantList"));
const MerchantConversations = React.lazy(() => import("@/pages/MerchantConversations"));
const ConversationDetail = React.lazy(() => import("@/pages/ConversationDetail"));
const PipelineBoard = React.lazy(() => import("@/pages/PipelineBoard"));
const PipelineSettings = React.lazy(() => import("@/pages/PipelineSettings"));
const OpportunityDetail = React.lazy(() => import("@/pages/OpportunityDetail"));
const AutomationRules = React.lazy(() => import("@/pages/AutomationRules"));
const SlaBreaches = React.lazy(() => import("@/pages/SlaBreaches"));
const Reports = React.lazy(() => import("@/pages/Reports"));
const OrgSettings = React.lazy(() => import("@/pages/OrgSettings"));
const OrgUsers = React.lazy(() => import("@/pages/OrgUsers"));
const OrgTeams = React.lazy(() => import("@/pages/OrgTeams"));
const LeadList = React.lazy(() => import("@/pages/LeadList"));
const LeadDetail = React.lazy(() => import("@/pages/LeadDetail"));
const ContactList = React.lazy(() => import("@/pages/ContactList"));
const ContactDetail = React.lazy(() => import("@/pages/ContactDetail"));
const Conversations = React.lazy(() => import("@/pages/Conversations"));
const ImportLeads = React.lazy(() => import("@/pages/ImportLeads"));
const MerchantSettings = React.lazy(() => import("@/pages/MerchantSettings"));
const Login = React.lazy(() => import("@/pages/Login"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));

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

function ProtectedDashboard({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
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
            <Route path="/" element={<ProtectedDashboard><Dashboard /></ProtectedDashboard>} />
            <Route path="/pipeline" element={<ProtectedDashboard><PipelineBoard /></ProtectedDashboard>} />
            <Route path="/pipeline/settings" element={<ProtectedDashboard><PipelineSettings /></ProtectedDashboard>} />
            <Route path="/pipeline/opportunities/:opportunityId" element={<ProtectedDashboard><OpportunityDetail /></ProtectedDashboard>} />
            <Route path="/automation" element={<ProtectedDashboard><AutomationRules /></ProtectedDashboard>} />
            <Route path="/dashboard/sla" element={<ProtectedDashboard><SlaBreaches /></ProtectedDashboard>} />
            <Route path="/dashboard/reports" element={<ProtectedDashboard><Reports /></ProtectedDashboard>} />
            <Route path="/org/settings" element={<ProtectedDashboard><OrgSettings /></ProtectedDashboard>} />
            <Route path="/org/users" element={<ProtectedDashboard><OrgUsers /></ProtectedDashboard>} />
            <Route path="/org/teams" element={<ProtectedDashboard><OrgTeams /></ProtectedDashboard>} />
            <Route path="/merchants" element={<ProtectedDashboard><MerchantList /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/conversations" element={<ProtectedDashboard><MerchantConversations /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/conversations/:conversationId" element={<ProtectedDashboard><ConversationDetail /></ProtectedDashboard>} />
            <Route path="/merchants/:merchantId/settings" element={<ProtectedDashboard><MerchantSettings /></ProtectedDashboard>} />
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
