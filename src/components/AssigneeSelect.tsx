import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeamMember } from "@/hooks/useTeamMembers";

type AssigneeSelectProps = {
  value: string | null;
  members: TeamMember[];
  onChange: (userId: string | null) => void;
  placeholder?: string;
};

export function AssigneeSelect({
  value,
  members,
  onChange,
  placeholder = "Choose assignee",
}: AssigneeSelectProps) {
  return (
    <Select value={value ?? "unassigned"} onValueChange={(next) => onChange(next === "unassigned" ? null : next)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {members.map((member) => (
          <SelectItem key={member.user_id} value={member.user_id}>
            {member.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
