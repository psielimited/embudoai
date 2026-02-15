import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

type CreateContactInput = {
  full_name: string;
  phones?: string[];
  emails?: string[];
  tags?: string[];
};

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,full_name,emails,phones,doc_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
  });
}

export function useContact(id?: string) {
  return useQuery({
    queryKey: ["contact", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as ContactRow;
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateContactInput) => {
      const orgId = await getActiveOrgId();
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          full_name: payload.full_name.trim(),
          org_id: orgId,
          phones: payload.phones ?? [],
          emails: payload.emails ?? [],
          tags: payload.tags ?? [],
          addresses: [],
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as ContactRow;
    },
    onSuccess: (contact) => {
      queryClient.setQueryData<ContactRow[]>(["contacts"], (current = []) => [contact, ...current]);
      queryClient.setQueryData<ContactRow | null>(["contact", contact.id], contact);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ContactUpdate }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return data as ContactRow;
    },
    onSuccess: (contact) => {
      queryClient.setQueryData<ContactRow[]>(["contacts"], (current = []) =>
        current.map((row) => (row.id === contact.id ? { ...row, ...contact } : row)),
      );
      queryClient.setQueryData<ContactRow | null>(["contact", contact.id], contact);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", contact.id] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ContactRow[]>(["contacts"], (current = []) =>
        current.filter((row) => row.id !== id),
      );
      queryClient.removeQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-by-contact", id] });
    },
  });
}
