export function isSandboxEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@yopmail.com");
}
