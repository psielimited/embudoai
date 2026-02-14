import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateActiveOrgCache } from "@/lib/auth";
import { callEdge } from "@/lib/edge";

export function useOrgs() {
  return useQuery({
    queryKey: ["orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orgs").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActiveOrg() {
  return useQuery({
    queryKey: ["active-org"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data?.active_org_id ?? null;
    },
  });
}

export function useOrgMembers(orgId?: string) {
  return useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("*, profiles:user_id(full_name)")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeams(orgId?: string) {
  return useQuery({
    queryKey: ["teams", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: ["team-members", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*, profiles:user_id(full_name)")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSwitchOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const result = await callEdge("set-active-org", { org_id: orgId });
      invalidateActiveOrgCache();
      return result;
    },
    onSuccess: () => {
      // Invalidate everything to reload with new org context
      qc.invalidateQueries();
    },
  });
}

export function useAddOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { org_id: string; user_id: string; role: string }) => {
      const { error } = await supabase.from("org_members").insert(params);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["org-members", v.org_id] }),
  });
}

export function useRemoveOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { org_id: string; user_id: string }) => {
      const { error } = await supabase
        .from("org_members")
        .delete()
        .eq("org_id", params.org_id)
        .eq("user_id", params.user_id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["org-members", v.org_id] }),
  });
}

export function useUpdateOrgMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { org_id: string; user_id: string; role: string }) => {
      const { error } = await supabase
        .from("org_members")
        .update({ role: params.role })
        .eq("org_id", params.org_id)
        .eq("user_id", params.user_id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["org-members", v.org_id] }),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { org_id: string; name: string }) => {
      const { data, error } = await supabase.from("teams").insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["teams", v.org_id] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; org_id: string }) => {
      const { error } = await supabase.from("teams").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["teams", v.org_id] }),
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { team_id: string; user_id: string; is_team_manager?: boolean }) => {
      const { error } = await supabase.from("team_members").insert({
        team_id: params.team_id,
        user_id: params.user_id,
        is_team_manager: params.is_team_manager ?? false,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["team-members", v.team_id] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { team_id: string; user_id: string }) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", params.team_id)
        .eq("user_id", params.user_id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["team-members", v.team_id] }),
  });
}
