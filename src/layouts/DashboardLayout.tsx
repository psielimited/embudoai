import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { GlobalPlanBanner } from "@/components/GlobalPlanBanner";
import { UsageMeter } from "@/components/UsageMeter";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <OrgSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <UsageMeter />
              <NotificationBell />
              <UserMenu />
            </div>
          </header>
          <GlobalPlanBanner />
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
