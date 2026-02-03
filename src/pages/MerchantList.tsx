import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useMerchants } from "@/hooks/useMerchants";
import type { Merchant } from "@/types/database";

export default function MerchantList() {
  const navigate = useNavigate();
  const { data: merchants = [], isLoading } = useMerchants();

  const columns = [
    {
      key: "name",
      header: "Merchant Name",
      render: (merchant: Merchant) => (
        <span className="font-medium text-foreground">{merchant.name}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (merchant: Merchant) => <StatusBadge status={merchant.status} />,
    },
    {
      key: "created_at",
      header: "Created",
      render: (merchant: Merchant) => (
        <span className="text-muted-foreground">
          {format(new Date(merchant.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Merchants"
        description="View and manage all merchants in your workspace"
        breadcrumbs={[{ label: "Merchants" }]}
      />
      
      <DataTable
        columns={columns}
        data={merchants}
        onRowClick={(merchant) => navigate(`/merchants/${merchant.id}/conversations`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Store}
            title="No merchants found"
            description="There are no merchants in your workspace yet."
          />
        }
      />
    </>
  );
}
