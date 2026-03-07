# Embudex Demo V1 Playbook

## Objective
Ship a reliable, repeatable Embudex demo that proves business value in under 7 minutes.

Primary outcome for the viewer:
- Embudex helps convert inbound conversations into qualified opportunities faster.

## Demo Modes
1. Guided mode (sales call): 5-7 minute scripted path.
2. Self-guided mode (async trial): click-through tour with seeded data and safe reset.

## ICP Demo Story
Persona:
- Revenue ops or founder at a service business using WhatsApp for inbound leads.

Problem:
- Leads come in fast, follow-ups are inconsistent, pipeline visibility is poor.

Transformation:
- AI handles first response + qualification.
- Human is looped in only when needed.
- Opportunities and reporting update automatically.

## 7-Minute Guided Script
## 0:00 - 0:45 | Set context
- Open dashboard and state baseline:
  - inbound volume,
  - response delay,
  - dropped leads.
- One line: "We will turn one inbound conversation into a qualified opportunity and track it in reporting."

## 0:45 - 2:00 | New inbound conversation
- Go to Conversations.
- Open a seeded contact with a realistic inquiry.
- Show AI response behavior and conversation timeline.

## 2:00 - 3:15 | Human handoff + control
- Show owner/assignee and handoff controls.
- Add a note and next step.
- Emphasize "AI-first, human-approved when needed."

## 3:15 - 4:30 | Pipeline conversion
- Move to Pipeline.
- Show created/updated opportunity tied to the conversation.
- Update stage and expected value.

## 4:30 - 5:30 | Merchant/channel readiness
- Open Merchant Settings.
- Show healthy credential/connectivity/registration status.
- Confirm outbound/inbound checks are passing in demo tenant.

## 5:30 - 6:30 | Reporting and proof
- Open Reports.
- Show response-time and conversion movement from seeded baseline.
- Tie to an ROI statement.

## 6:30 - 7:00 | CTA
- Offer next step:
  - pilot workspace,
  - live data onboarding,
  - stakeholder demo.

## Seed Data Requirements (Demo Tenant)
## Required entities
- 1 org: `Embudex Demo Org`
- 2 merchants:
  - `Northstar Dental`
  - `Apex Home Services`
- 25-40 conversations across both merchants.
- 8-12 leads with mixed quality.
- 6-10 opportunities across stages.
- 1-2 handoff examples with notes.

## Required status profile
- At least one merchant fully healthy:
  - credentials valid,
  - webhook valid,
  - registration status = registered,
  - outbound test passing with approved template.
- One merchant with controlled issues (optional) for troubleshooting narrative.

## Conversation fixture mix
- New inquiry, pricing question, no-response follow-up, handoff-required, and closed-won style threads.
- Include realistic timestamps over the last 14 days for trend charts.

## Demo KPIs to show
- First response time.
- Qualified lead count.
- Opportunity conversion rate.
- Estimated pipeline value.

## Reset Strategy
Use a "known-good demo org" and reset between sessions.

## Reset actions (minimum)
1. Restore conversation statuses and assignments.
2. Restore opportunity stages/amounts.
3. Clear temporary notes created during demo.
4. Re-seed timeline events so charts remain stable.
5. Validate merchant health snapshot still shows green.

## Current reset scaffold (implemented)
- Edge function: `demo-reset`
- Allowed only for admin users in orgs whose name includes `demo` (case-insensitive).
- Actions:
  - `preview`
  - `seed`
  - `cleanup`
  - `reset` (cleanup then seed)
- Current implementation delegates to `dev-validation-seed` for deterministic baseline generation.

## Guardrails
- Never run demo on production customer orgs.
- Keep API credentials in service-only paths.
- Ensure reset script is idempotent.

## Implementation Checklist (Engineering)
## Phase 1 - This week (must have)
1. Create demo org seed flow under `supabase/seeds`.
2. Add one-click reset function (admin only), e.g. edge function `demo-reset`.
3. Add `demo_mode` flag in org metadata or env-gated org allowlist.
4. Add seeded "golden path" conversation and opportunity records.
5. Add a read-only "Demo script" panel (optional but high value) with 6 steps.

## Phase 2 - Next week (should have)
1. Self-guided tour tooltips across:
  - `/dashboard`
  - `/conversations`
  - `/pipeline`
  - `/merchants/:merchantId/settings`
  - `/dashboard/reports`
2. Progress tracking: completed demo steps per user.
3. Auto-reset scheduler for demo tenant nightly.

## Phase 3 - Later (nice to have)
1. Scenario switcher:
  - high-volume support,
  - sales qualification,
  - reactivation campaign.
2. "Before vs after" ROI calculator using seeded and live assumptions.

## Definition of Done (V1)
- A new seller can run the script in 7 minutes without engineering help.
- Demo never blocks on external setup during call.
- Reset takes under 2 minutes and always returns to known-good state.
- At least 3 KPI moments are visible and understandable.

## Success Metrics
- Demo-to-pilot conversion rate.
- Average sales cycle length after demo adoption.
- Time to first value in self-guided mode.
- Drop-off step in guided/self-guided flow.

## Team Operating Rhythm
- Weekly demo QA run (sales + product + eng).
- Track broken moments and fix before next external demos.
- Maintain one owner for demo data quality and reset reliability.
