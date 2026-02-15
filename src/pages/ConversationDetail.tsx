import { useParams, Link } from "react-router-dom";
import { MessageSquare, User, UserCheck, Briefcase, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { MessageBubble } from "@/components/MessageBubble";
import { ConversationWorkflow } from "@/components/ConversationWorkflow";
import { useMerchant } from "@/hooks/useMerchants";
import { useConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callEdge } from "@/lib/edge";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [regenerating, setRegenerating] = useState(false);
  const [sendingMessageId, setSendingMessageId] = useState<string | null>(null);
  const [manualReply, setManualReply] = useState("");
  const [sendingManualReply, setSendingManualReply] = useState(false);

  const { data: merchant } = useMerchant(merchantId!);
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId!);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId!);

  const { data: linkedLead } = useLinkedLead(conversation?.lead_id);
  const { data: linkedContact } = useLinkedContact(conversation?.contact_id);
  const { data: linkedOpp } = useLinkedOpportunity(conversation?.opportunity_id);

  const isLoading = convLoading || messagesLoading;
  const aiStatus = conversation?.ai_status;
  const isAiWorking = aiStatus === "queued" || aiStatus === "generating";

  // Realtime subscription for new messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const handleRegenerate = async () => {
    if (!conversationId || !messages.length) return;
    setRegenerating(true);
    // Find the latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    try {
      await callEdge("generate-ai-reply", {
        conversation_id: conversationId,
        trigger_message_id: lastUserMsg?.id ?? null,
      });
      toast.success("AI draft regenerated");
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch (error: any) {
      toast.error(error.message || "Network error regenerating draft");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSendMessage = useCallback(async (messageId: string) => {
    setSendingMessageId(messageId);
    try {
      const data = await callEdge<{ ok?: boolean; error?: string }>("send-whatsapp-message", {
        message_id: messageId,
      });

      if (data.ok) {
        toast.success("Message sent via WhatsApp");
      } else {
        toast.error(data.error || "Failed to send message");
      }

      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch (error: any) {
      toast.error(error.message || "Network error sending message");
    } finally {
      setSendingMessageId(null);
    }
  }, [conversationId, queryClient]);

  const handleAssignToMe = async () => {
    if (!conversationId || !user) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ owner_user_id: user.id })
        .eq("id", conversationId);

      if (error) throw error;

      toast.success("Assigned to you");
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign conversation");
    }
  };

  const handleSendManualReply = async () => {
    if (!conversation || !conversationId) return;
    const content = manualReply.trim();
    if (!content) return;

    setSendingManualReply(true);
    try {
      const { data: message, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          org_id: conversation.org_id,
          sender: "human",
          direction: "outbound",
          channel: "whatsapp",
          content,
          send_status: "unsent",
          delivery_status: "unknown",
          metadata: { manual: true },
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const result = await callEdge<{ ok?: boolean; error?: string }>("send-whatsapp-message", {
        message_id: message.id,
      });

      if (!result.ok) {
        toast.error(result.error || "Failed to send reply");
      } else {
        toast.success("Reply sent");
        setManualReply("");
      }

      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversation-unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
    } catch (error) {
      console.error(error);
      toast.error("Failed to send reply");
    } finally {
      setSendingManualReply(false);
    }
  };

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
        actions={
          conversation && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAssignToMe()}
                disabled={!user || conversation.owner_user_id === user?.id}
              >
                Assign to me
              </Button>
              <StatusBadge status={conversation.status} />
            </div>
          )
        }
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

          {/* Workflow controls */}
          {conversation && (
            <div className="mt-4">
              <ConversationWorkflow conversation={conversation} />
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
                      <MessageBubble
                        key={message.id}
                        message={message}
                        onSend={handleSendMessage}
                        isSending={sendingMessageId === message.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI status indicator + regenerate */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            {isAiWorking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI drafting…</span>
              </div>
            )}
            {aiStatus === "failed" && conversation?.ai_last_error && (
              <span className="text-sm text-destructive">
                AI error: {conversation.ai_last_error.slice(0, 80)}
              </span>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || isAiWorking}
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Regenerate draft
              </Button>
            </div>
          </div>

          {/* Human free-text reply */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium">Send manual reply</p>
            <Textarea
              value={manualReply}
              onChange={(event) => setManualReply(event.target.value)}
              placeholder="Type a custom message to the customer..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void handleSendManualReply()}
                disabled={sendingManualReply || manualReply.trim().length === 0}
              >
                {sendingManualReply ? "Sending..." : "Send Reply"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
