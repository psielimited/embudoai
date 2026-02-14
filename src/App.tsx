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

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<P><Dashboard /></P>} />
            <Route path="/pipeline" element={<P><PipelineBoard /></P>} />
            <Route path="/pipeline/opportunities/:opportunityId" element={<P><OpportunityDetail /></P>} />
            <Route path="/automation" element={<P><AutomationRules /></P>} />
            <Route path="/dashboard/sla" element={<P><SlaBreaches /></P>} />
            <Route path="/dashboard/reports" element={<P><Reports /></P>} />
            <Route path="/org/settings" element={<P><OrgSettings /></P>} />
            <Route path="/org/users" element={<P><OrgUsers /></P>} />
            <Route path="/org/teams" element={<P><OrgTeams /></P>} />
            <Route path="/merchants" element={<P><MerchantList /></P>} />
            <Route path="/merchants/:merchantId/conversations" element={<P><MerchantConversations /></P>} />
            <Route path="/merchants/:merchantId/conversations/:conversationId" element={<P><ConversationDetail /></P>} />
            <Route path="/merchants/:merchantId/settings" element={<P><MerchantSettings /></P>} />
            <Route path="/leads" element={<P><LeadList /></P>} />
            <Route path="/leads/:leadId" element={<P><LeadDetail /></P>} />
            <Route path="/contacts" element={<P><ContactList /></P>} />
            <Route path="/contacts/:contactId" element={<P><ContactDetail /></P>} />
            <Route path="/imports" element={<P><ImportLeads /></P>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
