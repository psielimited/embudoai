import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Contact2, Plus } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useContacts, useCreateContact, type ContactRow } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const createContactSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
});

type CreateContactForm = z.infer<typeof createContactSchema>;

export default function ContactList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: contacts = [], isLoading } = useContacts();
  const createContact = useCreateContact();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateContactForm>({
    resolver: zodResolver(createContactSchema),
    mode: "onChange",
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
    },
  });

  const handleCreate = async (form: CreateContactForm) => {
    try {
      const newContact = await createContact.mutateAsync({
        full_name: form.full_name,
        phones: form.phone?.trim() ? [form.phone.trim()] : [],
        emails: form.email?.trim() ? [form.email.trim()] : [],
      });
      toast.success("Contact created");
      setCreateOpen(false);
      reset();
      navigate(`/contacts/${newContact.id}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create contact");
    }
  };

  const columns = [
    {
      key: "full_name",
      header: "Name",
      render: (c: ContactRow) => <span className="font-medium text-foreground">{c.full_name}</span>,
    },
    {
      key: "emails",
      header: "Email",
      render: (c: ContactRow) => {
        const emails: string[] = Array.isArray(c.emails) ? (c.emails as string[]) : [];
        return <span className="text-muted-foreground">{emails[0] || "-"}</span>;
      },
    },
    {
      key: "phones",
      header: "Phone",
      render: (c: ContactRow) => {
        const phones: string[] = Array.isArray(c.phones) ? (c.phones as string[]) : [];
        return <span className="text-muted-foreground">{phones[0] || "-"}</span>;
      },
    },
    {
      key: "doc_id",
      header: "Doc ID",
      render: (c: ContactRow) => <span className="text-muted-foreground">{c.doc_id || "-"}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      render: (c: ContactRow) => (
        <span className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Contacts"
        description="View all contacts in your organization"
        breadcrumbs={[{ label: "Contacts" }]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> + New Contact
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={contacts}
        onRowClick={(c) => navigate(`/contacts/${c.id}`)}
        isLoading={isLoading}
        emptyState={
          <div className="py-16 px-4 text-center space-y-3">
            <EmptyState
              icon={Contact2}
              title="No contacts yet"
              description="Create your first contact or import leads to auto-create contacts after conversion."
              className="py-0"
            />
            <Button variant="outline" onClick={() => navigate("/imports")}>
              Import Leads
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
            <DialogTitle>New Contact</DialogTitle>
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
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createContact.isPending || !isValid}>
                {createContact.isPending ? "Creating..." : "Create Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
