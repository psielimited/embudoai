import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 'active' | 'inactive' | 'open' | 'closed' | 'needs_handoff' | 'waiting_on_customer' | 'resolved';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-status-active/10 text-status-active border-status-active/20',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-status-inactive/10 text-status-inactive border-status-inactive/20',
  },
  open: {
    label: 'Open',
    className: 'bg-status-open/10 text-status-open border-status-open/20',
  },
  closed: {
    label: 'Closed',
    className: 'bg-status-closed/10 text-status-closed border-status-closed/20',
  },
  needs_handoff: {
    label: 'Needs Handoff',
    className: 'bg-status-handoff/10 text-status-handoff border-status-handoff/20',
  },
  waiting_on_customer: {
    label: 'Waiting on Customer',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.open;
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
