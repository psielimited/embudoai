import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callEdge } from "@/lib/edge";

export function useLeads(filters?: { status?: string; owner?: string }) {
  const query = useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id,full_name,status,lead_stage,source,emails,created_at")
        .order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.owner) q = q.eq("owner_user_id", filters.owner);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const leads = query.data ?? [];
  const total = leads.length;
  const qualified = leads.filter((lead: any) => lead.lead_stage === "qualified").length;
  const negotiating = leads.filter((lead: any) => lead.lead_stage === "negotiating").length;
  const won = leads.filter((lead: any) => lead.lead_stage === "won").length;
  const lost = leads.filter((lead: any) => lead.lead_stage === "lost").length;

  return {
    ...query,
    leads,
    total,
    qualified,
    negotiating,
    won,
    lost,
  };
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
      qc.invalidateQueries({ queryKey: ["opportunity-stats"] });
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
