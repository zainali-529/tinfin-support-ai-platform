import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | Tinfiz",
  description:
    "Tinfiz Terms of Service covering account responsibility, acceptable use, AI limitations, customer data, payments, subscriptions, add-ons, cancellation, availability, and liability.",
}

const EFFECTIVE_DATE = "May 9, 2026"
const SUPPORT_EMAIL = "support@tinfiz.ai"

export default function TermsPage() {
  return (
    <main className="bg-background">
      <section className="border-b border-border bg-background py-14 md:py-18">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex rounded-full border border-border bg-muted/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Terms
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">
            These Terms explain the rules for using Tinfiz, including account responsibilities, acceptable use,
            subscriptions, add-ons, AI features, customer data, and service limitations. They are written for clarity,
            but should be reviewed by legal counsel before a paid public launch.
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
                  ["Agreement", "agreement"],
                  ["Accounts", "accounts"],
                  ["Acceptable use", "acceptable-use"],
                  ["AI features", "ai-features"],
                  ["Customer data", "customer-data"],
                  ["Payments", "payments"],
                  ["Cancellation", "cancellation"],
                  ["Availability", "availability"],
                  ["Liability", "liability"],
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
            <TermsSection id="agreement" title="1. Agreement">
              <p>
                These Terms of Service apply when you access or use Tinfiz. By creating an account, using a workspace,
                installing the widget, connecting channels, or using paid features, you agree to these Terms.
              </p>
              <p>
                If you use Tinfiz on behalf of a company, organization, or other entity, you represent that you have
                authority to bind that entity to these Terms.
              </p>
            </TermsSection>

            <TermsSection id="accounts" title="2. Account Responsibility">
              <ul className="list-disc space-y-2 pl-5">
                <li>You are responsible for the accuracy of account and organization information.</li>
                <li>You are responsible for keeping login credentials, API credentials, and connected channel access secure.</li>
                <li>You must promptly remove team members who should no longer have access.</li>
                <li>You are responsible for activity that occurs in your workspace, including actions taken by invited users.</li>
              </ul>
            </TermsSection>

            <TermsSection id="acceptable-use" title="3. Acceptable Use">
              <p>You may not use Tinfiz to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Violate laws, regulations, third-party rights, or platform rules.</li>
                <li>Send spam, abusive, deceptive, harassing, or harmful messages.</li>
                <li>Upload malware, attempt unauthorized access, or interfere with service reliability.</li>
                <li>Use AI Actions to access systems or domains you do not control or have permission to use.</li>
                <li>Collect sensitive personal data unless you have the required legal basis and safeguards.</li>
                <li>Use Tinfiz to build or operate services that create unsafe, illegal, or deceptive outcomes.</li>
              </ul>
              <p>
                We may suspend or restrict access if we reasonably believe a workspace violates these Terms, creates
                security risk, or could harm Tinfiz, users, customers, or third parties.
              </p>
            </TermsSection>

            <TermsSection id="ai-features" title="4. AI Features and Limitations">
              <p>
                Tinfiz includes AI features such as AI responses, knowledge-based answers, AI Actions, voice assistance,
                and Agent Copilot. AI output can be incomplete, inaccurate, or inappropriate in some cases. You are
                responsible for reviewing AI output and deciding how it should be used.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>AI answers should not be treated as legal, medical, financial, or other professional advice.</li>
                <li>Knowledge Base quality affects AI answer quality.</li>
                <li>AI Actions should be configured with safe endpoints, required parameters, allowlists, and approvals.</li>
                <li>Risky write actions should require human approval before execution.</li>
              </ul>
            </TermsSection>

            <TermsSection id="customer-data" title="5. Customer Data Responsibility">
              <p>
                You retain ownership of customer conversations, contacts, knowledge base content, uploaded documents,
                and other data you add to Tinfiz. You grant Tinfiz the rights needed to process that data to provide,
                secure, maintain, and improve the service.
              </p>
              <p>
                You are responsible for obtaining any required notices, consents, permissions, or legal basis before
                collecting or processing customer data through Tinfiz, including through the widget, email, WhatsApp,
                voice, or connected actions.
              </p>
            </TermsSection>

            <TermsSection id="payments" title="6. Payments, Subscriptions, and Add-ons">
              <p>
                Paid plans, subscriptions, and add-ons are billed according to the pricing shown at checkout or in your
                billing dashboard. Stripe or another payment provider may process payments and store payment metadata.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Plans may include limits for conversations, users, knowledge bases, chunks, voice minutes, and features.</li>
                <li>Add-ons may be available for additional conversations, voice minutes, team seats, knowledge bases, or storage.</li>
                <li>Taxes, payment provider fees, currency conversion, or bank charges may apply where relevant.</li>
                <li>Failure to pay may result in restricted access, downgrade, suspension, or cancellation.</li>
              </ul>
            </TermsSection>

            <TermsSection id="cancellation" title="7. Cancellation and Plan Changes">
              <p>
                You may cancel or manage a paid subscription through the billing portal or by contacting support where
                self-service billing is not available. Cancellation usually stops future renewal, but it may not
                automatically refund charges already paid unless required by law or stated in a separate refund policy.
              </p>
              <p>
                If a subscription expires, fails, or is cancelled, access to paid features may be restricted. Your
                workspace may be limited until a valid plan is restored, downgraded, or handled according to product
                policy.
              </p>
            </TermsSection>

            <TermsSection id="availability" title="8. Service Availability and Changes">
              <p>
                We aim to provide a reliable service, but Tinfiz may be interrupted by maintenance, outages,
                third-party provider issues, internet failures, security events, or operational changes. We may modify,
                improve, limit, or discontinue features as the product evolves.
              </p>
              <p>
                Some features depend on third-party services such as AI providers, Supabase, Stripe, email providers,
                WhatsApp/Meta, Vapi, hosting, or customer-owned APIs. Their availability and policies may affect Tinfiz.
              </p>
            </TermsSection>

            <TermsSection id="liability" title="9. Disclaimers and Liability Limits">
              <p>
                Tinfiz is provided on an “as is” and “as available” basis to the fullest extent permitted by law. We do
                not guarantee that the service will be uninterrupted, error-free, secure, or that AI output will always
                be accurate.
              </p>
              <p>
                To the fullest extent permitted by law, Tinfiz will not be liable for indirect, incidental, special,
                consequential, exemplary, or punitive damages, or for lost profits, revenue, goodwill, data, or business
                interruption arising from use of the service.
              </p>
            </TermsSection>

            <TermsSection id="updates" title="10. Changes to These Terms">
              <p>
                We may update these Terms from time to time. Updated Terms become effective when posted, unless a later
                effective date is stated. Continued use of Tinfiz after updates means you accept the updated Terms.
              </p>
            </TermsSection>

            <TermsSection id="contact" title="11. Contact">
              <p>
                For questions about these Terms, contact{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
              <p>
                For privacy questions, see the{" "}
                <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                . For security issues, see the{" "}
                <Link href="/security" className="font-medium text-foreground underline underline-offset-4">
                  Security page
                </Link>
                .
              </p>
            </TermsSection>
          </div>
        </div>
      </section>
    </main>
  )
}

function TermsSection({
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
