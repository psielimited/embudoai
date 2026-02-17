import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId } from "@/lib/auth";
import { callEdge } from "@/lib/edge";
import type { Merchant } from "@/types/database";
import type { Database } from "@/integrations/supabase/types";

export type MerchantSettingsRow = Database["public"]["Tables"]["merchant_settings"]["Row"];

export function useMerchants() {
  return useQuery({
    queryKey: ["merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,name,status,created_at")
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

type CreateMerchantInput = {
  name: string;
};

type UpdateMerchantInput = {
  id: string;
  updates: Partial<Omit<Merchant, "id" | "org_id" | "created_at">>;
};

export function useCreateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: CreateMerchantInput) => {
      const orgId = await getActiveOrgId();
      const { data, error } = await supabase
        .from("merchants")
        .insert({ name: name.trim(), org_id: orgId, status: "active" })
        .select("*")
        .single();

      if (error) throw error;
      return data as Merchant;
    },
    onSuccess: (merchant) => {
      queryClient.setQueryData<Merchant[]>(["merchants"], (current = []) => [merchant, ...current]);
      queryClient.setQueryData<Merchant | null>(["merchant", merchant.id], merchant);
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
  });
}

export function useUpdateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: UpdateMerchantInput) => {
      const { data, error } = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return data as Merchant;
    },
    onSuccess: (merchant) => {
      queryClient.setQueryData<Merchant[]>(["merchants"], (current = []) =>
        current.map((row) => (row.id === merchant.id ? { ...row, ...merchant } : row)),
      );
      queryClient.setQueryData<Merchant | null>(["merchant", merchant.id], merchant);
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["merchant", merchant.id] });
    },
  });
}

export function useDeactivateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("merchants")
        .update({ status: "inactive" })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return data as Merchant;
    },
    onSuccess: (merchant) => {
      queryClient.setQueryData<Merchant[]>(["merchants"], (current = []) =>
        current.map((row) => (row.id === merchant.id ? { ...row, ...merchant } : row)),
      );
      queryClient.setQueryData<Merchant | null>(["merchant", merchant.id], merchant);
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["merchant", merchant.id] });
    },
  });
}

export function useMerchantSettings(merchantId?: string) {
  return useQuery({
    queryKey: ["merchant-settings", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_settings")
        .select("*")
        .eq("merchant_id", merchantId!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as MerchantSettingsRow | null;
    },
    refetchInterval: 30_000,
  });
}

type MerchantOnboardingAction =
  | "validate_credentials"
  | "connectivity_test_outbound"
  | "check_inbound_marker"
  | "refresh_status";

export function useRunMerchantOnboardingCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      merchantId: string;
      action: MerchantOnboardingAction;
      payload?: Record<string, unknown>;
    }) => {
      return await callEdge<Record<string, unknown>>("merchant-onboarding-check", {
        merchant_id: params.merchantId,
        action: params.action,
        ...(params.payload ?? {}),
      });
    },
    onSuccess: (_result, params) => {
      queryClient.invalidateQueries({ queryKey: ["merchant-settings", params.merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", params.merchantId] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-timeline"] });
    },
  });
}
