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
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
          <Route path="/pipeline" element={<ProtectedPage><PipelineBoard /></ProtectedPage>} />
          <Route path="/pipeline/opportunities/:opportunityId" element={<ProtectedPage><OpportunityDetail /></ProtectedPage>} />
          <Route path="/automation" element={<ProtectedPage><AutomationRules /></ProtectedPage>} />
          <Route path="/dashboard/sla" element={<ProtectedPage><SlaBreaches /></ProtectedPage>} />
          <Route path="/dashboard/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
          <Route path="/merchants" element={<ProtectedPage><MerchantList /></ProtectedPage>} />
          <Route path="/merchants/:merchantId/conversations" element={<ProtectedPage><MerchantConversations /></ProtectedPage>} />
          <Route path="/merchants/:merchantId/conversations/:conversationId" element={<ProtectedPage><ConversationDetail /></ProtectedPage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
