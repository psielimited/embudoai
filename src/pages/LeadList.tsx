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
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const { data: leads = [], isLoading } = useLeads(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const createLead = useCreateLead();

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
