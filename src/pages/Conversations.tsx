import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMerchants } from "@/hooks/useMerchants";
import {
  useConversationOwners,
  useConversationUnreadCounts,
  useGlobalConversations,
  type ConversationListRow,
} from "@/hooks/useConversations";

function hasUnread(lastInboundAt: string | null, lastHumanOutboundAt: string | null) {
  if (!lastInboundAt) return false;
  if (!lastHumanOutboundAt) return true;
  return new Date(lastInboundAt).getTime() > new Date(lastHumanOutboundAt).getTime();
}

export default function Conversations() {
  const navigate = useNavigate();
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const { data: merchants = [] } = useMerchants();
  const { data: owners = [] } = useConversationOwners();
  const { data: unreadCounts } = useConversationUnreadCounts();
  const { data: conversations = [], isLoading } = useGlobalConversations({
    merchantId: merchantFilter,
    status: statusFilter,
    ownerId: ownerFilter,
  });

  const ownerLabelMap = useMemo(() => {
    const labels = new Map<string, string>();
    for (const owner of owners) {
      labels.set(owner.id, owner.label);
    }
    return labels;
  }, [owners]);

  const columns = [
    {
      key: "external_contact",
      header: "Contact",
      render: (conversation: ConversationListRow) => (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{conversation.external_contact}</p>
          {hasUnread(conversation.last_inbound_at, conversation.last_human_outbound_at) && (
            <Badge variant="secondary" className="text-[10px]">
              New Message
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (conversation: ConversationListRow) => (
        <span className="text-muted-foreground">{conversation.merchant_name ?? "-"}</span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (conversation: ConversationListRow) => (
        <span className="text-muted-foreground">
          {conversation.owner_user_id ? ownerLabelMap.get(conversation.owner_user_id) ?? "Assigned" : "Unassigned"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (conversation: ConversationListRow) => <StatusBadge status={conversation.status} />,
    },
    {
      key: "updated_at",
      header: "Updated",
      render: (conversation: ConversationListRow) => (
        <span className="text-muted-foreground">{format(new Date(conversation.updated_at), "MMM d, h:mm a")}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Global inbox across all merchants"
        breadcrumbs={[{ label: "Conversations" }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={merchantFilter} onValueChange={setMerchantFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Merchant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All merchants</SelectItem>
                {merchants.map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="waiting_on_customer">Waiting on Customer</SelectItem>
                <SelectItem value="needs_handoff">Needs Handoff</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={conversations}
        onRowClick={(conversation) => navigate(`/merchants/${conversation.merchant_id}/conversations/${conversation.id}`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={MessageSquare}
            title="No conversations found"
            description="No conversations match the selected filters."
          />
        }
      />

      {unreadCounts && unreadCounts.totalUnread > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{unreadCounts.totalUnread} unread conversations.</p>
      )}
    </>
  );
}
