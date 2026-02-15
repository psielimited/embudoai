import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useActiveOrg, useTeams, useTeamMembers, useOrgMembers,
  useCreateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember,
} from "@/hooks/useOrg";
import { Loader2, Plus, Trash2, Users, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function TeamCard({ team, orgId }: { team: any; orgId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: members = [], isLoading } = useTeamMembers(expanded ? team.id : undefined);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isManager, setIsManager] = useState(false);

  const getDisplayName = (member: any) =>
    member.profiles?.full_name?.trim() || "Unnamed user";

  const getSecondaryLine = (member: any) =>
    typeof member.email === "string" && member.email.trim().length > 0
      ? member.email
      : "Email unavailable";

  const availableUsers = orgMembers.filter(
    (om: any) => !members.some((m: any) => m.user_id === om.user_id)
  );

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-medium">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Users className="h-4 w-4 text-muted-foreground" />
            {team.name}
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Member
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pl-6 space-y-1">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {members.length === 0 && !isLoading && (
              <p className="text-xs text-muted-foreground">No members</p>
            )}
            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm">{getDisplayName(m)}</p>
                    <p className="text-xs text-muted-foreground">{getSecondaryLine(m)}</p>
                  </div>
                  {m.is_team_manager && <Badge variant="secondary" className="text-[10px]">Manager</Badge>}
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                  removeMember.mutate({ team_id: team.id, user_id: m.user_id });
                }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.profiles?.full_name?.trim() || "Unnamed user"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isManager} onCheckedChange={setIsManager} />
                <Label>Team Manager</Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!selectedUserId) return;
                  addMember.mutate({ team_id: team.id, user_id: selectedUserId, is_team_manager: isManager });
                  setAddOpen(false);
                  setSelectedUserId("");
                  setIsManager(false);
                }}>
                  Add
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete team {team.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the team and its member assignments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deleteTeam.mutate({ id: team.id, org_id: orgId });
                  setDeleteOpen(false);
                }}
              >
                Delete Team
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default function OrgTeams() {
  const { data: activeOrgId } = useActiveOrg();
  const { data: teams = [], isLoading } = useTeams(activeOrgId ?? undefined);
  const createTeam = useCreateTeam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !name.trim()) return;
    try {
      await createTeam.mutateAsync({ org_id: activeOrgId, name: name.trim() });
      toast.success("Team created");
      setDialogOpen(false);
      setName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create team");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageHeader title="Teams" description="Manage teams within your organization" />

      <div className="mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Team
        </Button>
      </div>

      <div className="space-y-2">
        {teams.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No teams yet. Create one to get started.
            </CardContent>
          </Card>
        )}
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} orgId={activeOrgId!} />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
