import {
  Store, MessageSquare, LayoutDashboard, Kanban, Zap,
  AlertTriangle, FileSpreadsheet, Building2, Users, Shield, SlidersHorizontal,
  UserPlus, Contact2, Upload, CreditCard,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useConversationUnreadCounts } from "@/hooks/useConversations";
import { useActiveOrg, useOrgs } from "@/hooks/useOrg";

const crmNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Conversations", url: "/conversations", icon: MessageSquare },
  { title: "Leads", url: "/leads", icon: UserPlus },
  { title: "Contacts", url: "/contacts", icon: Contact2 },
  { title: "Merchants", url: "/merchants", icon: Store },
];

const pipelineNav = [
  { title: "Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Pipeline Settings", url: "/pipeline/settings", icon: SlidersHorizontal },
  { title: "Automations", url: "/automation", icon: Zap },
];

const monitoringNav = [
  { title: "SLA Breaches", url: "/dashboard/sla", icon: AlertTriangle },
  { title: "Reports", url: "/dashboard/reports", icon: FileSpreadsheet },
  { title: "Ops Console", url: "/ops", icon: AlertTriangle },
  { title: "Imports", url: "/imports", icon: Upload },
];

const orgNav = [
  { title: "Org Settings", url: "/org/settings", icon: Building2 },
  { title: "Users", url: "/org/users", icon: Users },
  { title: "Teams", url: "/org/teams", icon: Shield },
  { title: "Billing", url: "/billing", icon: CreditCard },
];

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppSidebar() {
  const location = useLocation();
  const { data: unreadCounts } = useConversationUnreadCounts();
  const { data: activeOrgId } = useActiveOrg();
  const { data: orgs = [] } = useOrgs();
  const activeOrg = orgs.find((org) => org.id === activeOrgId) ?? null;
  const isDemoOrg = /\bdemo\b/i.test(activeOrg?.name ?? "");

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const isActive = location.pathname === item.url ||
        (item.url !== "/" && !items.some(other => other.url !== item.url && other.url.startsWith(item.url) && location.pathname.startsWith(other.url)) && location.pathname.startsWith(item.url));
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild tooltip={item.title}>
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
              <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
              {item.url === "/conversations" && (unreadCounts?.totalUnread ?? 0) > 0 && (
                <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden">
                  {unreadCounts?.totalUnread}
                </Badge>
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sidebar-foreground">Embudex</h1>
              {isDemoOrg && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                  Demo Mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{activeOrg?.name ?? "CRM Dashboard"}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
            CRM
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(crmNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-4">
            Pipeline
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(pipelineNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-4">
            Monitoring
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(monitoringNav)}</SidebarMenu>
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
