import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type LeadNoteRow = Database["public"]["Tables"]["lead_notes"]["Row"];

export type LeadNoteRecord = LeadNoteRow & {
  created_by_name: string | null;
  updated_by_name: string | null;
};

export function useLeadNotes(leadId?: string) {
  return useQuery({
    queryKey: ["lead-notes", leadId ?? null],
    enabled: !!leadId,
    queryFn: async () => {
      const { data: notes, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const noteRows = notes ?? [];
      if (noteRows.length === 0) return [] as LeadNoteRecord[];

      const userIds = Array.from(
        new Set(
          noteRows.flatMap((note) =>
            [note.created_by_user_id, note.updated_by_user_id].filter(Boolean) as string[],
          ),
        ),
      );

      let nameMap = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profileError) throw profileError;
        nameMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.full_name]));
      }

      return noteRows.map((note) => ({
        ...note,
        created_by_name: nameMap.get(note.created_by_user_id) ?? null,
        updated_by_name: note.updated_by_user_id ? nameMap.get(note.updated_by_user_id) ?? null : null,
      }));
    },
  });
}

export function useCreateLeadNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      orgId: string;
      merchantId: string;
      leadId: string;
      conversationId?: string | null;
      body: string;
    }) => {
      if (!user) throw new Error("You must be signed in");
      const body = params.body.trim();
      if (!body) throw new Error("Note body is required");

      const { data, error } = await supabase
        .from("lead_notes")
        .insert({
          org_id: params.orgId,
          merchant_id: params.merchantId,
          lead_id: params.leadId,
          conversation_id: params.conversationId ?? null,
          body,
          created_by_user_id: user.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", variables.leadId] });
    },
  });
}

export function useUpdateLeadNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { id: string; leadId: string; body: string }) => {
      if (!user) throw new Error("You must be signed in");
      const body = params.body.trim();
      if (!body) throw new Error("Note body is required");

      const { data, error } = await supabase
        .from("lead_notes")
        .update({
          body,
          updated_at: new Date().toISOString(),
          updated_by_user_id: user.id,
        })
        .eq("id", params.id)
        .eq("created_by_user_id", user.id)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", variables.leadId] });
    },
  });
}

export function useDeleteLeadNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { id: string; leadId: string }) => {
      if (!user) throw new Error("You must be signed in");

      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from("lead_notes")
        .update({
          deleted_at: timestamp,
          deleted_by_user_id: user.id,
          updated_at: timestamp,
          updated_by_user_id: user.id,
        })
        .eq("id", params.id)
        .eq("created_by_user_id", user.id)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", variables.leadId] });
    },
  });
}
