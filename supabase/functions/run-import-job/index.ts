import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  return digits;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await sc.from("import_jobs")
      .select("*").eq("id", job_id).single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "queued") {
      return new Response(JSON.stringify({ error: "Job not in queued state" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set running
    await sc.from("import_jobs").update({ status: "running" }).eq("id", job_id);

    const orgId = job.org_id;
    const mapping = job.mapping as Record<string, string>;

    // Download CSV from storage
    const { data: fileData, error: dlErr } = await sc.storage.from("imports").download(job.file_path);
    if (dlErr || !fileData) {
      await sc.from("import_jobs").update({ status: "failed", stats: { error: "File download failed" } }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "File download failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await fileData.text();
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      await sc.from("import_jobs").update({ status: "failed", stats: { error: "CSV has no data rows" } }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "CSV has no data rows" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Load existing leads for dedupe
    const { data: existingLeads } = await sc.from("leads").select("id, phones, emails").eq("org_id", orgId);
    const existingPhones = new Set<string>();
    const existingEmails = new Set<string>();
    if (existingLeads) {
      for (const l of existingLeads) {
        const lp: string[] = Array.isArray(l.phones) ? l.phones : [];
        const le: string[] = Array.isArray(l.emails) ? l.emails : [];
        lp.forEach((p: string) => existingPhones.add(p));
        le.forEach((e: string) => existingEmails.add(e));
      }
    }

    let inserted = 0;
    let duplicates = 0;
    let errors = 0;
    const errorRows: { row: number; error: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      try {
        const getValue = (field: string): string => {
          const colIdx = headers.indexOf(mapping[field]);
          return colIdx >= 0 ? (row[colIdx] || "") : "";
        };

        const fullName = getValue("full_name");
        if (!fullName) {
          errors++;
          errorRows.push({ row: i + 2, error: "Missing full_name" });
          continue;
        }

        const phonesRaw = getValue("phone");
        const emailsRaw = getValue("email");
        const phones = phonesRaw ? [normalizePhone(phonesRaw)] : [];
        const emails = emailsRaw ? [normalizeEmail(emailsRaw)] : [];
        const source = getValue("source") || "csv_import";

        // Quick dedupe
        let isDupe = false;
        for (const p of phones) {
          if (existingPhones.has(p)) { isDupe = true; break; }
        }
        if (!isDupe) {
          for (const e of emails) {
            if (existingEmails.has(e)) { isDupe = true; break; }
          }
        }

        if (isDupe) {
          duplicates++;
          errorRows.push({ row: i + 2, error: "Duplicate detected" });
          continue;
        }

        const { error: insErr } = await sc.from("leads").insert({
          org_id: orgId,
          full_name: fullName,
          phones,
          emails,
          source,
          owner_user_id: job.created_by,
        });

        if (insErr) {
          errors++;
          errorRows.push({ row: i + 2, error: insErr.message });
        } else {
          inserted++;
          phones.forEach(p => existingPhones.add(p));
          emails.forEach(e => existingEmails.add(e));
        }
      } catch (rowErr: any) {
        errors++;
        errorRows.push({ row: i + 2, error: rowErr.message || "Unknown error" });
      }
    }

    // Write error report if any
    let errorReportPath: string | null = null;
    if (errorRows.length > 0) {
      const csvLines = ["row,error", ...errorRows.map(e => `${e.row},"${e.error}"`)];
      const errorCsv = csvLines.join("\n");
      const errPath = `${job.created_by}/${job_id}_errors.csv`;
      const blob = new Blob([errorCsv], { type: "text/csv" });
      await sc.storage.from("imports").upload(errPath, blob, { upsert: true });
      errorReportPath = errPath;
    }

    const stats = { total: dataRows.length, inserted, duplicates, errors };
    await sc.from("import_jobs").update({
      status: "completed",
      stats,
      error_report_path: errorReportPath,
    }).eq("id", job_id);

    // Notify job owner
    await sc.from("notifications").insert({
      org_id: orgId,
      user_id: job.created_by,
      type: "import_complete",
      title: "CSV Import Complete",
      body: `Imported ${inserted} leads. ${duplicates} duplicates, ${errors} errors.`,
      entity_type: "import_job",
      entity_id: job_id,
    });

    // Audit
    await sc.from("audit_events").insert({
      org_id: orgId,
      entity_type: "import_job",
      entity_id: job_id,
      actor_user_id: job.created_by,
      event_type: "import_completed",
      diff: stats,
    });

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
