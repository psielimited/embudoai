export const META_APP_ID = "1622842462247348";
export const META_CONFIG_ID = "3760507624246199";

export function getMetaRedirectUri() {
  const fromEnv = import.meta.env.VITE_META_REDIRECT_URI as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  if (typeof window !== "undefined") return `${window.location.origin}/auth/meta/callback`;
  return "/auth/meta/callback";
}
