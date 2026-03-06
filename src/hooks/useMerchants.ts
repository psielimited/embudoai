import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveOrgId } from "@/lib/auth";
import { callEdge, isEdgeError } from "@/lib/edge";
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
        .select("id,name,org_id,status,created_at")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Merchant | null;
    },
    enabled: !!id,
  });
}

export type MerchantCredentials = {
  whatsapp_phone_number_id: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_app_secret: string | null;
  whatsapp_access_token: string | null;
};

export function useMerchantCredentials(merchantId?: string) {
  return useQuery({
    queryKey: ["merchant-credentials", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const result = await callEdge<{ ok: boolean; credentials: MerchantCredentials }>(
        "manage-merchant-credentials",
        { merchant_id: merchantId, action: "read" },
        { noThrow: true },
      );

      if (isEdgeError(result)) {
        // Non-admin users get 403 – return null gracefully
        if ((result as any).status === 403) return null;
        throw new Error((result as any).message ?? "Failed to load credentials");
      }

      return result.credentials;
    },
  });
}

export function useUpdateMerchantCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ merchantId, credentials }: { merchantId: string; credentials: Partial<MerchantCredentials> }) => {
      const result = await callEdge<{ ok: boolean }>("manage-merchant-credentials", {
        merchant_id: merchantId,
        action: "update",
        credentials,
      }, { noThrow: true });

      if (isEdgeError(result)) {
        // Temporary fallback while edge function deploy/permissions are being stabilized.
        if (result.status === 403 || result.status === 404) {
          const updates: Record<string, string | null> = {};
          for (const [key, value] of Object.entries(credentials)) {
            updates[key] = typeof value === "string" && value.trim() !== "" ? value.trim() : null;
          }

          const { error } = await supabase
            .from("merchants")
            .update(updates)
            .eq("id", merchantId);

          if (error) throw error;
          return { ok: true };
        }
        throw new Error(result.message || "Failed to update credentials");
      }

      return result;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["merchant-credentials", vars.merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", vars.merchantId] });
    },
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
  | "get_registration_status"
  | "request_code"
  | "verify_code"
  | "register"
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
