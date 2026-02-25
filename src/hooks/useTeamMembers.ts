import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useOrg";

export type TeamMember = {
  user_id: string;
  display_name: string;
  email: string | null;
  role: string;
};

export function useTeamMembers() {
  const { data: orgId } = useActiveOrg();

  return useQuery({
    queryKey: ["team-members", orgId ?? null],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from("org_members")
        .select("user_id, role")
        .eq("org_id", orgId!);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [] as TeamMember[];

      const userIds = Array.from(new Set(members.map((member) => member.user_id)));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.full_name]));

      return members
        .map((member) => ({
          user_id: member.user_id,
          display_name: profileMap.get(member.user_id) || member.user_id.slice(0, 8),
          email: null,
          role: member.role,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
  });
}
