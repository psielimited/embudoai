import { useParams, Link } from "react-router-dom";
import { MessageSquare, User, UserCheck, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { MessageBubble } from "@/components/MessageBubble";
import { useMerchant } from "@/hooks/useMerchants";
import { useConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useLinkedLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, status")
        .eq("id", leadId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
}

function useLinkedContact(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("id", contactId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}

function useLinkedOpportunity(oppId: string | null | undefined) {
  return useQuery({
    queryKey: ["opportunity", oppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, name, status")
        .eq("id", oppId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!oppId,
  });
}

export default function ConversationDetail() {
  const { merchantId, conversationId } = useParams<{
    merchantId: string;
    conversationId: string;
  }>();

  const { data: merchant } = useMerchant(merchantId!);
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId!);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId!);

  const { data: linkedLead } = useLinkedLead(conversation?.lead_id);
  const { data: linkedContact } = useLinkedContact(conversation?.contact_id);
  const { data: linkedOpp } = useLinkedOpportunity(conversation?.opportunity_id);

  const isLoading = convLoading || messagesLoading;

  if (!conversation && !isLoading) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Conversation not found"
        description="The conversation you're looking for doesn't exist."
      />
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), "MMMM d, yyyy");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, typeof messages>);

  return (
    <>
      <PageHeader
        title={conversation?.external_contact ?? "Loading..."}
        breadcrumbs={[
          { label: "Merchants", href: "/merchants" },
          { label: merchant?.name ?? "...", href: `/merchants/${merchantId}/conversations` },
          { label: "Conversation" },
        ]}
        actions={conversation && <StatusBadge status={conversation.status} />}
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Language:</span>{" "}
              <span className="font-medium uppercase">{conversation?.language}</span>
            </div>
            {conversation?.intent && (
              <div>
                <span className="text-muted-foreground">Intent:</span>{" "}
                <span className="font-medium capitalize">
                  {conversation.intent.replace(/_/g, " ")}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Started:</span>{" "}
              <span className="font-medium">
                {conversation && format(new Date(conversation.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>

          {/* CRM Linkage */}
          {(linkedLead || linkedContact || linkedOpp) && (
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {linkedLead && (
                <Link to={`/leads/${linkedLead.id}`}>
                  <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-accent transition-colors">
                    <User className="h-3 w-3" />
                    Lead: {linkedLead.full_name || "Unnamed"}
                  </Badge>
                </Link>
              )}
              {linkedContact && (
                <Link to={`/contacts/${linkedContact.id}`}>
                  <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-accent transition-colors">
                    <UserCheck className="h-3 w-3" />
                    Contact: {linkedContact.full_name}
                  </Badge>
                </Link>
              )}
              {linkedOpp && (
                <Link to={`/pipeline`}>
                  <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-accent transition-colors">
                    <Briefcase className="h-3 w-3" />
                    Opp: {linkedOpp.name}
                  </Badge>
                </Link>
              )}
            </div>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages"
              description="This conversation has no messages yet."
            />
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date}>
                  <div className="flex items-center gap-4 mb-6">
                    <Separator className="flex-1" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {date}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <div className="space-y-4">
                    {dateMessages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
