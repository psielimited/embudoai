/**
 * Edge Function: outbound-worker
 *
 * Intended schedule: every 1 minute.
 * Pulls queued outbound jobs that are due and invokes send-whatsapp-message.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let limit = 50;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.limit === "number") {
        limit = Math.max(1, Math.min(200, Math.floor(body.limit)));
      }
    }

    const nowIso = new Date().toISOString();

    const { data: jobs, error: jobsError } = await supabase
      .from("outbound_jobs")
      .select("id, message_id, idempotency_key, status, retry_count, max_retries, next_retry_at")
      .eq("status", "queued")
      .lte("next_retry_at", nowIso)
      .order("next_retry_at", { ascending: true })
      .limit(limit);

    if (jobsError) {
      console.error("Failed to load outbound jobs:", jobsError);
      return json({ ok: false, error: "Failed to load outbound jobs" }, 500);
    }

    const summary = {
      ok: true,
      now: nowIso,
      scanned: jobs?.length ?? 0,
      sent: 0,
      requeued: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ job_id: string; error: string }>,
    };

    for (const job of jobs ?? []) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_id: job.message_id,
            idempotency_key: job.idempotency_key,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        const sendStatus = typeof payload?.send_status === "string" ? payload.send_status : "unknown";

        if (response.status === 409) {
          summary.skipped += 1;
          continue;
        }

        if (sendStatus === "sent") {
          summary.sent += 1;
          continue;
        }

        if (sendStatus === "queued") {
          summary.requeued += 1;
          continue;
        }

        if (!response.ok || sendStatus === "failed") {
          summary.failed += 1;
          summary.errors.push({
            job_id: job.id,
            error: typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`,
          });
          continue;
        }

        summary.skipped += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ job_id: job.id, error: String(error) });
      }
    }

    return json(summary, 200);
  } catch (err) {
    console.error("Unexpected outbound-worker error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
