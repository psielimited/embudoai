import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useActiveOrg, useOrgMembers, useAddOrgMember, useRemoveOrgMember, useUpdateOrgMemberRole } from "@/hooks/useOrg";
import { useOrgs } from "@/hooks/useOrg";
import { callEdge } from "@/lib/edge";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["org_admin", "manager", "rep", "analyst"];

export default function OrgUsers() {
  const { data: activeOrgId } = useActiveOrg();
  const { data: orgs = [] } = useOrgs();
  const { data: members = [], isLoading } = useOrgMembers(activeOrgId ?? undefined);
  const addMember = useAddOrgMember();
  const removeMember = useRemoveOrgMember();
  const updateRole = useUpdateOrgMemberRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("rep");

  const activeOrg = orgs.find(o => o.id === activeOrgId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !email.trim()) return;

    try {
      const found = await callEdge<{ user_id?: string }>("find-user-by-email", { email: email.trim() });
      if (!found.user_id) throw new Error("User not found. They must sign up first.");

      await addMember.mutateAsync({
        org_id: activeOrgId,
        user_id: found.user_id,
        role,
      });
      toast.success("Member added");
      setDialogOpen(false);
      setEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const getDisplayName = (member: any) =>
    member.profiles?.full_name?.trim() || "Unnamed user";

  const getSecondaryLine = (member: any) =>
    typeof member.email === "string" && member.email.trim().length > 0
      ? member.email
      : "Email unavailable";

  const handleRemoveMember = async () => {
    if (!activeOrgId || !removeUserId) return;
    try {
      await removeMember.mutateAsync({ org_id: activeOrgId, user_id: removeUserId });
      toast.success("Member removed");
      setRemoveUserId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageHeader
        title="Organization Users"
        description={activeOrg ? `Managing ${activeOrg.name}` : "Manage your organization members"}
      />

      <div className="mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </div>

      <div className="space-y-2">
        {members.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No members found.
            </CardContent>
          </Card>
        )}

        {members.map((m: any) => (
          <Card key={m.user_id}>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">{getDisplayName(m)}</p>
                  <p className="text-xs text-muted-foreground">{getSecondaryLine(m)}</p>
                </div>
                <Select
                  value={m.role}
                  onValueChange={(newRole) => {
                    if (activeOrgId) {
                      updateRole.mutate({ org_id: activeOrgId, user_id: m.user_id, role: newRole });
                    }
                  }}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => setRemoveUserId(m.user_id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Organization Member</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>User Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
              <p className="text-xs text-muted-foreground mt-1">User must have already signed up</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMember.isPending}>
                {addMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeUserId} onOpenChange={(open) => !open && setRemoveUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will lose access to the organization workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleRemoveMember()}
            >
              {removeMember.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
