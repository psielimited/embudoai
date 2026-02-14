import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useAutomationRules, useCreateAutomationRule, useToggleAutomationRule, useDeleteAutomationRule,
} from "@/hooks/useAutomationRules";
import { usePipeline } from "@/hooks/usePipeline";
import { Plus, Trash2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AutomationRules() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: pipelineData } = usePipeline();
  const createRule = useCreateAutomationRule();
  const toggleRule = useToggleAutomationRule();
  const deleteRule = useDeleteAutomationRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("stage_changed");
  const [toStageId, setToStageId] = useState("");
  const [actionType, setActionType] = useState<"create_task" | "assign_owner">("create_task");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueInHours, setDueInHours] = useState("24");
  const [assignedTo, setAssignedTo] = useState("owner");
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const stages = pipelineData?.stages ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const conditions: Record<string, any> = {};
    if (toStageId) conditions.to_stage_id = toStageId;
    if (pipelineData) conditions.pipeline_id = pipelineData.pipeline.id;

    const actions = [];
    if (actionType === "create_task") {
      actions.push({
        type: "create_task",
        title: taskTitle || "Follow up",
        due_in_hours: Number(dueInHours) || 24,
        assigned_to: assignedTo,
      });
    } else {
      actions.push({ type: "assign_owner", user_id: assignedTo });
    }

    try {
      await createRule.mutateAsync({
        name: name.trim(),
        trigger_type: triggerType,
        conditions,
        actions,
      });
      toast.success("Rule created");
      setDialogOpen(false);
      setName(""); setTaskTitle(""); setToStageId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create rule");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageHeader title="Automation Rules" description="Define rules that trigger actions on stage changes" />

      <div className="mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Rule
        </Button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No automation rules yet. Create one to get started.</p>
            </CardContent>
          </Card>
        )}
        {rules.map((rule) => {
          const toStage = stages.find((s) => s.id === rule.conditions?.to_stage_id);
          return (
            <Card key={rule.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {rule.trigger_type.replace(/_/g, " ")}
                    </Badge>
                    {toStage && (
                      <Badge variant="secondary" className="text-xs">→ {toStage.name}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Actions: {rule.actions.map((a) => a.type.replace(/_/g, " ")).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRuleToDelete({ id: rule.id, name: rule.name })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Automation Rule</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Rule Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage_changed">Stage Changed</SelectItem>
                  <SelectItem value="opportunity_created">Opportunity Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {triggerType === "stage_changed" && (
              <div>
                <Label>To Stage (optional)</Label>
                <Select value={toStageId} onValueChange={setToStageId}>
                  <SelectTrigger><SelectValue placeholder="Any stage" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Action Type</Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_task">Create Task</SelectItem>
                  <SelectItem value="assign_owner">Assign Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {actionType === "create_task" && (
              <>
                <div>
                  <Label>Task Title</Label>
                  <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up" />
                </div>
                <div>
                  <Label>Due In (hours)</Label>
                  <Input type="number" value={dueInHours} onChange={(e) => setDueInHours(e.target.value)} />
                </div>
                <div>
                  <Label>Assign To</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRule.isPending}>
                {createRule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {ruleToDelete ? `This will permanently delete "${ruleToDelete.name}" and cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!ruleToDelete) return;
                deleteRule.mutate(ruleToDelete.id);
                setRuleToDelete(null);
              }}
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending ? "Deleting..." : "Delete Rule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
