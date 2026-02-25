import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useOrg";
import type { Conversation } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";

type ConversationListRow = Pick<
  Conversation,
  | "id"
  | "merchant_id"
  | "automation_mode"
  | "assignee_user_id"
  | "external_contact"
  | "status"
  | "updated_at"
  | "owner_user_id"
  | "last_inbound_at"
  | "last_human_outbound_at"
> & {
  merchant_name: string | null;
  lead_assignee_user_id: string | null;
};

type GlobalConversationFilters = {
  merchantId?: string;
  status?: string;
  ownerId?: string;
};

type ConversationOwner = {
  id: string;
  label: string;
};

function isUnread(lastInboundAt: string | null, lastHumanOutboundAt: string | null) {
  if (!lastInboundAt) return false;
  if (!lastHumanOutboundAt) return true;
  return new Date(lastInboundAt).getTime() > new Date(lastHumanOutboundAt).getTime();
}

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

export function useGlobalConversations(filters?: GlobalConversationFilters) {
  const { data: orgId } = useActiveOrg();

  return useQuery({
    queryKey: ["global-conversations", orgId ?? null, filters?.merchantId ?? "all", filters?.status ?? "all", filters?.ownerId ?? "all"],
    enabled: !!orgId,
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select("id,merchant_id,automation_mode,assignee_user_id,lead_id,external_contact,status,updated_at,owner_user_id,last_inbound_at,last_human_outbound_at,merchants(name),leads(assignee_user_id)")
        .eq("org_id", orgId!)
        .order("updated_at", { ascending: false });

      if (filters?.merchantId && filters.merchantId !== "all") {
        query = query.eq("merchant_id", filters.merchantId);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.ownerId && filters.ownerId !== "all") {
        if (filters.ownerId === "unassigned") {
          query = query.is("owner_user_id", null);
        } else {
          query = query.eq("owner_user_id", filters.ownerId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      return ((data ?? []) as Array<
        Database["public"]["Tables"]["conversations"]["Row"] & {
          merchants: { name: string } | null;
          leads: { assignee_user_id: string | null } | null;
        }
      >).map((row) => ({
        id: row.id,
        merchant_id: row.merchant_id,
        automation_mode: row.automation_mode as Conversation["automation_mode"],
        assignee_user_id: row.assignee_user_id ?? row.leads?.assignee_user_id ?? null,
        external_contact: row.external_contact,
        status: row.status as Conversation["status"],
        updated_at: row.updated_at,
        owner_user_id: row.owner_user_id,
        last_inbound_at: row.last_inbound_at,
        last_human_outbound_at: row.last_human_outbound_at,
        merchant_name: row.merchants?.name ?? null,
        lead_assignee_user_id: row.leads?.assignee_user_id ?? null,
      })) as ConversationListRow[];
    },
  });
}

export function useConversationOwners() {
  const { data: orgId } = useActiveOrg();

  return useQuery({
    queryKey: ["conversation-owners", orgId ?? null],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId!);

      if (membersError) throw membersError;
      const userIds = Array.from(new Set((members ?? []).map((member) => member.user_id)));

      if (userIds.length === 0) return [] as ConversationOwner[];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      return (profiles ?? [])
        .map((profile) => ({
          id: profile.user_id,
          label: profile.full_name ?? profile.user_id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  });
}

export function useConversationUnreadCounts() {
  const { data: orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`conversation-unread-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `org_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-unread-counts", orgId] });
          queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-unread-counts", orgId] });
          queryClient.invalidateQueries({ queryKey: ["global-conversations"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  return useQuery({
    queryKey: ["conversation-unread-counts", orgId ?? null],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,merchant_id,status,last_inbound_at,last_human_outbound_at")
        .eq("org_id", orgId!)
        .neq("status", "closed");

      if (error) throw error;

      const byMerchant: Record<string, number> = {};
      let totalUnread = 0;

      for (const conversation of data ?? []) {
        if (isUnread(conversation.last_inbound_at, conversation.last_human_outbound_at)) {
          totalUnread += 1;
          byMerchant[conversation.merchant_id] = (byMerchant[conversation.merchant_id] ?? 0) + 1;
        }
      }

      return { totalUnread, byMerchant };
    },
  });
}

export type { ConversationListRow, GlobalConversationFilters, ConversationOwner };
