import { useEffect } from "react";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy – Embudex";
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy – Embudex</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: February 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground sm:text-base">
          <section>
            <h2 className="text-lg font-semibold">1. Overview</h2>
            <p>
              Embudex is a WhatsApp-first AI sales and customer engagement platform that enables merchants to manage
              inbound conversations, automate responses, and track lead lifecycle data.
            </p>
            <p>
              This Privacy Policy explains how Embudex collects, uses, stores, and protects information when merchants
              and their customers use the platform.
            </p>
            <p>Embudex operates as a data processor on behalf of its merchant clients.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Who This Policy Applies To</h2>
            <p>This policy applies to:</p>
            <ul className="list-disc pl-6">
              <li>Merchants using Embudex</li>
              <li>End customers who send WhatsApp messages to merchants powered by Embudex</li>
              <li>Visitors accessing Embudex web interfaces</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Information We Collect</h2>
            <h3 className="mt-3 font-medium">A. From Merchants</h3>
            <ul className="list-disc pl-6">
              <li>Business name</li>
              <li>Contact information</li>
              <li>WhatsApp Business phone number ID</li>
              <li>Organization and team structure data</li>
              <li>Configuration settings</li>
              <li>Conversation workflow status data</li>
            </ul>

            <h3 className="mt-4 font-medium">B. From End Customers (via WhatsApp)</h3>
            <ul className="list-disc pl-6">
              <li>Phone number</li>
              <li>Message content (text, media, metadata)</li>
              <li>Timestamps</li>
              <li>Message status (sent, delivered, read)</li>
              <li>Conversation history</li>
              <li>Language detection data</li>
            </ul>
            <p>Embudex does not collect payment card data within the MVP scope.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. How We Use Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6">
              <li>Receive and process inbound WhatsApp messages</li>
              <li>Generate AI-assisted responses</li>
              <li>Store structured conversation history</li>
              <li>Route conversations to merchants or teams</li>
              <li>Track conversation status and lifecycle</li>
              <li>Improve response latency and automation quality</li>
              <li>Provide operational analytics to merchants</li>
            </ul>
            <p>We do not sell personal data.</p>
            <p>We do not use customer data for advertising purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Legal Basis for Processing</h2>
            <p>Data is processed:</p>
            <ul className="list-disc pl-6">
              <li>Under contractual necessity between Embudex and merchants</li>
              <li>Based on merchant-controlled WhatsApp opt-in mechanisms</li>
              <li>In accordance with applicable data protection laws</li>
            </ul>
            <p>
              Merchants are responsible for obtaining proper customer consent to communicate via WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Data Storage and Infrastructure</h2>
            <p>Embudex uses:</p>
            <ul className="list-disc pl-6">
              <li>Supabase for database and backend services</li>
              <li>Secure cloud infrastructure providers</li>
              <li>WhatsApp Business API for messaging transport</li>
            </ul>
            <p>
              Conversation data is stored in structured tables including merchants, conversations, and messages.
            </p>
            <p>Access is restricted through role-based access controls.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Data Retention</h2>
            <p>Conversation and message data are retained:</p>
            <ul className="list-disc pl-6">
              <li>For the duration of the merchant’s active subscription</li>
              <li>Until deletion is requested by the merchant</li>
              <li>Or as required by applicable law</li>
            </ul>
            <p>Merchants may request deletion of specific conversations or contacts.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Data Security</h2>
            <p>We implement:</p>
            <ul className="list-disc pl-6">
              <li>Encrypted connections (HTTPS/TLS)</li>
              <li>Access controls and authentication</li>
              <li>Database-level security policies</li>
              <li>Restricted service role keys</li>
              <li>Webhook signature verification</li>
            </ul>
            <p>
              No system is completely immune to risk, but reasonable administrative and technical safeguards are
              applied.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. AI Processing</h2>
            <p>AI-generated responses are produced using third-party AI models.</p>
            <p>
              Message content may be transmitted securely to AI providers solely for the purpose of generating
              contextual replies.
            </p>
            <p>AI outputs are not used to train public models using merchant data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. International Data Transfers</h2>
            <p>
              Depending on infrastructure configuration, data may be processed outside the country where the merchant
              or customer resides.
            </p>
            <p>Standard contractual and security safeguards are applied where required.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">11. Children’s Data</h2>
            <p>Embudex is not directed to individuals under 13 years of age.</p>
            <p>Merchants are responsible for ensuring compliance when communicating with minors.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">12. Merchant Responsibilities</h2>
            <p>Merchants must:</p>
            <ul className="list-disc pl-6">
              <li>Obtain lawful consent for WhatsApp communications</li>
              <li>Provide their own customer-facing privacy notice</li>
              <li>Configure access permissions responsibly</li>
              <li>Avoid uploading sensitive regulated data unless legally compliant</li>
            </ul>
            <p>Embudex does not assume liability for merchant misuse of the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">13. Data Subject Rights</h2>
            <p>Where applicable under law, individuals may have rights to:</p>
            <ul className="list-disc pl-6">
              <li>Access personal data</li>
              <li>Request correction</li>
              <li>Request deletion</li>
              <li>Object to processing</li>
            </ul>
            <p>
              Requests should be directed to the merchant who controls the data. Embudex will assist merchants in
              fulfilling lawful requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">14. Changes to This Policy</h2>
            <p>
              This policy may be updated periodically. The latest version will be posted on the Embudex website with
              the updated effective date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">15. Contact</h2>
            <p>Embudex</p>
            <p>Email: privacy@embudex.com</p>
          </section>
        </div>
      </section>
    </div>
  );
}
