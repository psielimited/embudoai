import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgs, useActiveOrg, useOrgMembers, useTeams } from "@/hooks/useOrg";
import { Loader2, Building2, Users, Shield } from "lucide-react";

export default function OrgSettings() {
  const { data: activeOrgId } = useActiveOrg();
  const { data: orgs = [], isLoading } = useOrgs();
  const { data: members = [] } = useOrgMembers(activeOrgId ?? undefined);
  const { data: teams = [] } = useTeams(activeOrgId ?? undefined);

  const activeOrg = orgs.find(o => o.id === activeOrgId);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageHeader title="Organization Settings" description="View and manage your organization" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organization</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrg?.name || "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ID: {activeOrgId?.slice(0, 8)}...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured teams</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
