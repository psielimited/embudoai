import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useMerchant } from "@/hooks/useMerchants";
import { useConversations } from "@/hooks/useConversations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { Conversation } from "@/types/database";

export default function MerchantConversations() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: merchant } = useMerchant(merchantId!);
  const { data: conversations = [], isLoading } = useConversations(merchantId!, statusFilter);

  const columns = [
    {
      key: "external_contact",
      header: "Contact",
      render: (conv: Conversation) => (
        <span className="font-medium text-foreground">{conv.external_contact}</span>
      ),
    },
    {
      key: "language",
      header: "Language",
      render: (conv: Conversation) => (
        <span className="text-muted-foreground uppercase text-xs font-medium">
          {conv.language}
        </span>
      ),
    },
    {
      key: "intent",
      header: "Intent",
      render: (conv: Conversation) => (
        <span className="text-muted-foreground capitalize">
          {conv.intent?.replace(/_/g, " ") || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (conv: Conversation) => <StatusBadge status={conv.status} />,
    },
    {
      key: "updated_at",
      header: "Last Updated",
      render: (conv: Conversation) => (
        <span className="text-muted-foreground">
          {format(new Date(conv.updated_at), "MMM d, h:mm a")}
        </span>
      ),
    },
  ];

  if (!merchant && !isLoading) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Merchant not found"
        description="The merchant you're looking for doesn't exist."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={merchant?.name ?? "Loading..."}
        description="View all conversations for this merchant"
        breadcrumbs={[
          { label: "Merchants", href: "/merchants" },
          { label: merchant?.name ?? "..." },
        ]}
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
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
        }
      />
      
      <DataTable
        columns={columns}
        data={conversations}
        onRowClick={(conv) => navigate(`/merchants/${merchantId}/conversations/${conv.id}`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={MessageSquare}
            title="No conversations found"
            description={statusFilter !== "all" 
              ? "No conversations match the selected filter." 
              : "There are no conversations for this merchant yet."
            }
          />
        }
      />
    </>
  );
}
