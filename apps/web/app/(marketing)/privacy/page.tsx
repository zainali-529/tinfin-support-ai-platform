import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Tinfin",
  description:
    "Tinfin Privacy Policy describing how we collect, use, and protect customer and end-user data.",
}

const EFFECTIVE_DATE = "April 26, 2026"

export default function PrivacyPage() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              1. Who We Are
            </h2>
            <p>
              Tinfin is a customer support SaaS platform that helps businesses
              manage conversations across channels including chat, email, voice,
              and WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              2. Data We Collect
            </h2>
            <p>Depending on usage, we may collect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Account details (name, email, organization information)</li>
              <li>Contact details (customer name, email, phone number)</li>
              <li>Support conversation content and attachments</li>
              <li>Usage, analytics, logs, and diagnostic metadata</li>
              <li>Billing and subscription metadata from payment providers</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              3. How We Use Data
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Provide and maintain the Tinfin service</li>
              <li>Route and manage customer support conversations</li>
              <li>Generate AI responses and workflow automations</li>
              <li>Improve security, reliability, and product performance</li>
              <li>Support billing, compliance, and abuse prevention</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              4. Legal Basis
            </h2>
            <p>
              We process personal data on the basis of contractual necessity,
              legitimate interests, consent (where required), and legal
              compliance obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              5. Third-Party Processors
            </h2>
            <p>
              We use trusted infrastructure and service providers, which may
              include cloud hosting, database, communication, AI, and payment
              partners (for example Meta, OpenAI, Supabase, and Stripe).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              6. Data Retention
            </h2>
            <p>
              We retain data only as long as necessary to provide services,
              comply with legal obligations, resolve disputes, and enforce
              agreements. Retention periods may vary by data type and customer
              settings.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              7. Security
            </h2>
            <p>
              We implement reasonable technical and organizational safeguards to
              protect personal data against unauthorized access, misuse, or loss.
              No method of transmission or storage is fully secure.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              8. International Transfers
            </h2>
            <p>
              Data may be processed in jurisdictions outside your country. Where
              required, we use appropriate safeguards for cross-border transfers.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              9. Your Rights
            </h2>
            <p>
              Subject to local law, you may have rights to access, correct,
              delete, restrict, or export personal data and to object to certain
              processing activities.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              10. Data Deletion Requests
            </h2>
            <p>
              To request deletion of personal data, contact us at{" "}
              <a
                href="mailto:privacy@tinfin.ai"
                className="font-medium text-foreground underline underline-offset-4"
              >
                privacy@tinfin.ai
              </a>
              . We may verify identity and request scope details before
              completing deletion.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Updates are
              effective when posted on this page with a revised effective date.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">
              12. Contact
            </h2>
            <p>
              For privacy questions, contact{" "}
              <a
                href="mailto:privacy@tinfin.ai"
                className="font-medium text-foreground underline underline-offset-4"
              >
                privacy@tinfin.ai
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  )
}

