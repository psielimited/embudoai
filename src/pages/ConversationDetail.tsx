import { useParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
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

export default function ConversationDetail() {
  const { merchantId, conversationId } = useParams<{
    merchantId: string;
    conversationId: string;
  }>();

  const { data: merchant } = useMerchant(merchantId!);
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId!);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId!);

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
          <div className="flex items-center gap-6 text-sm">
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
