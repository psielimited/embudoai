export type OnboardingPhoneSources = {
  merchantPhoneNumberId: string | null | undefined;
  settingsPhoneNumberId: string | null | undefined;
  sandboxPhoneNumberId: string | null | undefined;
};

export function resolveOnboardingPhoneNumberId(
  isSandbox: boolean,
  sources: OnboardingPhoneSources,
): string | null {
  if (isSandbox) {
    return sources.sandboxPhoneNumberId ?? null;
  }

  return sources.settingsPhoneNumberId ?? sources.merchantPhoneNumberId ?? null;
}

export function getGraphErrorCode(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "number" ? code : null;
}

export function isSandboxBlockedGraphError(payload: unknown): boolean {
  const code = getGraphErrorCode(payload);
  if (code === 133010) return true;

  if (!payload || typeof payload !== "object") return false;
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return false;
  const message = String((error as Record<string, unknown>).message ?? "").toLowerCase();
  return message.includes("sandbox") || message.includes("test number");
}

export function encodeSandboxErrorPayload(payload: unknown, fallbackMessage: string) {
  const code = getGraphErrorCode(payload);
  const message =
    typeof payload === "object" && payload !== null
      ? String(((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message ?? fallbackMessage)
      : fallbackMessage;

  return JSON.stringify({
    message,
    code,
    sandbox_blocked: true,
    mode: "sandbox",
  });
}

