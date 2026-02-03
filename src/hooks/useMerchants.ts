import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/types/database";

export function useMerchants() {
  return useQuery({
    queryKey: ["merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Merchant[];
    },
  });
}

export function useMerchant(id: string) {
  return useQuery({
    queryKey: ["merchant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Merchant | null;
    },
    enabled: !!id,
  });
}
