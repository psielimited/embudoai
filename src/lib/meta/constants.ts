export const META_APP_ID = "1622842462247348";
export const META_EMBEDDED_SIGNUP_CONFIG_ID_SANDBOX = "1244337593924446";

export function getMetaRedirectUri() {
  const fromEnv = import.meta.env.VITE_META_REDIRECT_URI as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  if (typeof window !== "undefined") return `${window.location.origin}/auth/meta/callback`;
  return "/auth/meta/callback";
}

export function getMetaEmbeddedSignupConfigIdProd() {
  const fromEnv = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID_PROD as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return "3760507624246199";
}
