import { useEffect } from "react";

export default function DataDeletionPolicy() {
  useEffect(() => {
    document.title = "Data Deletion Policy – Embudex";
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Data Deletion Policy – Embudex</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground sm:text-base">
          <section>
            <h2 className="text-lg font-semibold">1. Purpose</h2>
            <p>
              This page explains how Embudex handles user data deletion requests and how individuals can request
              deletion of data associated with their interaction with merchants using Embudex.
            </p>
            <p>
              Meta requires apps that use Meta Platform products to provide either (a) a data deletion callback URL or
              (b) a user-facing data deletion instructions URL.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. What Data Embudex May Store</h2>
            <p>
              Depending on the merchant’s configuration and your interaction channel, Embudex may store:
            </p>
            <ul className="list-disc pl-6">
              <li>Contact identifiers (such as WhatsApp phone number)</li>
              <li>Message content and timestamps</li>
              <li>Message delivery/read status metadata</li>
              <li>Conversation workflow data (assignment, tags, status)</li>
              <li>Merchant account configuration identifiers (not end-user content)</li>
            </ul>
            <p>Embudex does not sell personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. How to Request Deletion</h2>

            <h3 className="mt-3 font-medium">A. If You Messaged a Merchant on WhatsApp</h3>
            <p>
              Embudex operates as a processor for the merchant you contacted. Deletion requests for WhatsApp
              conversation data are handled by the merchant (the data controller). Embudex will delete data when
              instructed by the merchant or when a valid platform deletion request applies.
            </p>

            <h3 className="mt-4 font-medium">B. If You Are Submitting a Meta “User Data Deletion” Request</h3>
            <p>
              If you used a Meta surface that triggers a “User Data Deletion Requested” event for our app, Meta will
              send Embudex a signed request to our Data Deletion Callback endpoint.
            </p>
            <p>When Embudex receives that request, we:</p>
            <ul className="list-disc pl-6">
              <li>Validate the signed request</li>
              <li>Identify the associated app-scoped Meta user identifier</li>
              <li>Delete or de-identify data associated with that identifier within Embudex systems</li>
              <li>
                Return a confirmation code and a status URL, as required by Meta’s callback contract
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. What Gets Deleted</h2>
            <p>
              When a valid deletion request applies, Embudex deletes or irreversibly de-identifies, where technically
              feasible:
            </p>
            <ul className="list-disc pl-6">
              <li>Contact records tied to the requesting identifier</li>
              <li>Conversations and messages tied to that identifier</li>
              <li>Message metadata (timestamps, delivery/read status) tied to that identifier</li>
            </ul>
            <p>Data that may be retained in limited form:</p>
            <ul className="list-disc pl-6">
              <li>Security logs and abuse-prevention logs (minimal, time-limited, access-restricted)</li>
              <li>Operational audit trails required to maintain system integrity</li>
              <li>Records required to comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Status Check for Meta Callback Deletions</h2>
            <p>
              For Meta-initiated deletion requests, Embudex provides a status page that can be checked using a
              confirmation code returned at request time. Meta’s expected response format includes:
            </p>
            <ul className="list-disc pl-6">
              <li>url: status URL where the user can check deletion status</li>
              <li>confirmation_code: an alphanumeric code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Contact</h2>
            <p>For deletion and privacy-related inquiries:</p>
            <p>Embudex</p>
            <p>Email: privacy@embudex.com</p>
          </section>
        </div>
      </section>
    </div>
  );
}
