import {
  Store, MessageSquare, LayoutDashboard, Kanban, Zap,
  AlertTriangle, FileSpreadsheet, Building2, Users, Shield,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Merchants", url: "/merchants", icon: Store },
  { title: "Automations", url: "/automation", icon: Zap },
  { title: "SLA Breaches", url: "/dashboard/sla", icon: AlertTriangle },
  { title: "Reports", url: "/dashboard/reports", icon: FileSpreadsheet },
];

const orgNav = [
  { title: "Org Settings", url: "/org/settings", icon: Building2 },
  { title: "Users", url: "/org/users", icon: Users },
  { title: "Teams", url: "/org/teams", icon: Shield },
];

export function AppSidebar() {
  const location = useLocation();

  const renderItems = (items: typeof mainNav) =>
    items.map((item) => {
      const isActive = location.pathname === item.url ||
        (item.url !== "/" && location.pathname.startsWith(item.url));
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">EmbudoAI</h1>
            <p className="text-xs text-muted-foreground">CRM Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-4">
            Organization
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(orgNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
