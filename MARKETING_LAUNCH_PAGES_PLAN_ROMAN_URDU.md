# Marketing Launch Pages Plan - Tinfiz

Date: 2026-05-05  
Goal: First launch ke liye clean, professional, screenshot-led marketing website plan  
Mode: Minimal but conversion-ready. Over-animated nahi, over-filled nahi.

---

## Short Answer

First launch ke liye humein bohat zyada marketing pages ki zaroorat nahi. Product dashboard already strong hai, is liye marketing website ka kaam ye hona chahiye:

- Visitor ko 5 seconds mein samajh aa jaye Tinfiz kya karta hai.
- Real product screenshots/GIFs se trust banay.
- Pricing simple aur honest ho.
- Docs/install path clear ho.
- Signup/demo CTA har important jagah visible ho.

Recommended first launch pages:

1. `/` - Home / Landing page
2. `/pricing` - Pricing and plan comparison
3. `/demo` ya `/contact` - Book demo / contact sales / support inquiry
4. `/security` - Security, privacy, data handling, AI safety
5. `/privacy` - Privacy policy
6. `/terms` - Terms of service
7. `/docs` - Already product docs center, marketing se linked

Total public launch pages: **6 marketing/legal pages + docs center**.

Abhi `/customers`, `/compare/intercom`, `/integrations`, `/changelog`, `/blog` launch se pehle zaroori nahi. Inko later add karna better hai jab real customers, proof, aur use cases aa jayen.

---

## Current Marketing Pages Audit

Current marketing setup mein ye files/components hain:

- `apps/web/app/(marketing)/page.tsx`
- `apps/web/app/(marketing)/layout.tsx`
- `apps/web/app/(marketing)/privacy/page.tsx`
- `apps/web/components/marketing/HeroSection.tsx`
- `apps/web/components/marketing/ProductPillarsSection.tsx`
- `apps/web/components/marketing/ScrollStorySection.tsx`
- `apps/web/components/marketing/logo-cloud.tsx`
- `apps/web/components/marketing/header.tsx`
- `apps/web/components/marketing/why-now-section.tsx`

### Problems

- Hero copy dummy/lorem style hai.
- Header links mein multiple `#` placeholders hain.
- Logo cloud mein third-party logos "Companies we collaborate with" ke naam se show ho rahe hain. Agar real partnership nahi hai to launch ke liye risky/trust-damaging hai.
- Scroll story section mein "Demo Video Placeholder" aa raha hai.
- Product value ka actual dashboard ke saath mapping weak hai.
- Existing design animated grid style zyada "AI generated landing page" feel de sakta hai.
- Product itna mature ho chuka hai ke marketing ko abstract animations ke bajaye real screenshots/GIFs dikhani chahiye.

### Recommendation

Current marketing page ko scratch se rewrite karna better hai. Kuch components ke ideas reuse ho sakte hain, lekin final launch page should be:

- Screenshot-led.
- Clear English copy.
- Low animation.
- Strong product specificity.
- Consistent with dashboard UI.

---

## Marketing Positioning

### One-line positioning

Recommended English headline:

> AI support workspace for teams that need answers, inbox control, and human handoff in one place.

Alternative:

> AI customer support that stays grounded, works across channels, and keeps your team in control.

### Short subtitle

> Tinfiz combines a website widget, unified inbox, knowledge base, AI actions, email, WhatsApp, voice, CSAT, analytics, and Agent Copilot in one support workspace.

### Simple promise

Tinfiz ka promise ye hona chahiye:

- Customers get faster answers.
- AI stays grounded in approved knowledge.
- Agents keep control through inbox, notes, timeline, and Copilot.
- Teams measure quality through SLA, CSAT, analytics, and AI improvement signals.

### Avoid these claims

Launch se pehle in claims ko avoid karo:

- "Fully replace your support team."
- "100% automated support."
- "Works with every channel."
- "Enterprise-grade compliance" jab tak actual policies/docs ready na hon.
- "Trusted by Nvidia/OpenAI/etc." agar real customers/partnership nahi.

---

## Design Direction

### Theme name

**Operational Calm**

Ye theme product ke nature ke liye best hai: support, AI, reliability, inbox, analytics. Is mein flashy gradient AI website wali feel nahi hogi.

### Visual direction

- Background: clean off-white/light mode, graphite/dark mode.
- Accent: current dashboard green/teal primary, but controlled usage.
- Borders: subtle 1px borders.
- Shadows: minimum ya none. Depth borders, spacing, and contrast se aay.
- Typography: dashboard ke saath consistent, clean SaaS style.
- Motion: only meaningful motion.
- Cards: less card soup. More editorial sections + real product frames.

### What should feel premium

- Large real screenshots.
- Clear spacing.
- Thin borders.
- Product details visible.
- Calm copy.
- Fewer sections, better hierarchy.
- No generic "AI magic" blobs.

### Animation rule

Use only:

- Gentle hero screenshot reveal.
- Hover states.
- Small marquee not needed unless logos real hon.
- GIF/video loops for actual workflow.

Avoid:

- Heavy scroll-jacking.
- Too many pulsing elements.
- Floating dashboard cards everywhere.
- Fake metrics animations.

---

## Screenshot, GIF, and Video Strategy

### Core rule

Marketing media should show the product doing real work. Decorative illustrations secondary honi chahiye.

### Recommended media folders

Docs ke liye already:

- `apps/web/public/docs-assets/screenshots/light`
- `apps/web/public/docs-assets/screenshots/dark`

Marketing ke liye separate structure recommend karta hoon:

- `apps/web/public/marketing/screenshots/light`
- `apps/web/public/marketing/screenshots/dark`
- `apps/web/public/marketing/videos`
- `apps/web/public/marketing/gifs`

### Screenshot size

Docs ke liye aapka target: **1902x941**.

Marketing ke liye bhi same size use kar sakte ho taake reuse easy ho:

- Product dashboard screenshots: `1902x941`
- Hero composite screenshot: `1902x941`
- Feature screenshots: `1902x941`
- Mobile/widget screenshots: `900x1100` ya `1080x1350`

### Light/dark screenshot strategy

Marketing mein bhi light/dark assets rakho, lekin har jagah dual assets zaroori nahi.

Best approach:

- Home hero: current site theme ke hisaab se light/dark screenshot switch.
- Feature sections: same.
- Pricing page: media ki zaroorat nahi.
- Security page: media ki zaroorat nahi.
- Demo/contact page: one small product screenshot enough.

### Videos

Use short MP4 loops instead of heavy GIF where possible.

Recommended specs:

- Format: MP4/WebM.
- Length: 8 to 18 seconds.
- Muted autoplay loop.
- Size optimized under 3-5 MB if possible.
- Show real UI, not animated placeholders.

### Where videos/GIFs use karni hain

1. Home hero:
   - Option A: static product composite screenshot.
   - Option B: 10 sec silent video showing widget message -> inbox realtime -> AI answer.
   - First launch ke liye static screenshot safer hai.

2. Workflow section:
   - 3 short mini videos/GIFs:
   - Install widget.
   - AI answers from KB.
   - Agent takes over and uses Copilot.

3. AI Actions section:
   - Small video: user asks order status -> AI action executes -> answer appears.

4. Widget section:
   - Small video: widget open, chat, dark/light customization, CSAT.

### What screenshots to capture first

Minimum screenshot set for marketing launch:

- `hero-dashboard.png` - dashboard + inbox/product composite.
- `unified-inbox.png` - conversation list + selected conversation + timeline/Copilot.
- `widget-preview.png` - customer widget in light/dark.
- `knowledge-base-health.png` - source health + AI improvements.
- `ai-actions-logs.png` - action builder/test/logs/approvals.
- `analytics-csat.png` - analytics page with CSAT/SLA/action quality.
- `customer-profile.png` - contact intelligence/timeline.
- `billing-pricing.png` - optional, if pricing page needs product context.

---

## Required Launch Pages

## 1. Home Page - `/`

### Purpose

Home page ka kaam visitor ko quickly convince karna hai:

- Ye kis ke liye hai?
- Kya solve karta hai?
- Product real hai?
- Start kaise karna hai?

### Recommended sections

#### Section 1 - Hero

Content:

- Clear headline.
- Short subtitle.
- Two CTAs.
- Real product screenshot.

Recommended CTAs:

- Primary: `Start free`
- Secondary: `View docs` ya `Book demo`

Recommended hero copy:

> AI support workspace for fast answers and human control.

Subtitle:

> Tinfiz combines a website widget, unified inbox, grounded AI answers, AI actions, email, WhatsApp, voice, CSAT, and analytics in one workspace.

Media:

- Use `hero-dashboard.png`.
- Best: framed screenshot with dashboard/inbox visible.
- Avoid giant abstract grid background.

#### Section 2 - Problem / Why now

Keep it short.

Explain:

- Support is spread across chat, email, WhatsApp, calls.
- AI can help, but only if grounded and controllable.
- Agents need context, ownership, and analytics.

Use 3 small points:

- Slow replies.
- Context switching.
- Untrusted AI answers.

Media:

- No video needed.
- Use simple text rows or small visual from inbox.

#### Section 3 - Product workflow

Show exact workflow:

1. Install widget.
2. Add Knowledge Base.
3. AI answers from approved sources.
4. Human agent takes over when needed.
5. Team tracks CSAT, SLA, and action quality.

Media:

- One horizontal workflow diagram.
- Optional small GIF for widget -> inbox realtime.

#### Section 4 - Unified inbox

Highlight:

- Realtime conversations.
- Saved views.
- Assignments.
- SLA/backlog indicators.
- Notes/timeline.
- Agent Copilot.

Media:

- `unified-inbox.png`

#### Section 5 - Grounded AI and Knowledge Base

Highlight:

- Text, URL, document sources.
- Source health.
- AI Improvements.
- Channel-aware behavior.
- No verified answer handling.

Media:

- `knowledge-base-health.png`

#### Section 6 - AI Actions

Highlight:

- API endpoint actions.
- Required parameters.
- Test panel.
- Execution preview.
- Logs.
- Approval for risky write actions.
- Secrets and domain allowlist.

Important:

Don't call it "procedures" or "connectors v2" yet. Keep promise to v1.

Media:

- `ai-actions-logs.png`
- Optional short video for order status test.

#### Section 7 - Channels

Show:

- Website chat.
- Email.
- WhatsApp.
- Voice.

Mention:

- Starter does not include email/WhatsApp/voice.
- Pro/Scale include channels.

Media:

- Small 4-column channel cards.
- No heavy screenshots needed.

#### Section 8 - Analytics and CSAT

Highlight:

- Conversation demand.
- SLA pressure.
- CSAT.
- AI/action quality.
- Channel quality.
- Launch readiness.

Media:

- `analytics-csat.png`

#### Section 9 - Pricing preview

Show 3-4 cards:

- Free
- Starter
- Pro
- Scale

Home page par detailed comparison nahi, just preview.

CTA:

- `See pricing`

#### Section 10 - Final CTA

Simple:

> Launch AI support without losing human control.

CTA:

- `Start free`
- `Read setup guide`

### Sections to avoid on Home for launch

- Logo cloud unless real customer logos.
- Long testimonials unless real.
- Too many animated product mockups.
- Compare table with Intercom before legal/product accuracy is ready.
- "Trusted by" without proof.

---

## 2. Pricing Page - `/pricing`

### Purpose

Pricing page ka kaam confusion remove karna hai. Customer ko clear ho:

- Kis plan mein kya hai?
- Limits kya hain?
- Add-ons kya hain?
- Trial/discount kaise apply hota hai?
- Upgrade kyun karna hai?

### Current plan source of truth

Current backend plan data:

| Plan | Price | Conversations | Voice | Team | KB | Key features |
|---|---:|---:|---:|---:|---:|---|
| Free | $0 | 50/mo | 0 min | 1 | 1 KB / 100 chunks | Chat widget, AI replies, KB |
| Starter | $19/mo | 300/mo | 0 min | 2 | 3 KB / 750 chunks | Widget customization, team |
| Pro | $29/mo | 1,500/mo | 60 min | 5 | 5 KB / 2,000 chunks | Email, WhatsApp, voice, actions, Copilot, analytics |
| Scale | $79/mo | 6,000/mo | 250 min | 20 | 20 KB / 20,000 chunks | Pro plus scale limits and priority support |

### Add-ons

Show add-ons clearly:

- Extra conversations: minimum 1000.
- Extra voice minutes: minimum 50.
- Extra team seats: minimum 1.
- Extra knowledge bases: minimum 1.
- Extra KB chunks: minimum 2500.

Important:

- Price after discount should be visible.
- Due today should be visible.
- Trial impact should be visible.
- No "promo code required" if discount is automatic.

### Recommended sections

1. Pricing hero.
2. Plan cards.
3. Detailed feature comparison.
4. Add-ons.
5. FAQ.
6. Final CTA.

### Media usage

Pricing page par screenshots kam rakho. Pricing page should be clean and fast.

Optional:

- One tiny product strip under hero.

---

## 3. Demo / Contact Page - `/demo` or `/contact`

### Recommendation

First launch ke liye `/demo` better hai, because SaaS support product mein demo CTA zyada natural hai. Is page par contact form bhi ho sakta hai.

### Purpose

Visitors jo ready nahi hain direct signup ke liye, woh yahan inquiry/demo request bhej sakte hain.

### Fields

Keep it short:

- Name
- Work email
- Company
- Website URL
- Support channels needed
- Message

Optional:

- Team size.
- Current tool.

### Recommended sections

1. Demo hero.
2. Short form.
3. What happens next.
4. Links to docs/pricing.

### Media

- Small product screenshot or widget screenshot.
- No video needed.

---

## 4. Security Page - `/security`

### Purpose

AI support product mein trust important hai. Security page launch ke liye bohat useful hai, even if basic ho.

### Must cover

- Data ownership.
- Knowledge Base data handling.
- AI grounding.
- AI Actions safety.
- Secrets handling.
- Domain allowlist.
- Human approval for risky actions.
- Billing/security basics.
- Contact for security issues.

### Copy tone

Overclaim nahi karna. Simple honest security page:

> Tinfiz is designed with workspace isolation, controlled AI actions, and human approval flows for sensitive operations.

### Sections

1. Security overview.
2. Workspace isolation.
3. AI and Knowledge Base.
4. AI Actions safety.
5. Secrets and allowlists.
6. Access control and team roles.
7. Incident/contact.

### Media

No screenshots required.

---

## 5. Privacy Page - `/privacy`

Already exists, but launch se pehle update karna hoga.

Must include:

- What data is collected.
- Customer conversations.
- Contacts.
- Knowledge Base.
- Usage/billing data.
- Third-party processors: Supabase, Stripe, AI provider, email provider, WhatsApp/Meta, Vapi.
- Data deletion/contact.
- Cookies/local storage.

Important:

Legal page real policy honi chahiye, dummy nahi.

---

## 6. Terms Page - `/terms`

Currently missing. Launch se pehle add karna recommended hai.

Must include:

- Account responsibility.
- Acceptable use.
- AI limitations.
- Customer data responsibility.
- Payment/subscription/add-ons.
- Cancellation.
- Service availability.
- Liability limits.
- Contact.

Important:

Terms legal counsel se review karwana best hai before paid launch.

---

## Docs Center - `/docs`

Docs marketing page nahi hai, but conversion ke liye equally important hai.

Marketing se docs mein clear links hone chahiye:

- Hero secondary CTA: `View setup docs`
- Widget section CTA: `Read widget install guide`
- AI section CTA: `Read Knowledge Base guide`
- Actions section CTA: `Read AI Actions guide`
- Pricing FAQ CTA: `See billing and limits docs`

Docs screenshots already theme-aware hain, so docs product proof ka strong part ban sakte hain.

---

## Pages Not Needed For First Launch

### `/customers`

Abhi real customers nahi hain to customer stories fake nahi banani.

Later:

- Case studies.
- Testimonials.
- Logos.

### `/compare/intercom`

Launch se pehle avoid. Comparison page powerful ho sakta hai but risky bhi:

- Claims accurate honi chahiye.
- Competitor data updated honi chahiye.
- Product gaps expose ho sakte hain.

Later jab:

- Product stable ho.
- Pricing/positioning locked ho.
- Real differentiation clear ho.

### `/integrations`

Current product mein actual channels/actions hain, but integration marketplace nahi. Is liye abhi "integrations" page premature hai.

Later:

- Stripe action template.
- Shopify template.
- Calendly template.
- WhatsApp.
- Email.
- Vapi.

### `/blog`

Not needed before launch unless SEO strategy active hai.

### `/changelog`

Useful later, but launch ke liye not required.

---

## Header Navigation Recommendation

Current header ko simplify karo.

### Desktop nav

- Product
- Pricing
- Docs
- Security

Right side:

- Sign in
- Start free

### Product dropdown

Keep 6 product links:

- Widget
- Unified Inbox
- Knowledge Base
- AI Actions
- Channels
- Analytics

Each link should go to home page anchor for now:

- `/#widget`
- `/#inbox`
- `/#knowledge`
- `/#actions`
- `/#channels`
- `/#analytics`

Later dedicated product pages bana sakte hain.

### Avoid

- Company dropdown unless company pages exist.
- Fake "Careers", "Customers", "Partners".
- Placeholder `#` links.

---

## Home Page Detailed Wireframe

## Section 1 - Hero

Layout:

- Top left aligned or centered headline.
- CTA row.
- Product screenshot below.

Suggested copy:

**Headline**

> AI customer support that stays grounded and keeps your team in control.

**Subtitle**

> Tinfiz helps support teams answer from approved knowledge, manage conversations across chat, email, WhatsApp, and voice, and measure quality through SLA, CSAT, and action analytics.

**CTA**

- Start free
- View docs

**Media**

- `hero-dashboard.png`

## Section 2 - Workflow

Title:

> From website visitor to resolved conversation.

Steps:

1. Install the widget.
2. Add company knowledge.
3. Let AI answer safely.
4. Hand off to humans when needed.
5. Improve with analytics.

Media:

- Small workflow diagram or 5 step cards.

## Section 3 - Unified Inbox

Title:

> One inbox for AI, agents, and every support channel.

Bullets:

- Saved views.
- Assignments.
- SLA timers.
- Notes and timeline.
- Agent Copilot.
- Action approvals.

Media:

- `unified-inbox.png`

## Section 4 - Grounded AI

Title:

> Answers from your knowledge, not guesses.

Bullets:

- Source health.
- Re-indexing.
- AI Improvements.
- No verified answer handling.
- Channel-aware tone.

Media:

- `knowledge-base-health.png`

## Section 5 - AI Actions

Title:

> Let AI check real data with safe API actions.

Bullets:

- Action templates.
- Test panel.
- Execution preview.
- Logs and latency.
- Confirmation/approval for write actions.
- Secrets and domain allowlist.

Media:

- `ai-actions-logs.png`

## Section 6 - Widget

Title:

> A customer widget that fits your brand.

Bullets:

- Light/dark themes.
- Bottom-left/bottom-right placement.
- Help content.
- Chat history.
- Voice entry.
- CSAT after resolution.

Media:

- `widget-preview.png`
- Optional mobile widget screenshot.

## Section 7 - Analytics

Title:

> Measure what support actually feels like.

Bullets:

- CSAT trend.
- SLA pressure.
- Conversation demand.
- Channel quality.
- Action quality.
- Launch readiness checks.

Media:

- `analytics-csat.png`

## Section 8 - Pricing Preview

Show:

- Free.
- Starter.
- Pro.
- Scale.

CTA:

- `Compare plans`

## Section 9 - Final CTA

Title:

> Launch AI support with real visibility.

CTA:

- `Start free`
- `Book demo`

---

## Pricing Page Wireframe

## Section 1 - Hero

Title:

> Simple pricing for AI support teams.

Subtitle:

> Start with the widget and AI answers, then upgrade when you need channels, actions, voice, Copilot, and analytics.

## Section 2 - Plan Cards

Cards:

- Free
- Starter
- Pro
- Scale

Highlight Pro as recommended.

## Section 3 - Feature Comparison

Groups:

- Core support
- AI and Knowledge Base
- Channels
- Team operations
- Actions and automation
- Analytics
- Limits

## Section 4 - Add-ons

Explain:

- Add-ons are custom quantities.
- Minimum units protect billing from tiny transactions.
- Add-ons apply to active billing period.

## Section 5 - FAQ

Questions:

- Can I start free?
- What happens when I hit limits?
- Are email and WhatsApp included in Starter?
- How do voice minutes work?
- Can I buy extra conversations?
- Do write actions require approval?
- Can I cancel anytime?

---

## Security Page Wireframe

## Section 1 - Hero

Title:

> Built for controlled AI support.

Subtitle:

> Tinfiz is designed around workspace isolation, grounded answers, safe actions, and human control.

## Section 2 - Data Scope

Explain:

- Conversations.
- Contacts.
- KB sources.
- Action logs.
- Billing usage.

## Section 3 - AI Safety

Explain:

- Grounded answers.
- No verified answer handling.
- Human handoff.
- Agent-visible sources.
- AI Improvements.

## Section 4 - Actions Safety

Explain:

- Domain allowlist.
- Secrets rotation.
- Required parameters.
- Logs.
- Approval for write actions.

## Section 5 - Access Control

Explain:

- Organization members.
- Plan guards.
- Agent Copilot gated by Pro/Scale.
- Team assignments.

---

## Copywriting Rules

### Use English on public marketing pages

Public website content English mein rakho. Roman Urdu internally roadmap/docs discussion ke liye theek hai, but customer-facing marketing should be clean English.

### Copy style

Use:

- Short sentences.
- Product-specific language.
- Real feature names.
- Clear CTA.

Avoid:

- "Revolutionary AI".
- "10x your support overnight".
- "Magic".
- "Autonomous everything".
- Long paragraphs.

### Good words for Tinfiz

- Grounded.
- Controlled.
- Unified.
- Realtime.
- Human handoff.
- Source health.
- SLA.
- CSAT.
- Action logs.
- Approval.
- Agent Copilot.

---

## Marketing Media Checklist

Before implementation, capture these assets:

### Required screenshots

- `hero-dashboard.png`
- `unified-inbox.png`
- `widget-preview.png`
- `knowledge-base-health.png`
- `ai-actions-logs.png`
- `analytics-csat.png`
- `customer-profile.png`

### Optional videos

- `widget-to-inbox.mp4` - visitor sends message, inbox receives realtime.
- `kb-answer.mp4` - AI answers with sources.
- `ai-action-order-status.mp4` - order action executes.
- `copilot-draft.mp4` - agent uses Copilot to draft/rewrite.

### Screenshot rules

- Use seeded demo data.
- Hide real emails/API keys.
- Use browser zoom 100%.
- Capture light and dark variants when possible.
- Keep product state realistic.

---

## SEO and Metadata

## Home

Title:

> Tinfiz - AI Customer Support Workspace

Description:

> Tinfiz combines a website widget, unified inbox, grounded AI answers, AI actions, email, WhatsApp, voice, CSAT, and analytics for modern support teams.

## Pricing

Title:

> Pricing - Tinfiz

Description:

> Compare Tinfiz plans for chat, AI answers, knowledge base, email, WhatsApp, voice, AI actions, Agent Copilot, analytics, and team support.

## Demo

Title:

> Book a Demo - Tinfiz

Description:

> See how Tinfiz helps teams launch AI-powered support with human handoff, channels, actions, and analytics.

## Security

Title:

> Security - Tinfiz

Description:

> Learn how Tinfiz handles workspace data, grounded AI answers, safe AI actions, access control, and support workflows.

---

## Implementation Order

### Step 1 - Replace Home

Do first:

- Remove dummy hero copy.
- Remove fake logo cloud or convert to "Built with" tech stack only if useful.
- Replace placeholders with product screenshots.
- Simplify animations.
- Add anchor sections.

### Step 2 - Build Pricing

Do second:

- Use same plan data as app billing.
- Make plan comparison clear.
- Add add-on explanation.
- Link to signup/checkout.

### Step 3 - Build Demo/Contact

Do third:

- Add simple form.
- Add email fallback.
- Add docs/pricing links.

### Step 4 - Build Security

Do fourth:

- Honest security content.
- AI/data/action safety explanation.
- Link from footer and header.

### Step 5 - Legal Pages

Do fifth:

- Update privacy.
- Add terms.

---

## Footer Structure

Footer should be simple.

Columns:

### Product

- Widget
- Inbox
- Knowledge Base
- AI Actions
- Analytics

### Resources

- Docs
- Pricing
- Security
- Contact

### Legal

- Privacy
- Terms

### Account

- Sign in
- Start free

Avoid:

- Empty social links.
- Fake offices.
- Unused pages.

---

## Final Recommendation

Marketing ko abhi "simple but serious" rakho.

Best first launch setup:

- Home page with real screenshots.
- Pricing page with exact limits/add-ons.
- Demo/contact page.
- Security page.
- Privacy and terms.
- Docs center linked everywhere.

Design should feel like:

> A calm, reliable AI support operations platform, not a flashy AI toy.

Is approach se aap jaldi launch kar sakte ho, product ki maturity show hoti hai, aur future mein customer feedback ke basis par marketing expand kar sakte ho.


