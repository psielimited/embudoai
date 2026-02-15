import { supabase } from "@/integrations/supabase/client";

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const message = value.error ?? value.message ?? value.error_code;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  return "Request failed";
}

export async function callEdge<T>(
  fnName: string,
  body: unknown,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("Not authenticated");

  const hasBody = typeof body !== "undefined";
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
    {
      method: hasBody ? "POST" : "GET",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: opts?.signal,
    },
  );

  if (!response.ok) {
    let payload: unknown;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => undefined);
    } else {
      payload = await response.text().catch(() => undefined);
    }

    const message = getErrorMessage(payload);
    const error = new Error(`${response.status}: ${message}`);
    (error as Error & { status?: number; data?: unknown }).status = response.status;
    (error as Error & { data?: unknown }).data = payload;
    throw error;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.blob()) as T;
}
