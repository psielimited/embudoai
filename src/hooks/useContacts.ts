import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,full_name,emails,phones,doc_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
      return data;
    },
  });
}
