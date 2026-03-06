import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MerchantSettingsRow = Database["public"]["Tables"]["merchant_settings"]["Row"];

type MerchantOnboardingAction =
  | "refresh_status"
  | "validate_credentials"
  | "connectivity_test_outbound"
  | "check_inbound_marker"
  | "get_registration_status"
  | "request_code"
  | "verify_code"
  | "register";

type OnboardingInvokePayload = {
  merchant_id: string;
  action: MerchantOnboardingAction;
  test_to?: string;
  template_name?: string;
  template_language?: string;
  expected_from?: string;
  code_method?: "SMS" | "VOICE";
  language?: string;
  code?: string;
  pin?: string;
};

type OnboardingInvokeResponse = {
  ok?: boolean;
  error?: string;
  settings?: MerchantSettingsRow | null;
};

async function invokeOnboardingAction(payload: OnboardingInvokePayload) {
  const { data, error } = await supabase.functions.invoke<OnboardingInvokeResponse>(
    "merchant-onboarding-check",
    {
      body: payload,
    },
  );

  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error ?? "Action failed");
  return data ?? { ok: true };
}

export function useMerchantSettings(merchantId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
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

  const invalidate = async () => {
    if (!merchantId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }),
      queryClient.invalidateQueries({ queryKey: ["merchant", merchantId] }),
      queryClient.invalidateQueries({ queryKey: ["messages"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-timeline"] }),
    ]);
  };

  const refreshMutation = useMutation({
    mutationFn: async () => invokeOnboardingAction({ merchant_id: merchantId!, action: "refresh_status" }),
    onSuccess: invalidate,
  });

  const validateMutation = useMutation({
    mutationFn: async () => invokeOnboardingAction({ merchant_id: merchantId!, action: "validate_credentials" }),
    onSuccess: invalidate,
  });

  const outboundMutation = useMutation({
    mutationFn: async (params?: { testTo?: string; templateName?: string; templateLanguage?: string }) =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "connectivity_test_outbound",
        ...(params?.testTo ? { test_to: params.testTo } : {}),
        ...(params?.templateName ? { template_name: params.templateName } : {}),
        ...(params?.templateLanguage ? { template_language: params.templateLanguage } : {}),
      }),
    onSuccess: invalidate,
  });

  const inboundMutation = useMutation({
    mutationFn: async (expectedFrom?: string) =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "check_inbound_marker",
        ...(expectedFrom ? { expected_from: expectedFrom } : {}),
      }),
    onSuccess: invalidate,
  });

  const registrationStatusMutation = useMutation({
    mutationFn: async () =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "get_registration_status",
      }),
    onSuccess: invalidate,
  });

  const requestCodeMutation = useMutation({
    mutationFn: async (params?: { code_method?: "SMS" | "VOICE"; language?: string }) =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "request_code",
        ...(params?.code_method ? { code_method: params.code_method } : {}),
        ...(params?.language ? { language: params.language } : {}),
      }),
    onSuccess: invalidate,
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "verify_code",
        code,
      }),
    onSuccess: invalidate,
  });

  const registerMutation = useMutation({
    mutationFn: async (pin: string) =>
      invokeOnboardingAction({
        merchant_id: merchantId!,
        action: "register",
        pin,
      }),
    onSuccess: invalidate,
  });

  return {
    ...query,
    settings: query.data ?? null,
    refreshStatus: () => refreshMutation.mutateAsync(),
    validateCredentials: () => validateMutation.mutateAsync(),
    sendTestOutbound: (params?: { testTo?: string; templateName?: string; templateLanguage?: string }) =>
      outboundMutation.mutateAsync(params),
    checkInboundMarker: (expectedFrom?: string) => inboundMutation.mutateAsync(expectedFrom),
    getRegistrationStatus: () => registrationStatusMutation.mutateAsync(),
    requestRegistrationCode: (params?: { code_method?: "SMS" | "VOICE"; language?: string }) =>
      requestCodeMutation.mutateAsync(params),
    verifyRegistrationCode: (code: string) => verifyCodeMutation.mutateAsync(code),
    registerPhoneNumber: (pin: string) => registerMutation.mutateAsync(pin),
    isRefreshing: refreshMutation.isPending,
    isValidating: validateMutation.isPending,
    isSendingTest: outboundMutation.isPending,
    isCheckingInbound: inboundMutation.isPending,
    isCheckingRegistration: registrationStatusMutation.isPending,
    isRequestingRegistrationCode: requestCodeMutation.isPending,
    isVerifyingRegistrationCode: verifyCodeMutation.isPending,
    isRegisteringPhoneNumber: registerMutation.isPending,
  };
}
