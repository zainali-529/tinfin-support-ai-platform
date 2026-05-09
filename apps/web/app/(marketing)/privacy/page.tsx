import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Tinfiz",
  description:
    "Tinfiz Privacy Policy covering account data, customer conversations, contacts, knowledge base content, usage, billing, cookies, subprocessors, and deletion requests.",
}

const EFFECTIVE_DATE = "May 9, 2026"
const PRIVACY_EMAIL = "privacy@tinfiz.ai"

const PROCESSORS = [
  ["Supabase", "Authentication, database, storage, and related infrastructure."],
  ["Stripe", "Subscription checkout, billing, invoices, and payment metadata."],
  ["AI provider", "AI response generation, embeddings, and related AI processing."],
  ["Email provider", "Outbound notifications and connected email channel delivery where enabled."],
  ["WhatsApp / Meta", "WhatsApp channel messaging where a workspace connects WhatsApp."],
  ["Vapi", "Voice assistant, call handling, transcripts, and call metadata where voice is enabled."],
] as const

export default function PrivacyPage() {
  return (
    <main className="bg-background">
      <section className="border-b border-border bg-background py-14 md:py-18">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex rounded-full border border-border bg-muted/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Privacy
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">
            This Privacy Policy explains how Tinfiz collects, uses, stores, and shares information when businesses use
            Tinfiz to manage AI-assisted customer support, unified inbox workflows, knowledge base content, channels,
            AI Actions, analytics, and billing.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[16rem_1fr] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 border border-border bg-muted/10 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">On this page</p>
              <nav className="mt-4 space-y-1 text-sm">
                {[
                  ["Overview", "overview"],
                  ["Data we collect", "data-collected"],
                  ["How data is used", "data-use"],
                  ["Processors", "processors"],
                  ["Cookies", "cookies"],
                  ["Retention", "retention"],
                  ["Deletion", "deletion"],
                  ["Contact", "contact"],
                ].map(([label, id]) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="block rounded-xl px-3 py-2 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-10 text-sm leading-7 text-muted-foreground">
            <PolicySection id="overview" title="1. Overview">
              <p>
                Tinfiz provides software for businesses that want to support customers through website chat, AI
                assistance, human handoff, email, WhatsApp, voice, knowledge base content, AI Actions, and analytics.
                The business using Tinfiz is responsible for the customer data it chooses to collect and process through
                the platform.
              </p>
              <p>
                We use information to operate, secure, improve, and support Tinfiz. We do not sell personal data.
              </p>
            </PolicySection>

            <PolicySection id="data-collected" title="2. Data We Collect">
              <p>Depending on how a workspace uses Tinfiz, we may process the following categories of information:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-foreground">Account and workspace data:</strong> user name, email address,
                  organization name, role, permissions, authentication metadata, and active workspace settings.
                </li>
                <li>
                  <strong className="text-foreground">Customer conversations:</strong> messages, replies, AI responses,
                  attachments, conversation status, assignments, notes, timeline events, CSAT ratings, and channel
                  metadata.
                </li>
                <li>
                  <strong className="text-foreground">Contacts:</strong> customer name, email, phone number, company,
                  tags, custom fields, current page or last seen data passed by the widget, and related conversation
                  history.
                </li>
                <li>
                  <strong className="text-foreground">Knowledge Base content:</strong> text notes, URLs, uploaded
                  documents, indexed chunks, source health, and metadata used to ground AI answers.
                </li>
                <li>
                  <strong className="text-foreground">AI Actions data:</strong> action configuration, required
                  parameters, execution logs, approval status, latency, failure reasons, and masked secret metadata.
                </li>
                <li>
                  <strong className="text-foreground">Usage and billing data:</strong> plan, subscription status,
                  checkout metadata, invoices, limits, conversation usage, voice minutes, knowledge base usage, add-ons,
                  and payment provider identifiers.
                </li>
                <li>
                  <strong className="text-foreground">Device and diagnostic data:</strong> browser information, IP
                  address, logs, error details, session metadata, and security or abuse-prevention signals.
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="data-use" title="3. How We Use Data">
              <ul className="list-disc space-y-2 pl-5">
                <li>Provide, maintain, and secure Tinfiz.</li>
                <li>Authenticate users and manage organization membership, roles, and permissions.</li>
                <li>Route, store, and display customer support conversations across enabled channels.</li>
                <li>Generate AI responses using approved workspace knowledge and conversation context.</li>
                <li>Run configured AI Actions and maintain logs, approvals, allowlists, and safety checks.</li>
                <li>Send notifications, operational emails, billing updates, and support communications.</li>
                <li>Measure usage, enforce plan limits, process billing, and prevent abuse.</li>
                <li>Debug issues, improve reliability, and understand product performance.</li>
              </ul>
            </PolicySection>

            <PolicySection id="processors" title="4. Third-Party Processors">
              <p>
                Tinfiz relies on trusted third-party services to operate the product. The exact services used may depend
                on which features a workspace enables.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PROCESSORS.map(([name, description]) => (
                  <div key={name} className="border border-border bg-muted/10 p-4">
                    <h3 className="text-sm font-medium text-foreground">{name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                These providers may process data in locations outside your country. Where required, appropriate
                safeguards should be used for cross-border transfers.
              </p>
            </PolicySection>

            <PolicySection id="cookies" title="5. Cookies, Local Storage, and Similar Technologies">
              <p>
                Tinfiz may use cookies, local storage, and similar browser technologies for authentication, session
                continuity, theme preferences, widget visitor continuity, onboarding state, and product settings.
              </p>
              <p>
                The website widget may store a visitor identifier in the browser so the same visitor can continue a
                conversation or create a new conversation without losing context. Website owners using Tinfiz are
                responsible for giving any cookie or tracking notices required by their laws.
              </p>
            </PolicySection>

            <PolicySection id="security" title="6. Security">
              <p>
                We use reasonable technical and organizational safeguards designed to protect data against unauthorized
                access, loss, misuse, or alteration. These include workspace-scoped access, server-side plan and
                permission checks, masked secrets, controlled AI Actions, and human approval flows for sensitive
                operations.
              </p>
              <p>
                No method of transmission or storage is fully secure. If you believe you found a security issue, contact
                us at{" "}
                <a href="mailto:security@tinfiz.ai" className="font-medium text-foreground underline underline-offset-4">
                  security@tinfiz.ai
                </a>
                .
              </p>
            </PolicySection>

            <PolicySection id="retention" title="7. Data Retention">
              <p>
                We retain data for as long as needed to provide Tinfiz, comply with legal obligations, resolve disputes,
                enforce agreements, maintain security, and support billing records. Retention periods may vary depending
                on the type of data, customer settings, backups, and legal requirements.
              </p>
            </PolicySection>

            <PolicySection id="deletion" title="8. Data Deletion and Access Requests">
              <p>
                Workspace owners may request deletion or export of workspace data by contacting us. We may need to verify
                identity, confirm authority over the workspace, and clarify scope before completing the request.
              </p>
              <p>
                Contact hard-deletion may be limited where deletion would break support history, billing records, fraud
                prevention, or legal obligations. Where possible, we may use deletion, anonymization, or access
                restriction depending on the request.
              </p>
              <p>
                Send privacy requests to{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">
                  {PRIVACY_EMAIL}
                </a>
                .
              </p>
            </PolicySection>

            <PolicySection id="children" title="9. Children">
              <p>
                Tinfiz is intended for business use and is not directed to children. Customers should not knowingly use
                Tinfiz to collect personal data from children unless they have the legal authority and required consent.
              </p>
            </PolicySection>

            <PolicySection id="changes" title="10. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Updates are effective when posted on this page with
                a revised effective date. If changes are material, we may provide additional notice where appropriate.
              </p>
            </PolicySection>

            <PolicySection id="contact" title="11. Contact">
              <p>
                For privacy questions, deletion requests, or data access requests, contact{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">
                  {PRIVACY_EMAIL}
                </a>
                .
              </p>
              <p>
                For security issues, use{" "}
                <Link href="/security" className="font-medium text-foreground underline underline-offset-4">
                  the security page
                </Link>
                .
              </p>
            </PolicySection>
          </div>
        </div>
      </section>
    </main>
  )
}

function PolicySection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border pb-8 last:border-b-0">
      <h2 className="mb-3 text-xl font-medium tracking-tight text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
