import { describe, expect, it } from "vitest";
import {
  encodeSandboxErrorPayload,
  isSandboxBlockedGraphError,
  resolveOnboardingPhoneNumberId,
} from "../../supabase/functions/merchant-onboarding-check/sandbox";

describe("merchant onboarding sandbox helpers", () => {
  it("uses sandbox phone id when sandbox mode is enabled", () => {
    const phoneId = resolveOnboardingPhoneNumberId(true, {
      merchantPhoneNumberId: "prod-phone",
      settingsPhoneNumberId: "prod-settings-phone",
      sandboxPhoneNumberId: "sandbox-phone",
    });

    expect(phoneId).toBe("sandbox-phone");
  });

  it("marks Graph code 133010 as sandbox-blocked", () => {
    const errorPayload = {
      error: {
        message: "Template not allowed for this sandbox recipient",
        code: 133010,
      },
    };

    expect(isSandboxBlockedGraphError(errorPayload)).toBe(true);

    const encoded = encodeSandboxErrorPayload(errorPayload, "fallback");
    expect(encoded).toContain("\"sandbox_blocked\":true");
    expect(encoded).toContain("\"code\":133010");
  });
});

