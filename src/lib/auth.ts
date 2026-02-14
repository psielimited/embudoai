import { supabase } from "@/integrations/supabase/client";

let cachedUserId: string | null = null;
let cachedOrgId: string | null = null;

export async function getUserOrThrow() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");

  return user;
}

export async function getActiveOrgId(): Promise<string> {
  const user = await getUserOrThrow();

  if (cachedUserId === user.id && cachedOrgId) {
    return cachedOrgId;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", user.id)
    .single();

  if (error) throw error;
  if (!data?.active_org_id) throw new Error("No active org");

  cachedUserId = user.id;
  cachedOrgId = data.active_org_id;

  return data.active_org_id;
}

export function invalidateActiveOrgCache() {
  cachedOrgId = null;
}
