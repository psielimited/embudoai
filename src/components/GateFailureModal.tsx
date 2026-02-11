import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface GateFailureModalProps {
  open: boolean;
  onClose: () => void;
  missingFields: string[];
  missingActivities: string[];
  onCreateActivity?: (type: string) => void;
}

export function GateFailureModal({
  open,
  onClose,
  missingFields,
  missingActivities,
  onCreateActivity,
}: GateFailureModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Stage Gate Requirements Not Met
          </DialogTitle>
          <DialogDescription>
            The following requirements must be satisfied before moving to this stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {missingFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Missing Fields</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {missingFields.map((f) => (
                  <li key={f} className="capitalize">{f.replace(/_/g, " ")}</li>
                ))}
              </ul>
            </div>
          )}
          {missingActivities.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Missing Activities</h4>
              <ul className="space-y-2">
                {missingActivities.map((a) => (
                  <li key={a} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{a}</span>
                    {onCreateActivity && (
                      <Button size="sm" variant="outline" onClick={() => onCreateActivity(a)}>
                        Log {a}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
