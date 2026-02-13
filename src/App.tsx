import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import MerchantList from "@/pages/MerchantList";
import MerchantConversations from "@/pages/MerchantConversations";
import ConversationDetail from "@/pages/ConversationDetail";
import PipelineBoard from "@/pages/PipelineBoard";
import OpportunityDetail from "@/pages/OpportunityDetail";
import AutomationRules from "@/pages/AutomationRules";
import SlaBreaches from "@/pages/SlaBreaches";
import Reports from "@/pages/Reports";
import OrgSettings from "@/pages/OrgSettings";
import OrgUsers from "@/pages/OrgUsers";
import OrgTeams from "@/pages/OrgTeams";
import LeadList from "@/pages/LeadList";
import LeadDetail from "@/pages/LeadDetail";
import ContactList from "@/pages/ContactList";
import ContactDetail from "@/pages/ContactDetail";
import ImportLeads from "@/pages/ImportLeads";
import MerchantSettings from "@/pages/MerchantSettings";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
