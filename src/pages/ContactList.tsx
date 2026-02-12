import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Contact2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useContacts } from "@/hooks/useContacts";

export default function ContactList() {
  const navigate = useNavigate();
  const { data: contacts = [], isLoading } = useContacts();

  const columns = [
    {
      key: "full_name",
      header: "Name",
      render: (c: any) => <span className="font-medium text-foreground">{c.full_name}</span>,
    },
    {
      key: "emails",
      header: "Email",
      render: (c: any) => {
        const emails: string[] = Array.isArray(c.emails) ? c.emails : [];
        return <span className="text-muted-foreground">{emails[0] || "—"}</span>;
      },
    },
    {
      key: "phones",
      header: "Phone",
      render: (c: any) => {
        const phones: string[] = Array.isArray(c.phones) ? c.phones : [];
        return <span className="text-muted-foreground">{phones[0] || "—"}</span>;
      },
    },
    {
      key: "doc_id",
      header: "Doc ID",
      render: (c: any) => <span className="text-muted-foreground">{c.doc_id || "—"}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      render: (c: any) => (
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
      />
      <DataTable
        columns={columns}
        data={contacts}
        onRowClick={(c) => navigate(`/contacts/${c.id}`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Contact2}
            title="No contacts yet"
            description="Contacts are created when you convert a lead."
          />
        }
      />
    </>
  );
}
