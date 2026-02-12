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

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function last4Digits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;
  const sc = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await sc.from("profiles").select("active_org_id").eq("user_id", userId).single();
  if (!profile?.active_org_id) {
    return new Response(JSON.stringify({ error: "No active organization" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const orgId = profile.active_org_id;

  const { data: membership } = await sc.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).single();
  if (!membership || !["org_admin", "manager", "rep"].includes(membership.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { full_name, phones = [], emails = [], source = "manual", utm = {}, consent = {}, owner_user_id, tags = [] } = body;

    if (!full_name) {
      return new Response(JSON.stringify({ error: "full_name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhones: string[] = phones.map(normalizePhone);
    const normalizedEmails: string[] = emails.map(normalizeEmail);

    // Load active dedupe rules
    const { data: rules } = await sc.from("dedupe_rules").select("*").eq("org_id", orgId).eq("active", true);
    const ruleKeys: string[] = [];
    if (rules) {
      for (const r of rules) {
        const k = Array.isArray(r.keys) ? r.keys : [];
        ruleKeys.push(...k);
      }
    }
    const uniqueKeys = [...new Set(ruleKeys)];

    // Run dedupe against leads and contacts
    const matches: { entity_type: string; entity_id: string; match_reason: string; entity_name: string }[] = [];

    for (const key of uniqueKeys) {
      if (key === "phone_e164" && normalizedPhones.length > 0) {
        // Check leads
        const { data: leadHits } = await sc.from("leads").select("id, full_name, phones").eq("org_id", orgId);
        if (leadHits) {
          for (const l of leadHits) {
            const lp: string[] = Array.isArray(l.phones) ? l.phones : [];
            if (lp.some((p: string) => normalizedPhones.includes(normalizePhone(p)))) {
              if (!matches.find(m => m.entity_id === l.id)) {
                matches.push({ entity_type: "lead", entity_id: l.id, match_reason: "phone_e164", entity_name: l.full_name });
              }
            }
          }
        }
        const { data: contactHits } = await sc.from("contacts").select("id, full_name, phones").eq("org_id", orgId);
        if (contactHits) {
          for (const c of contactHits) {
            const cp: string[] = Array.isArray(c.phones) ? c.phones : [];
            if (cp.some((p: string) => normalizedPhones.includes(normalizePhone(p)))) {
              if (!matches.find(m => m.entity_id === c.id)) {
                matches.push({ entity_type: "contact", entity_id: c.id, match_reason: "phone_e164", entity_name: c.full_name });
              }
            }
          }
        }
      }

      if (key === "email_lower" && normalizedEmails.length > 0) {
        const { data: leadHits } = await sc.from("leads").select("id, full_name, emails").eq("org_id", orgId);
        if (leadHits) {
          for (const l of leadHits) {
            const le: string[] = Array.isArray(l.emails) ? l.emails : [];
            if (le.some((e: string) => normalizedEmails.includes(normalizeEmail(e)))) {
              if (!matches.find(m => m.entity_id === l.id)) {
                matches.push({ entity_type: "lead", entity_id: l.id, match_reason: "email_lower", entity_name: l.full_name });
              }
            }
          }
        }
        const { data: contactHits } = await sc.from("contacts").select("id, full_name, emails").eq("org_id", orgId);
        if (contactHits) {
          for (const c of contactHits) {
            const ce: string[] = Array.isArray(c.emails) ? c.emails : [];
            if (ce.some((e: string) => normalizedEmails.includes(normalizeEmail(e)))) {
              if (!matches.find(m => m.entity_id === c.id)) {
                matches.push({ entity_type: "contact", entity_id: c.id, match_reason: "email_lower", entity_name: c.full_name });
              }
            }
          }
        }
      }

      if (key === "name_phone" && normalizedPhones.length > 0) {
        const nameKey = normalizeName(full_name);
        const phoneKeys = normalizedPhones.map(p => `${nameKey}_${last4Digits(p)}`);
        const { data: leadHits } = await sc.from("leads").select("id, full_name, phones").eq("org_id", orgId);
        if (leadHits) {
          for (const l of leadHits) {
            const ln = normalizeName(l.full_name);
            const lp: string[] = Array.isArray(l.phones) ? l.phones : [];
            for (const p of lp) {
              const k = `${ln}_${last4Digits(p)}`;
              if (phoneKeys.includes(k) && !matches.find(m => m.entity_id === l.id)) {
                matches.push({ entity_type: "lead", entity_id: l.id, match_reason: "name_phone", entity_name: l.full_name });
              }
            }
          }
        }
      }
    }

    if (matches.length > 0) {
      return new Response(JSON.stringify({
        error_code: "DUPLICATE",
        error: "Duplicate lead detected",
        candidates: matches,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert lead
    const { data: lead, error: insertErr } = await sc.from("leads").insert({
      org_id: orgId,
      full_name,
      phones: normalizedPhones,
      emails: normalizedEmails,
      source,
      utm,
      consent,
      owner_user_id: owner_user_id || userId,
      tags,
    }).select().single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create lead" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit event
    await sc.from("audit_events").insert({
      org_id: orgId,
      entity_type: "lead",
      entity_id: lead.id,
      actor_user_id: userId,
      event_type: "lead_created",
      diff: { lead_name: full_name, source },
    });

    return new Response(JSON.stringify({ ok: true, lead }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
