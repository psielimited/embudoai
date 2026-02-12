import { useOrgs, useActiveOrg, useSwitchOrg } from "@/hooks/useOrg";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function OrgSwitcher() {
  const { data: orgs = [] } = useOrgs();
  const { data: activeOrgId } = useActiveOrg();
  const switchOrg = useSwitchOrg();

  // Don't show if user belongs to only 1 org
  if (orgs.length <= 1) return null;

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId) return;
    try {
      await switchOrg.mutateAsync(orgId);
      toast.success("Switched organization");
    } catch {
      toast.error("Failed to switch org");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={activeOrgId ?? ""} onValueChange={handleSwitch} disabled={switchOrg.isPending}>
        <SelectTrigger className="w-40 h-8 text-xs">
          {switchOrg.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {orgs.map(org => (
            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
