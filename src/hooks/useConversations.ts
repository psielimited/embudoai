import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/types/database";

export function useConversations(merchantId: string, statusFilter?: string) {
  return useQuery({
    queryKey: ["conversations", merchantId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("updated_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!merchantId,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Conversation | null;
    },
    enabled: !!id,
  });
}

export function useConversationsByContact(contactId?: string) {
  return useQuery({
    queryKey: ["conversations-by-contact", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data: directRows, error: directError } = await supabase
        .from("conversations")
        .select("id,merchant_id,external_contact,status,updated_at")
        .eq("contact_id", contactId!)
        .order("updated_at", { ascending: false });

      if (directError) throw directError;

      const { data: channelLinks, error: channelError } = await supabase
        .from("contact_channels")
        .select("external_contact")
        .eq("contact_id", contactId!);

      if (channelError) throw channelError;

      const mappedContacts = Array.from(
        new Set((channelLinks ?? []).map((row) => row.external_contact).filter(Boolean)),
      );

      if (mappedContacts.length === 0) {
        return (directRows ?? []) as Pick<
          Conversation,
          "id" | "merchant_id" | "external_contact" | "status" | "updated_at"
        >[];
      }

      const { data: mappedRows, error: mappedError } = await supabase
        .from("conversations")
        .select("id,merchant_id,external_contact,status,updated_at")
        .in("external_contact", mappedContacts)
        .order("updated_at", { ascending: false });

      if (mappedError) throw mappedError;

      const merged = [...(directRows ?? []), ...(mappedRows ?? [])];
      const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values());
      deduped.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return deduped as Pick<Conversation, "id" | "merchant_id" | "external_contact" | "status" | "updated_at">[];
    },
  });
}

export function useConversationsByLead(leadId?: string) {
  return useQuery({
    queryKey: ["conversations-by-lead", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data: directRows, error: directError } = await supabase
        .from("conversations")
        .select("id,merchant_id,external_contact,status,updated_at")
        .eq("lead_id", leadId!)
        .order("updated_at", { ascending: false });

      if (directError) throw directError;

      const { data: channelLinks, error: channelError } = await supabase
        .from("contact_channels")
        .select("external_contact")
        .eq("lead_id", leadId!);

      if (channelError) throw channelError;

      const mappedContacts = Array.from(
        new Set((channelLinks ?? []).map((row) => row.external_contact).filter(Boolean)),
      );

      if (mappedContacts.length === 0) {
        return (directRows ?? []) as Pick<
          Conversation,
          "id" | "merchant_id" | "external_contact" | "status" | "updated_at"
        >[];
      }

      const { data: mappedRows, error: mappedError } = await supabase
        .from("conversations")
        .select("id,merchant_id,external_contact,status,updated_at")
        .in("external_contact", mappedContacts)
        .order("updated_at", { ascending: false });

      if (mappedError) throw mappedError;

      const merged = [...(directRows ?? []), ...(mappedRows ?? [])];
      const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values());
      deduped.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return deduped as Pick<Conversation, "id" | "merchant_id" | "external_contact" | "status" | "updated_at">[];
    },
  });
}
