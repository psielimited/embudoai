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
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PipelineBoard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline/opportunities/:opportunityId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OpportunityDetail />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AutomationRules />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchants"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MerchantList />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchants/:merchantId/conversations"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MerchantConversations />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchants/:merchantId/conversations/:conversationId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ConversationDetail />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
