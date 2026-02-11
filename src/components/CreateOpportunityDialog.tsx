import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateOpportunity } from "@/hooks/useOpportunities";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  stageId: string;
  stageName: string;
}

export function CreateOpportunityDialog({ open, onClose, pipelineId, stageId, stageName }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const create = useCreateOpportunity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        pipeline_id: pipelineId,
        stage_id: stageId,
        amount: amount ? Number(amount) : undefined,
        expected_close_date: closeDate || undefined,
      });
      toast.success("Opportunity created");
      setName(""); setAmount(""); setCloseDate("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create opportunity");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Opportunity in {stageName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="opp-name">Name *</Label>
            <Input id="opp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="opp-amount">Amount</Label>
            <Input id="opp-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="opp-close">Expected Close Date</Label>
            <Input id="opp-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
