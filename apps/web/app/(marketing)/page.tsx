import HeroNoMediaSection from "@/components/marketing/HeroNoMediaSection";
import { Header } from "@/components/marketing/header";
import { WhyNowSection } from "@/components/marketing/why-now-section";
import { UnifiedInboxSection } from "@/components/marketing/UnifiedInboxSection";
import { GroundedKnowledgeSection } from "@/components/marketing/GroundedKnowledgeSection";
import { ChannelsSection } from "@/components/marketing/ChannelsSection";
import { AnalyticsCsatSection } from "@/components/marketing/AnalyticsCsatSection";
import { AIActionsSection } from "@/components/marketing/AIActionsSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingCTASection } from "@/components/marketing/MarketingCTASection";
import { MarketingFAQSection, type MarketingFAQ } from "@/components/marketing/MarketingFAQSection";

const HOME_FAQS: MarketingFAQ[] = [
  {
    question: "Is Tinfiz only a chatbot?",
    answer:
      "No. Tinfiz includes the website chat widget, grounded AI answers, a unified inbox, team assignments, internal notes, SLA visibility, AI Actions, CSAT, and analytics in one support workspace.",
  },
  {
    question: "Does the AI answer from my own knowledge base?",
    answer:
      "Yes. Add text notes, URLs, or documents to the Knowledge Base. Tinfiz uses approved workspace knowledge as context and shows trust signals to agents when answers are grounded.",
  },
  {
    question: "What happens when AI is not confident?",
    answer:
      "The assistant should avoid pretending. It can give a clear fallback, offer human help, and create improvement signals so your team can add better knowledge content later.",
  },
  {
    question: "Can human agents take over conversations?",
    answer:
      "Yes. Agents can take over, assign conversations, add internal notes, review the timeline, use Copilot assistance, and resolve conversations when the customer is handled.",
  },
  {
    question: "Which channels does Tinfiz support?",
    answer:
      "Website chat is available from the start. Pro and Scale plans unlock email, WhatsApp, voice, analytics, AI Actions, and Agent Copilot depending on your plan.",
  },
  {
    question: "Are AI Actions safe for real API workflows?",
    answer:
      "AI Actions use explicit endpoints, required parameters, domain allowlists, secrets handling, execution logs, and approval flows for risky write actions.",
  },
]

export default function HomePage() {
  return (
    <>
      <Header />
      <HeroNoMediaSection />
      <WhyNowSection />
      <UnifiedInboxSection />
      <AIActionsSection />
      <GroundedKnowledgeSection />
      <ChannelsSection />
      <AnalyticsCsatSection />
      <MarketingFAQSection
        id="faq"
        eyebrow="Questions"
        title="Common questions before you start."
        description="A quick, practical overview of how Tinfiz fits into a support workflow without overcomplicating your setup."
        faqs={HOME_FAQS}
      />
      <MarketingCTASection
        eyebrow="Start simple"
        title="Bring AI, humans, and support channels into one calm workspace."
        description="Start with the widget and knowledge base, then add channels, AI Actions, voice, CSAT, and reporting when your team is ready."
        primary={{ label: "Start free", href: "/signup" }}
        secondary={{ label: "Book a demo", href: "/demo" }}
        note="Free plan is available for testing. Upgrade when you need higher limits, channels, analytics, AI Actions, or Agent Copilot."
      />
      <MarketingFooter />
    </>
  )
}
