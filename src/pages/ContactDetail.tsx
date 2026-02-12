import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContact } from "@/hooks/useContacts";

export default function ContactDetail() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(contactId);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!contact) return <p className="text-muted-foreground">Contact not found</p>;

  const phones = (Array.isArray(contact.phones) ? contact.phones : []) as string[];
  const emails = (Array.isArray(contact.emails) ? contact.emails : []) as string[];
  const tags = (Array.isArray(contact.tags) ? contact.tags : []) as string[];

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contacts
        </Button>
      </div>

      <PageHeader title={contact.full_name} description={`Doc ID: ${contact.doc_id || "—"}`} />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phones</span>
              <span>{phones.length > 0 ? phones.join(", ") : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emails</span>
              <span>{emails.length > 0 ? emails.join(", ") : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(contact.created_at), "MMM d, yyyy HH:mm")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tags & Addresses</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-1 flex-wrap">
              {tags.length > 0 ? tags.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
              )) : <span className="text-muted-foreground">No tags</span>}
            </div>
            <div>
              <span className="text-muted-foreground">Addresses:</span>
              <pre className="text-xs mt-1 bg-muted p-2 rounded">
                {JSON.stringify(contact.addresses, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
