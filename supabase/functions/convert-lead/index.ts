import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  try {
    const body = await req.json();
    const { lead_id, create_opportunity = false, pipeline_id, initial_stage_id } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await sc.from("leads")
      .select("*").eq("id", lead_id).eq("org_id", orgId).single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lead.status !== "open") {
      return new Response(JSON.stringify({ error: `Lead status is '${lead.status}', expected 'open'` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe on contacts: check phone/email overlap
    const phones: string[] = Array.isArray(lead.phones) ? lead.phones : [];
    const emails: string[] = Array.isArray(lead.emails) ? lead.emails : [];
    let existingContact: any = null;

    if (emails.length > 0) {
      const { data: cHits } = await sc.from("contacts").select("*").eq("org_id", orgId);
      if (cHits) {
        for (const c of cHits) {
          const ce: string[] = Array.isArray(c.emails) ? c.emails : [];
          if (ce.some((e: string) => emails.includes(e.toLowerCase()))) {
            existingContact = c;
            break;
          }
        }
      }
    }
    if (!existingContact && phones.length > 0) {
      const { data: cHits } = await sc.from("contacts").select("*").eq("org_id", orgId);
      if (cHits) {
        for (const c of cHits) {
          const cp: string[] = Array.isArray(c.phones) ? c.phones : [];
          if (cp.some((p: string) => phones.includes(p))) {
            existingContact = c;
            break;
          }
        }
      }
    }

    let contactId: string;
    if (existingContact) {
      // Merge: union phones/emails
      const mergedPhones = [...new Set([...existingContact.phones, ...phones])];
      const mergedEmails = [...new Set([...existingContact.emails, ...emails])];
      await sc.from("contacts").update({ phones: mergedPhones, emails: mergedEmails }).eq("id", existingContact.id);
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: cErr } = await sc.from("contacts").insert({
        org_id: orgId,
        full_name: lead.full_name,
        phones,
        emails,
        owner_user_id: lead.owner_user_id || userId,
        tags: lead.tags || [],
      }).select().single();
      if (cErr || !newContact) {
        console.error("Contact create error:", cErr);
        return new Response(JSON.stringify({ error: "Failed to create contact" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contactId = newContact.id;
    }

    // Update lead
    await sc.from("leads").update({ status: "converted", converted_contact_id: contactId }).eq("id", lead_id);

    // Audit
    const auditDiff: any = { contact_id: contactId, merged: !!existingContact };

    // Optionally create opportunity
    let opportunityId: string | null = null;
    if (create_opportunity && pipeline_id && initial_stage_id) {
      const { data: opp, error: oppErr } = await sc.from("opportunities").insert({
        org_id: orgId,
        name: `${lead.full_name} - Opportunity`,
        pipeline_id,
        stage_id: initial_stage_id,
        owner_user_id: lead.owner_user_id || userId,
      }).select().single();
      if (oppErr) {
        console.error("Opportunity create error:", oppErr);
      } else {
        opportunityId = opp.id;
        auditDiff.opportunity_id = opportunityId;
        // Audit for opportunity creation too
        await sc.from("audit_events").insert({
          org_id: orgId,
          entity_type: "opportunity",
          entity_id: opp.id,
          opportunity_id: opp.id,
          actor_user_id: userId,
          event_type: "opportunity_created",
          diff: { from_lead: lead_id, contact_id: contactId },
        });
      }
    }

    await sc.from("audit_events").insert({
      org_id: orgId,
      entity_type: "lead",
      entity_id: lead_id,
      actor_user_id: userId,
      event_type: "lead_converted",
      diff: auditDiff,
    });

    return new Response(JSON.stringify({
      ok: true,
      contact_id: contactId,
      opportunity_id: opportunityId,
      merged: !!existingContact,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
