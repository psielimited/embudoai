import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, User } from "lucide-react";

interface OpportunityCardProps {
  opportunity: {
    id: string;
    name: string;
    amount: number | null;
    status: string;
    version: number;
    owner_user_id: string;
  };
  onDragStart: (e: React.DragEvent, oppId: string) => void;
  onClick: () => void;
}

export function OpportunityCard({ opportunity, onDragStart, onClick }: OpportunityCardProps) {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, opportunity.id)}
      onClick={onClick}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3 space-y-2">
        <p className="font-medium text-sm leading-tight">{opportunity.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {opportunity.amount != null && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {Number(opportunity.amount).toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            v{opportunity.version}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
