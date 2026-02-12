import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getActiveOrgId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase.from("profiles").select("active_org_id").eq("user_id", user.id).single();
  if (!data?.active_org_id) throw new Error("No active org");
  return data.active_org_id;
}

async function callEdge(path: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  const result = await resp.json();
  if (!resp.ok) {
    const err = new Error(result.error_code || result.error || "Request failed");
    (err as any).data = result;
    (err as any).status = resp.status;
    throw err;
  }
  return result;
}

export function useLeads(filters?: { status?: string; owner?: string }) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => {
      let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.owner) q = q.eq("owner_user_id", filters.owner);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLead(id?: string) {
  return useQuery({
    queryKey: ["lead", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      full_name: string;
      phones?: string[];
      emails?: string[];
      source?: string;
      tags?: string[];
    }) => callEdge("create-lead", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      lead_id: string;
      create_opportunity?: boolean;
      pipeline_id?: string;
      initial_stage_id?: string;
    }) => callEdge("convert-lead", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

export function useDisqualifyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("leads").update({ status: "disqualified" }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
