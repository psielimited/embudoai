import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, useCreateLead } from "@/hooks/useLeads";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function LeadList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", source: "manual" });

  const { data: leads = [], isLoading } = useLeads(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const createLead = useCreateLead();

  const handleCreate = async () => {
    if (!form.full_name.trim()) return;
    try {
      await createLead.mutateAsync({
        full_name: form.full_name,
        phones: form.phone ? [form.phone] : [],
        emails: form.email ? [form.email] : [],
        source: form.source || "manual",
      });
      setCreateOpen(false);
      setForm({ full_name: "", phone: "", email: "", source: "manual" });
      toast({ title: "Lead created" });
    } catch (err: any) {
      if (err.status === 409) {
        toast({
          title: "Duplicate detected",
          description: `Matches: ${err.data?.candidates?.map((c: any) => c.entity_name).join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-status-open/10 text-status-open border-status-open/20",
      converted: "bg-primary/10 text-primary border-primary/20",
      disqualified: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return (
      <Badge variant="outline" className={colors[status] || ""}>
        {status}
      </Badge>
    );
  };

  const columns = [
    {
      key: "full_name",
      header: "Name",
      render: (l: any) => <span className="font-medium text-foreground">{l.full_name}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (l: any) => statusBadge(l.status),
    },
    {
      key: "source",
      header: "Source",
      render: (l: any) => <span className="text-muted-foreground capitalize">{l.source}</span>,
    },
    {
      key: "emails",
      header: "Email",
      render: (l: any) => {
        const emails: string[] = Array.isArray(l.emails) ? l.emails : [];
        return <span className="text-muted-foreground">{emails[0] || "—"}</span>;
      },
    },
    {
      key: "created_at",
      header: "Created",
      render: (l: any) => (
        <span className="text-muted-foreground">{format(new Date(l.created_at), "MMM d, yyyy")}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        description="Manage your lead pipeline"
        breadcrumbs={[{ label: "Leads" }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> New Lead
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={leads}
        onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Users}
            title="No leads found"
            description="Create your first lead or import from CSV."
          />
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1234567890" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLead.isPending}>
              {createLead.isPending ? "Creating…" : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
