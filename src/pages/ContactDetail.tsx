import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyValueList } from "@/components/KeyValueList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import { useConversationsByContact } from "@/hooks/useConversations";
import { toast } from "sonner";

type AddressFields = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
};

function toCsv(values: string[]) {
  return values.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ContactDetail() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(contactId);
  const { data: relatedConversations = [], isLoading: isLoadingConversations } = useConversationsByContact(contactId);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [name, setName] = useState("");
  const [phonesText, setPhonesText] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pendingTag, setPendingTag] = useState("");
  const [address, setAddress] = useState<AddressFields>({
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!contact || initialized) return;

    const contactPhones = Array.isArray(contact.phones) ? (contact.phones as string[]) : [];
    const contactEmails = Array.isArray(contact.emails) ? (contact.emails as string[]) : [];
    const contactTags = Array.isArray(contact.tags) ? (contact.tags as string[]) : [];
    const addresses = Array.isArray(contact.addresses)
      ? (contact.addresses as Array<Record<string, unknown>>)
      : contact.addresses && typeof contact.addresses === "object"
        ? [contact.addresses as Record<string, unknown>]
        : [];
    const firstAddress = addresses[0] ?? {};

    setName(contact.full_name ?? "");
    setPhonesText(toCsv(contactPhones));
    setEmailsText(toCsv(contactEmails));
    setTags(contactTags);
    setAddress({
      line1: String(firstAddress.line1 ?? ""),
      line2: String(firstAddress.line2 ?? ""),
      city: String(firstAddress.city ?? ""),
      region: String(firstAddress.region ?? firstAddress.state ?? ""),
      postal_code: String(firstAddress.postal_code ?? ""),
      country: String(firstAddress.country ?? ""),
    });
    setInitialized(true);
  }, [contact, initialized]);

  const normalizedAddress = useMemo(
    () => ({
      line1: address.line1.trim(),
      line2: address.line2.trim(),
      city: address.city.trim(),
      region: address.region.trim(),
      postal_code: address.postal_code.trim(),
      country: address.country.trim(),
    }),
    [address],
  );

  const hasAddress = Object.values(normalizedAddress).some(Boolean);

  const addTag = () => {
    const next = pendingTag.trim();
    if (!next) return;
    if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setPendingTag("");
      return;
    }
    setTags((current) => [...current, next]);
    setPendingTag("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!contactId) return;
    if (!name.trim()) {
      toast.error("Full name is required");
      return;
    }

    try {
      await updateContact.mutateAsync({
        id: contactId,
        updates: {
          full_name: name.trim(),
          phones: parseCsv(phonesText),
          emails: parseCsv(emailsText),
          tags,
          addresses: hasAddress ? [normalizedAddress] : [],
        },
      });
      toast.success("Contact updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update contact");
    }
  };

  const handleDelete = async () => {
    if (!contactId) return;
    try {
      await deleteContact.mutateAsync(contactId);
      toast.success("Contact deleted");
      navigate("/contacts");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete contact");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!contact) return <p className="text-muted-foreground">Contact not found</p>;

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contacts
        </Button>
      </div>

      <PageHeader
        title={contact.full_name}
        description={`Doc ID: ${contact.doc_id || "-"}`}
        actions={
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteContact.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {contact.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action permanently removes the contact from the workspace.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDelete()}
                  >
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => void handleSave()} disabled={updateContact.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {updateContact.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="contact-name">Full Name</Label>
              <Input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-phones">Phones</Label>
              <Input
                id="contact-phones"
                value={phonesText}
                onChange={(event) => setPhonesText(event.target.value)}
                placeholder="+15551234567, +15557654321"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-emails">Emails</Label>
              <Input
                id="contact-emails"
                value={emailsText}
                onChange={(event) => setEmailsText(event.target.value)}
                placeholder="contact@acme.com, owner@acme.com"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list.</p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(contact.created_at), "MMM d, yyyy HH:mm")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags & Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 flex-wrap">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                      <button
                        type="button"
                        className="ml-1"
                        aria-label={`Remove ${tag}`}
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">No tags</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={pendingTag}
                  onChange={(event) => setPendingTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <Label htmlFor="line1">Address Line 1</Label>
                <Input
                  id="line1"
                  value={address.line1}
                  onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="line2">Address Line 2</Label>
                <Input
                  id="line2"
                  value={address.line2}
                  onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={address.city}
                    onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="region">State/Region</Label>
                  <Input
                    id="region"
                    value={address.region}
                    onChange={(event) => setAddress((current) => ({ ...current, region: event.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={address.postal_code}
                    onChange={(event) => setAddress((current) => ({ ...current, postal_code: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={address.country}
                    onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Related Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingConversations ? (
              <div className="flex items-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading conversations...
              </div>
            ) : relatedConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related conversations yet.</p>
            ) : (
              <div className="space-y-2">
                {relatedConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => navigate(`/merchants/${conversation.merchant_id}/conversations/${conversation.id}`)}
                    className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{conversation.external_contact || "Unknown contact"}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {format(new Date(conversation.updated_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <StatusBadge status={conversation.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Address Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueList
              emptyText="No address on file"
              items={[
                { label: "Line 1", value: normalizedAddress.line1 },
                { label: "Line 2", value: normalizedAddress.line2 },
                { label: "City", value: normalizedAddress.city },
                { label: "State/Region", value: normalizedAddress.region },
                { label: "Postal Code", value: normalizedAddress.postal_code },
                { label: "Country", value: normalizedAddress.country },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
