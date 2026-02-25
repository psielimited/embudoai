import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeads, useCreateLead } from "@/hooks/useLeads";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createLeadSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().trim().min(1).default("manual"),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

export default function LeadList() {
  const navigate = useNavigate();
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    mode: "onChange",
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      source: "manual",
    },
  });

  const { leads = [], total, qualified, negotiating, won, lost, isLoading } = useLeads();
  const { data: teamMembers = [] } = useTeamMembers();
  const createLead = useCreateLead();

  const filteredLeads = leads.filter((lead: any) => {
    if (stageFilter === "all") return true;
    return lead.lead_stage === stageFilter;
  });

  const handleCreate = async (form: CreateLeadForm) => {
    try {
      await createLead.mutateAsync({
        full_name: form.full_name,
        phones: form.phone ? [form.phone] : [],
        emails: form.email ? [form.email] : [],
        source: form.source || "manual",
      });
      setCreateOpen(false);
      reset();
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

  const stageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      new: "bg-muted text-muted-foreground border-border",
      contacted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      qualified: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      negotiating: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
      won: "bg-green-500/10 text-green-700 border-green-500/20",
      lost: "bg-red-500/10 text-red-700 border-red-500/20",
    };
    return (
      <Badge variant="outline" className={colors[stage] || colors.new}>
        {stage}
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
      key: "lead_stage",
      header: "Stage",
      render: (l: any) => stageBadge(l.lead_stage || "new"),
    },
    {
      key: "assignee",
      header: "Assignee",
      render: (l: any) => {
        if (!l.assignee_user_id) {
          return <span className="text-muted-foreground">Unassigned</span>;
        }
        const member = teamMembers.find((item) => item.user_id === l.assignee_user_id);
        const label = member?.display_name ?? l.assignee_user_id.slice(0, 8);
        const initials = label
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("");
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {initials || "NA"}
            </span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        );
      },
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
        return <span className="text-muted-foreground">{emails[0] || "-"}</span>;
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
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> New Lead
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-5 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{qualified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Negotiating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{negotiating}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{won}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lost}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "new", label: "New" },
          { value: "contacted", label: "Contacted" },
          { value: "qualified", label: "Qualified" },
          { value: "negotiating", label: "Negotiating" },
          { value: "won", label: "Won" },
          { value: "lost", label: "Lost" },
        ].map((filter) => (
          <Button
            key={filter.value}
            type="button"
            variant={stageFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStageFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredLeads}
        onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
        isLoading={isLoading}
        emptyState={
          <div className="py-16 px-4 text-center space-y-3">
            <EmptyState
              icon={Users}
              title="No leads found"
              description="Create your first lead or import from CSV."
              className="py-0"
            />
            <Button variant="outline" onClick={() => navigate("/imports")}>
              Go to Imports
            </Button>
          </div>
        }
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)}>
            <div className="space-y-3">
              <div>
                <Label>Full Name *</Label>
                <Input {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>
                )}
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="+1234567890" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...register("email")} />
              </div>
              <div>
                <Label>Source</Label>
                <Input {...register("source")} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createLead.isPending || !isValid}>
                {createLead.isPending ? "Creating..." : "Create Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
