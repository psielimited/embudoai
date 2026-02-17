import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Check, Pencil, Plus, Settings, Store, X } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useCreateMerchant, useMerchants, useUpdateMerchant } from "@/hooks/useMerchants";
import { useActiveOrg, useOrgPlanStatus } from "@/hooks/useOrg";
import { useConversationUnreadCounts } from "@/hooks/useConversations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Merchant } from "@/types/database";

const createMerchantSchema = z.object({
  name: z.string().trim().min(1, "Merchant name is required"),
});

type CreateMerchantForm = z.infer<typeof createMerchantSchema>;

function CreateMerchantDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateMerchantForm) => Promise<void>;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateMerchantForm>({
    resolver: zodResolver(createMerchantSchema),
    mode: "onChange",
    defaultValues: { name: "" },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Merchant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onCreate)}>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="merchant-name">Merchant Name *</Label>
              <Input id="merchant-name" {...register("name")} placeholder="Acme Retail" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Creating..." : "Create Merchant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MerchantList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const { data: merchants = [], isLoading } = useMerchants();
  const { data: activeOrgId } = useActiveOrg();
  const { subscription } = useOrgPlanStatus(activeOrgId ?? undefined);
  const { data: unreadCounts } = useConversationUnreadCounts();
  const createMerchant = useCreateMerchant();
  const updateMerchant = useUpdateMerchant();

  const visibleMerchants = showInactive
    ? merchants
    : merchants.filter((merchant) => merchant.status === "active");

  const getMerchantLimitByPlan = (planName?: string | null) => {
    const normalized = (planName ?? "").toLowerCase();
    if (normalized.includes("free")) return 1;
    if (normalized.includes("starter")) return 1;
    if (normalized.includes("growth")) return 2;
    if (normalized.includes("pro")) return null;
    return 1;
  };

  const planName = subscription?.subscription_plans?.name ?? null;
  const merchantLimit = getMerchantLimitByPlan(planName);
  const activeMerchantCount = merchants.filter((merchant) => merchant.status === "active").length;
  const canCreateMerchant = merchantLimit === null || activeMerchantCount < merchantLimit;
  const merchantLimitMessage = merchantLimit === null
    ? "Unlimited merchants on current plan."
    : `Plan limit: ${merchantLimit} active merchant${merchantLimit === 1 ? "" : "s"}.`;

  const startEditing = (merchant: Merchant) => {
    setEditingId(merchant.id);
    setEditingName(merchant.name);
  };

  const stopEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleCreateMerchant = async (values: CreateMerchantForm) => {
    try {
      await createMerchant.mutateAsync({ name: values.name });
      toast.success("Merchant created");
      setCreateOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create merchant");
    }
  };

  const handleRename = async (merchant: Merchant) => {
    const trimmedName = editingName.trim();
    if (!trimmedName || trimmedName === merchant.name) {
      stopEditing();
      return;
    }

    try {
      await updateMerchant.mutateAsync({
        id: merchant.id,
        updates: { name: trimmedName },
      });
      toast.success("Merchant renamed");
      stopEditing();
    } catch (error) {
      console.error(error);
      toast.error("Failed to rename merchant");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Merchant Name",
      render: (merchant: Merchant) => (
        <div className="flex items-center gap-2">
          {editingId === merchant.id ? (
            <>
              <Input
                value={editingName}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleRename(merchant);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    stopEditing();
                  }
                }}
                className="h-8"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleRename(merchant);
                }}
                disabled={updateMerchant.isPending || !editingName.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  stopEditing();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <span
                className={`font-medium ${merchant.status === "inactive" ? "text-muted-foreground" : "text-foreground"}`}
              >
                {merchant.name}
              </span>
              {(unreadCounts?.byMerchant?.[merchant.id] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {unreadCounts?.byMerchant?.[merchant.id]} new
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  startEditing(merchant);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
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
        <span className={merchant.status === "inactive" ? "text-muted-foreground/80" : "text-muted-foreground"}>
          {merchant.created_at && !isNaN(new Date(merchant.created_at).getTime())
            ? format(new Date(merchant.created_at), "MMM d, yyyy")
            : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (merchant: Merchant) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/merchants/${merchant.id}/settings`);
          }}
        >
          <Settings className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Merchants"
        description="View and manage all merchants in your workspace"
        breadcrumbs={[{ label: "Merchants" }]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <Label className="text-sm text-muted-foreground">Show inactive</Label>
            </div>
            <Button
              disabled={!canCreateMerchant}
              onClick={() => {
                if (!canCreateMerchant) {
                  toast.error(`Merchant limit reached for ${planName ?? "current"} plan. Upgrade to add more.`);
                  return;
                }
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              + New Merchant
            </Button>
          </div>
        }
      />

      {!canCreateMerchant && (
        <p className="mb-4 text-sm text-amber-700">
          {merchantLimitMessage} Archive an active merchant to free a slot, or upgrade your plan to add more.
        </p>
      )}

      <DataTable
        columns={columns}
        data={visibleMerchants}
        onRowClick={(merchant) => navigate(`/merchants/${merchant.id}/conversations`)}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Store}
            title="No merchants found"
            description={
              showInactive
                ? "There are no merchants in your workspace yet."
                : "No active merchants found. Enable \"Show inactive\" to view archived merchants."
            }
          />
        }
      />

      <CreateMerchantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateMerchant}
        isPending={createMerchant.isPending}
      />
    </>
  );
}
