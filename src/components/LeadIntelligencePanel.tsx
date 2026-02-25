import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { LeadNotesCard } from "@/components/LeadNotesCard";
import { useAssignLead, useUpdateLeadStage } from "@/hooks/useAssignLead";
import { useMerchantSettings } from "@/hooks/useMerchantSettings";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type LeadStage = Database["public"]["Enums"]["lead_stage"];
type AutomationMode = Database["public"]["Enums"]["automation_mode"];

type LeadSnapshot = {
  id: string;
  org_id: string;
  full_name: string;
  lead_stage: LeadStage;
  assignee_user_id: string | null;
  tags: unknown;
  created_at: string;
};

type LeadIntelligencePanelProps = {
  lead: LeadSnapshot | null;
  conversationId: string;
  conversationMerchantId: string;
  automationMode: AutomationMode;
  lastMessageAt: string | null;
  currentUserId: string | null;
};

const STAGE_OPTIONS: Array<{ value: LeadStage; label: string }> = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function stageClass(stage: LeadStage) {
  const styles: Record<LeadStage, string> = {
    new: "bg-muted text-muted-foreground border-border",
    contacted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    qualified: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    negotiating: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    won: "bg-green-500/10 text-green-700 border-green-500/20",
    lost: "bg-red-500/10 text-red-700 border-red-500/20",
  };
  return styles[stage];
}

function modeClass(mode: AutomationMode) {
  const styles: Record<AutomationMode, string> = {
    ai: "bg-green-500/10 text-green-700 border-green-500/20",
    human: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    hybrid: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  };
  return styles[mode];
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "NA";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function dateOrPlaceholder(value: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "None";
  return format(date, "MMM d, yyyy h:mm a");
}

export function LeadIntelligencePanel({
  lead,
  conversationId,
  conversationMerchantId,
  automationMode,
  lastMessageAt,
  currentUserId,
}: LeadIntelligencePanelProps) {
  const { data: teamMembers = [] } = useTeamMembers();
  const { settings } = useMerchantSettings(conversationMerchantId);
  const assignLead = useAssignLead();
  const updateLeadStage = useUpdateLeadStage();

  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(lead?.assignee_user_id ?? null);

  useEffect(() => {
    setSelectedAssignee(lead?.assignee_user_id ?? null);
  }, [lead?.assignee_user_id]);

  const assigneeLabel = useMemo(() => {
    if (!lead?.assignee_user_id) return "Unassigned";
    return (
      teamMembers.find((member) => member.user_id === lead.assignee_user_id)?.display_name ??
      lead.assignee_user_id.slice(0, 8)
    );
  }, [lead?.assignee_user_id, teamMembers]);

  const tags = useMemo(() => {
    if (!lead?.tags || !Array.isArray(lead.tags)) return [] as string[];
    return lead.tags.filter((tag): tag is string => typeof tag === "string");
  }, [lead?.tags]);

  const handleAssign = async (assigneeUserId: string | null) => {
    if (!lead) return;
    try {
      await assignLead.mutateAsync({ leadId: lead.id, assigneeUserId });
      toast({
        title: assigneeUserId ? "Lead assigned" : "Lead unassigned",
      });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Could not update assignment",
        description,
        variant: "destructive",
      });
    }
  };

  const handleStageChange = async (nextStage: LeadStage) => {
    if (!lead || nextStage === lead.lead_stage) return;
    try {
      await updateLeadStage.mutateAsync({ leadId: lead.id, leadStage: nextStage });
      toast({ title: "Lead stage updated" });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Could not update stage",
        description,
        variant: "destructive",
      });
    }
  };

  if (!lead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No linked lead for this conversation yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Stage</span>
            <Badge variant="outline" className={stageClass(lead.lead_stage)}>
              {lead.lead_stage}
            </Badge>
          </div>
          <Select value={lead.lead_stage} onValueChange={(value) => void handleStageChange(value as LeadStage)}>
            <SelectTrigger>
              <SelectValue placeholder="Change stage" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Automation mode</span>
            <Badge variant="outline" className={modeClass(automationMode)}>
              {automationMode.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials(assigneeLabel)}
              </span>
              <span className="text-sm">{assigneeLabel}</span>
            </div>
          </div>

          <AssigneeSelect value={selectedAssignee} members={teamMembers} onChange={setSelectedAssignee} />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void handleAssign(selectedAssignee)}
              disabled={assignLead.isPending}
            >
              Assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleAssign(null)}
              disabled={assignLead.isPending || !lead.assignee_user_id}
            >
              Unassign
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleAssign(currentUserId)}
              disabled={assignLead.isPending || !currentUserId}
            >
              Assign to me
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags</p>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <LeadNotesCard
        orgId={lead.org_id}
        merchantId={conversationMerchantId}
        leadId={lead.id}
        conversationId={conversationId}
        currentUserId={currentUserId}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Last inbound</span>
            <span>{dateOrPlaceholder(settings?.last_inbound_at ?? null)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Last outbound</span>
            <span>{dateOrPlaceholder(settings?.last_outbound_success_at ?? null)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Lead created</span>
            <span>{dateOrPlaceholder(lead.created_at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Last message</span>
            <span>{dateOrPlaceholder(lastMessageAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
