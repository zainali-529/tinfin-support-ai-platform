export type DocsBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; id: string; title: string }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'steps'; title?: string; items: string[] }
  | { type: 'callout'; title: string; body: string; tone?: 'info' | 'success' | 'warning' }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'screenshot'; title: string; description: string; suggestedPath: string }

export type DocsPage = {
  slug: string
  section: string
  title: string
  description: string
  updatedAt: string
  readingTime: string
  keywords: string[]
  blocks: DocsBlock[]
}

export type DocsSection = {
  title: string
  description: string
  pages: string[]
}

const p = (text: string): DocsBlock => ({ type: 'paragraph', text })
const h = (id: string, title: string): DocsBlock => ({ type: 'heading', id, title })
const list = (items: string[], title?: string): DocsBlock => ({ type: 'list', title, items })
const steps = (items: string[], title?: string): DocsBlock => ({ type: 'steps', title, items })
const callout = (title: string, body: string, tone: 'info' | 'success' | 'warning' = 'info'): DocsBlock => ({ type: 'callout', title, body, tone })
const screenshot = (title: string, description: string, suggestedPath: string): DocsBlock => ({ type: 'screenshot', title, description, suggestedPath })
const code = (language: string, value: string): DocsBlock => ({ type: 'code', language, code: value })
const table = (headers: string[], rows: string[][]): DocsBlock => ({ type: 'table', headers, rows })

const updatedAt = 'May 4, 2026'

export const DOCS_DEFAULT_SLUG = 'getting-started/overview'

export const docsSections: DocsSection[] = [
  {
    title: 'Get Started',
    description: 'The shortest path from empty workspace to live support operations.',
    pages: ['getting-started/overview', 'getting-started/workspace-setup', 'getting-started/launch-checklist'],
  },
  {
    title: 'Widget',
    description: 'Install, customize, test, and publish the customer-facing chat widget.',
    pages: ['widget/install', 'widget/no-code-installation', 'widget/customization', 'widget/testing'],
  },
  {
    title: 'Inbox Operations',
    description: 'Run daily support with ownership, queues, SLA controls, and collaboration.',
    pages: ['inbox/unified-inbox', 'inbox/assignments', 'inbox/sla-backlog'],
  },
  {
    title: 'AI Support',
    description: 'Grounded AI responses, knowledge sources, safe actions, and human handoff.',
    pages: ['ai/knowledge-base', 'ai/response-quality', 'ai/actions-v1'],
  },
  {
    title: 'Channels',
    description: 'Connect chat, email, WhatsApp, and voice into one operating layer.',
    pages: ['channels/chat-widget', 'channels/email', 'channels/whatsapp', 'channels/voice'],
  },
  {
    title: 'Admin',
    description: 'Team access, billing, usage, analytics, reporting, and account operations.',
    pages: ['admin/team-permissions', 'admin/billing-usage-addons', 'admin/analytics-reporting'],
  },
  {
    title: 'Developers',
    description: 'Implementation references for widget APIs, secure actions, and launch safety.',
    pages: ['developers/widget-api', 'developers/security-production'],
  },
  {
    title: 'Troubleshooting',
    description: 'Fast fixes for the most common launch and support issues.',
    pages: ['troubleshooting/common-issues'],
  },
]

export const docsPages: DocsPage[] = [
  {
    slug: 'getting-started/overview',
    section: 'Get Started',
    title: 'Platform overview',
    description: 'Understand how Tinfin AI combines AI support, team inboxes, channels, voice, and reporting in one customer support workspace.',
    updatedAt,
    readingTime: '5 min read',
    keywords: ['overview', 'platform', 'workspace', 'launch'],
    blocks: [
      p('Tinfin AI is a customer support platform for teams that want AI assistance, human handoff, multiple channels, and operational visibility in one place. The core workflow is simple: install the widget, connect knowledge, invite the team, monitor the inbox, and improve outcomes through analytics.'),
      screenshot('Dashboard overview screenshot', 'Capture the main dashboard after an organization has conversations, SLA status, usage, and recent activity visible.', '/docs-assets/screenshots/dashboard-overview.png'),
      h('core-areas', 'Core areas'),
      list([
        'Widget: the customer-facing chat and help surface installed on your website.',
        'Unified inbox: the workspace where agents handle chat, email, WhatsApp, and handoff conversations.',
        'Knowledge base: the source library AI uses to answer grounded questions.',
        'AI actions: safe API based actions that let AI read or perform approved tasks.',
        'Voice assistant: AI powered call handling with call logs and transcripts.',
        'Analytics: SLA, volume, team, action, and channel performance reporting.',
      ]),
      h('recommended-flow', 'Recommended setup flow'),
      steps([
        'Create or select the organization that will own the workspace.',
        'Install the widget on a staging website first.',
        'Add the most important knowledge base sources before enabling AI for customers.',
        'Invite support team members and assign roles.',
        'Configure SLA expectations and ownership rules.',
        'Test AI replies, human takeover, voice, and all enabled channels.',
        'Review analytics and billing usage before public launch.',
      ]),
      callout('Launch principle', 'Keep marketing pages clean and credible, but prioritize product reliability, support workflows, docs, billing clarity, and onboarding quality before launch.', 'success'),
    ],
  },
  {
    slug: 'getting-started/workspace-setup',
    section: 'Get Started',
    title: 'Workspace setup',
    description: 'Create the organization, confirm billing status, invite the team, and prepare the workspace for production traffic.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['workspace', 'organization', 'team', 'setup'],
    blocks: [
      p('A workspace belongs to an organization. The organization controls billing, plan limits, team membership, widget configuration, channels, and knowledge sources.'),
      h('create-organization', 'Create or select an organization'),
      steps([
        'Open the organization switcher from the sidebar.',
        'Create a new organization if this is a new customer or brand.',
        'Choose the starting plan based on expected conversation volume and voice minutes.',
        'After creating the organization, verify the active organization badge in the sidebar.',
      ]),
      screenshot('Organization switcher screenshot', 'Capture the organization switcher with at least two organizations and one active organization selected.', '/docs-assets/screenshots/organization-switcher.png'),
      h('team-members', 'Invite team members'),
      p('Invite agents only after the workspace settings are ready. This avoids confusing team members with incomplete channels, missing billing limits, or draft widget branding.'),
      list([
        'Admins can manage billing, team, channels, widget settings, and knowledge sources.',
        'Agents should focus on inbox conversations, assignments, customer contact context, and handoff workflows.',
        'Use fewer admins in production to reduce accidental configuration changes.',
      ]),
      h('production-readiness', 'Production readiness checks'),
      list([
        'The current plan has enough conversations, voice minutes, knowledge capacity, and team seats.',
        'Widget branding, colors, launcher position, and help content have been reviewed.',
        'Email and WhatsApp are disabled on plans where they are not included.',
        'AI actions are in preview or enabled according to plan and safety requirements.',
      ]),
    ],
  },
  {
    slug: 'getting-started/launch-checklist',
    section: 'Get Started',
    title: 'Launch checklist',
    description: 'A practical checklist for launch QA, rollback readiness, support routing, and customer-facing verification.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['launch', 'qa', 'checklist', 'production'],
    blocks: [
      p('Use this checklist before sending real customers to the widget. The goal is not to make the product perfect. The goal is to remove avoidable launch surprises.'),
      h('customer-experience', 'Customer experience'),
      list([
        'Widget opens and closes smoothly on desktop and mobile.',
        'Light and dark widget themes look correct on the customer website.',
        'A first visitor can start a new conversation without stale local state from older testing.',
        'AI answers only from configured knowledge or allowed action context.',
        'Human handoff is clear and does not leave the customer stuck.',
      ]),
      h('team-operations', 'Team operations'),
      list([
        'New conversations appear in the inbox in realtime.',
        'Assignment state is visible in the conversation list and conversation detail view.',
        'SLA timers, backlog state, and breached conversations are understandable.',
        'Agents can resolve, reopen, and filter conversations without UI lag.',
      ]),
      h('billing-and-limits', 'Billing and limits'),
      list([
        'Plan prices show the correct discounted amount when an automatic discount is configured.',
        'Trial copy explains what is charged today and what starts after trial.',
        'Add-on checkout respects minimum and maximum units.',
        'Usage pages include active add-ons and current plan limits.',
      ]),
      h('rollback-plan', 'Rollback plan'),
      p('Before launch, write down the fastest way to disable a risky feature without redeploying everything. For example, keep AI actions in preview for Free and Starter, disable a channel from settings, or temporarily remove the widget script from the customer website.'),
      callout('Minimum viable rollback', 'At minimum, know how to disable widget AI responses, turn off a channel, pause paid checkout, and revert the latest deployment.', 'warning'),
    ],
  },
  {
    slug: 'widget/install',
    section: 'Widget',
    title: 'Install the widget',
    description: 'Add the Tinfin AI widget to a website using the embed script and organization ID.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['widget', 'install', 'script', 'embed'],
    blocks: [
      p('The widget is installed with a small script tag. The script loads the hosted widget bundle and connects it to the selected organization using the organization ID.'),
      screenshot('Widget embed settings screenshot', 'Capture the Widget or Embedding page where the organization ID and install snippet are visible.', '/docs-assets/screenshots/widget-embed-settings.png'),
      h('basic-snippet', 'Basic install snippet'),
      code('html', `<script
  src="https://YOUR_APP_DOMAIN/widget.js"
  data-organization-id="YOUR_ORGANIZATION_ID"
  async
></script>`),
      h('where-to-place', 'Where to place the script'),
      list([
        'For a static website, place the script before the closing body tag.',
        'For a React, Next.js, or SPA website, load the script once in the root layout or app shell.',
        'For a CMS or site builder, place it in the global custom code area if available.',
      ]),
      h('verification', 'Verify installation'),
      steps([
        'Open the website in a private browser window.',
        'Confirm the launcher appears in the configured bottom corner.',
        'Send a test message from the widget.',
        'Open the inbox and confirm the conversation appears quickly.',
        'Reply from the inbox and confirm the visitor sees the response without refreshing.',
      ]),
      callout('Use staging first', 'Install the widget on staging before production so theme, position, AI, and handoff behavior can be tested safely.', 'info'),
    ],
  },
  {
    slug: 'widget/no-code-installation',
    section: 'Widget',
    title: 'No-code installation options',
    description: 'Help non-technical customers install the widget through common website platforms and tag managers.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['no-code', 'wordpress', 'shopify', 'webflow', 'tag manager'],
    blocks: [
      p('Some customers cannot edit source code. For them, the safest installation path is usually a site builder custom code area or a tag manager. Fully automatic installation is only possible when the customer grants platform access through an integration or OAuth flow.'),
      h('recommended-options', 'Recommended no-code options'),
      table(['Platform', 'Best install method', 'Notes'], [
        ['WordPress', 'Header/footer plugin or theme custom code', 'Use a trusted plugin and place the script globally.'],
        ['Shopify', 'Theme custom liquid or app embed', 'Use the theme editor if the customer can access it.'],
        ['Webflow', 'Site settings custom code', 'Publish the site after adding the script.'],
        ['Framer', 'Custom code section', 'Add globally so every page has the widget.'],
        ['Google Tag Manager', 'Custom HTML tag', 'Trigger on all pages after consent rules are handled.'],
      ]),
      h('automatic-installation', 'Can Tinfin AI install it automatically?'),
      p('Yes, but only with permission from the customer platform. A future no-code installer can ask for the website URL, detect the platform, guide the customer to the right method, or connect through OAuth where the platform supports it.'),
      list([
        'Safe now: show platform-specific instructions and copyable script.',
        'Next level: platform detector with WordPress, Shopify, Webflow, Framer, Wix, and GTM guides.',
        'Advanced: OAuth based installer for supported platforms so the user approves access and the app injects the widget.',
      ]),
      screenshot('No-code installation wizard screenshot', 'Capture the widget installation wizard platform selection screen once available.', '/docs-assets/screenshots/widget-no-code-wizard.png'),
    ],
  },
  {
    slug: 'widget/customization',
    section: 'Widget',
    title: 'Widget customization',
    description: 'Customize widget branding, light and dark themes, launcher position, help content, and experience settings.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['customization', 'theme', 'dark mode', 'launcher', 'faq'],
    blocks: [
      p('Widget customization controls how the customer-facing experience feels on the website. Keep the design close to the customer brand, but avoid making the widget visually louder than the website itself.'),
      screenshot('Widget customization page screenshot', 'Capture the full customization page showing theme controls and live preview side by side.', '/docs-assets/screenshots/widget-customization.png'),
      h('theme-controls', 'Theme controls'),
      list([
        'Configure light mode colors for the default customer experience.',
        'Configure dark mode colors for websites that prefer a darker widget.',
        'Adjust launcher placement. Supported production positions are bottom right and bottom left.',
        'Use a compact, professional header and avoid oversized text in suggested questions.',
      ]),
      h('help-content', 'Help content and FAQs'),
      p('Help content should answer common customer questions before they start a conversation. Keep each answer direct, product-specific, and easy to scan.'),
      list([
        'Add short FAQ entries for pricing, support hours, account questions, order tracking, and refunds if relevant.',
        'Use screenshots only when the answer depends on a visual flow.',
        'Review help content after major product changes.',
      ]),
      h('quality-checks', 'Customization quality checks'),
      steps([
        'Preview the widget on light and dark backgrounds.',
        'Test bottom right and bottom left launcher placement.',
        'Open chat, history, help, and calls tabs from the bottom navigation.',
        'Expand and collapse the widget to verify smooth animation.',
        'Confirm the mobile layout does not hide the input composer or primary actions.',
      ]),
    ],
  },
  {
    slug: 'widget/testing',
    section: 'Widget',
    title: 'Test the widget',
    description: 'Run end-to-end widget tests for realtime messages, new conversations, AI replies, handoff, and mobile UX.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['testing', 'widget qa', 'realtime', 'handoff'],
    blocks: [
      p('Widget testing should cover the first visitor experience, returning visitor experience, AI flow, and human support flow. Test in a private browser to avoid local storage from previous sessions.'),
      h('conversation-tests', 'Conversation tests'),
      steps([
        'Open the widget as a new visitor and send a first message.',
        'Confirm the message appears in the inbox without a visible delay.',
        'Reply from the inbox and confirm the visitor receives it in realtime.',
        'Refresh the browser and confirm the conversation history is still correct.',
        'Delete the contact from the dashboard and confirm the widget starts clean when expected.',
      ]),
      h('ai-tests', 'AI tests'),
      list([
        'Ask a question that exists in the knowledge base and confirm the answer is grounded.',
        'Ask a question that does not exist in knowledge and confirm the AI does not invent details.',
        'Use Roman Urdu or mixed language if the customer base uses it, and confirm the answer follows the same language.',
        'Trigger human handoff and confirm the input state changes correctly.',
      ]),
      h('device-tests', 'Device tests'),
      list([
        'Desktop Chrome, Edge, and Safari if available.',
        'Mobile viewport below 390px width.',
        'Slow network simulation to confirm loading states are clear.',
      ]),
      screenshot('Widget live test screenshot', 'Capture the widget conversation after a successful AI response and one human reply.', '/docs-assets/screenshots/widget-live-test.png'),
    ],
  },
  {
    slug: 'inbox/unified-inbox',
    section: 'Inbox Operations',
    title: 'Unified inbox',
    description: 'Manage customer conversations from chat, email, WhatsApp, and AI handoff in one operational view.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['inbox', 'conversation', 'realtime', 'channels'],
    blocks: [
      p('The unified inbox is the daily command center for agents. It should help the team see what needs attention, who owns it, what channel it came from, and whether SLA risk is increasing.'),
      screenshot('Unified inbox screenshot', 'Capture the inbox with conversation list, selected conversation, assignment state, SLA, and channel filters visible.', '/docs-assets/screenshots/unified-inbox.png'),
      h('conversation-list', 'Conversation list'),
      list([
        'Conversation cards show status, channel, customer identity, assignment, SLA, backlog, and recent activity.',
        'Filters help the team switch between open, queued, resolved, assigned, unassigned, and channel specific views.',
        'Realtime updates keep the list fresh when a customer or agent sends a message.',
      ]),
      h('conversation-detail', 'Conversation detail'),
      list([
        'The detail panel shows customer context, ownership, channel state, AI or human mode, and the full message timeline.',
        'Agents can reply, take over from AI, release back to AI, resolve, reopen, and assign ownership.',
        'Replying indicators and collision cues reduce duplicate agent replies.',
      ]),
      callout('Operational goal', 'The inbox should make the next best action obvious. If an agent has to guess who owns a conversation, the workflow needs more clarity.', 'success'),
    ],
  },
  {
    slug: 'inbox/assignments',
    section: 'Inbox Operations',
    title: 'Assignments and ownership',
    description: 'Use assignment state to make responsibility clear across support agents and admins.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['assignments', 'owner', 'agent', 'team'],
    blocks: [
      p('Assignments define who is responsible for a conversation. They are not only a filter. They are an accountability layer for support quality.'),
      h('ownership-rules', 'Ownership rules'),
      list([
        'Unassigned means no agent currently owns the conversation.',
        'Assigned means one agent is responsible for the next reply or resolution.',
        'AI controlled means AI can respond unless a human takes over.',
        'Human takeover means AI should not reply until the conversation is released back to AI.',
      ]),
      h('agent-workflow', 'Agent workflow'),
      steps([
        'Open the queue or assigned view.',
        'Take ownership or accept an assigned conversation.',
        'Review the customer context and previous AI response if available.',
        'Reply, resolve, or escalate based on the conversation state.',
        'Release back to AI only when it is safe for automation to continue.',
      ]),
      screenshot('Assignment dropdown screenshot', 'Capture a conversation detail view with the assignment dropdown open and team members visible.', '/docs-assets/screenshots/inbox-assignment-dropdown.png'),
    ],
  },
  {
    slug: 'inbox/sla-backlog',
    section: 'Inbox Operations',
    title: 'SLA and backlog',
    description: 'Understand SLA timers, breached conversations, backlog age, and how teams should act on them.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['sla', 'backlog', 'breached', 'queue'],
    blocks: [
      p('SLA is the service level agreement target for response or resolution. Backlog shows how long a conversation has been waiting in an operational state. Together they help the team decide what needs attention first.'),
      h('how-sla-works', 'How SLA works'),
      list([
        'SLA met means the target was satisfied for the current policy or lifecycle event.',
        'SLA at risk means the target is close to being missed.',
        'SLA breached means the target was missed and the conversation needs review or escalation.',
        'Resolved conversations should stop accruing active backlog time unless reopened.',
      ]),
      h('how-backlog-works', 'How backlog works'),
      p('Backlog is not the same thing as SLA. SLA is a promise target. Backlog is operational age. A conversation can have SLA met but still show backlog age if it remains open, queued, or waiting for an agent action.'),
      table(['State', 'What it means', 'Recommended action'], [
        ['Queued', 'Waiting for assignment or first human attention', 'Assign or route it quickly.'],
        ['Open', 'Active conversation still needs handling', 'Reply, resolve, or hand off intentionally.'],
        ['SLA breached', 'The configured target was missed', 'Prioritize and review root cause.'],
        ['Resolved', 'Conversation is closed for now', 'Backlog should stop unless reopened.'],
      ]),
      screenshot('SLA and backlog screenshot', 'Capture conversation list cards showing SLA met, SLA breached, and backlog indicators.', '/docs-assets/screenshots/inbox-sla-backlog.png'),
    ],
  },
  {
    slug: 'ai/knowledge-base',
    section: 'AI Support',
    title: 'Knowledge base setup',
    description: 'Add sources that keep AI answers grounded, current, and useful for customers.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['knowledge base', 'sources', 'grounding', 'ai'],
    blocks: [
      p('The knowledge base is the safest way to teach AI what the company knows. AI should answer from approved sources and avoid inventing product, pricing, policy, or company details.'),
      screenshot('Knowledge base page screenshot', 'Capture the knowledge base page with at least one knowledge base and multiple source types visible.', '/docs-assets/screenshots/knowledge-base.png'),
      h('source-types', 'Recommended source types'),
      list([
        'Text notes for concise company introductions, policies, FAQs, and product descriptions.',
        'Website pages for public help content and product pages.',
        'Documents for structured policies or internal support guides.',
        'Frequently updated sources for pricing, availability, and operational rules.',
      ]),
      h('writing-good-sources', 'Writing good sources'),
      list([
        'Use direct language. Write the answer you want customers to receive.',
        'Keep one topic per source when possible.',
        'Include company name, product name, support scope, and important limitations.',
        'Remove outdated sources instead of hoping AI ignores them.',
      ]),
      callout('Grounding rule', 'If the source does not contain the answer, AI should either ask a focused clarification or route to a human. It should not produce generic web knowledge as if it came from the company.', 'warning'),
    ],
  },
  {
    slug: 'ai/response-quality',
    section: 'AI Support',
    title: 'AI response quality',
    description: 'Improve answer style, language matching, refusal behavior, and human escalation quality.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['ai quality', 'tone', 'language', 'grounded'],
    blocks: [
      p('AI response quality depends on source quality, prompt constraints, retrieval relevance, and safe escalation. The assistant should sound like it represents the organization, not like a generic chatbot.'),
      h('quality-principles', 'Quality principles'),
      list([
        'Answer as the current organization assistant when the customer asks about this company, product, service, or support team.',
        'Match the customer language when it is clear, including mixed English and Roman Urdu if that is how the customer speaks.',
        'Be concise first, then offer helpful next steps.',
        'Ask for clarification only when the question is truly ambiguous or requires private customer data.',
        'Escalate to a human when confidence is low, knowledge is missing, or the user requests a person.',
      ]),
      h('bad-answer-patterns', 'Bad answer patterns to avoid'),
      list([
        'Asking which company when the question clearly means the current widget organization.',
        'Answering unrelated public knowledge questions from the model instead of the knowledge base.',
        'Using long disclaimers that make simple support answers feel robotic.',
        'Taking write actions without explicit confirmation or approval.',
      ]),
      screenshot('AI answer review screenshot', 'Capture an inbox conversation where AI answered from a knowledge source and the agent can review the reply.', '/docs-assets/screenshots/ai-answer-review.png'),
    ],
  },
  {
    slug: 'ai/actions-v1',
    section: 'AI Support',
    title: 'AI actions v1',
    description: 'Use API endpoint based actions safely with secrets, allowlists, preview mode, and approval expectations.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['ai actions', 'api', 'secrets', 'approval'],
    blocks: [
      p('AI actions v1 lets admins define API endpoint based tools that AI can use during support conversations. Keep actions simple, observable, and safe. Advanced multi-step connectors can be added later after v1 is reliable.'),
      h('safe-action-design', 'Safe action design'),
      list([
        'Use read-only actions for order lookup, subscription status, appointment details, and account metadata.',
        'Require confirmation or approval for write actions such as canceling, refunding, updating, or booking.',
        'Store secrets securely and never expose them to the widget.',
        'Use outbound domain allowlists to prevent unexpected network calls.',
        'Log success, failure, retry, and latency so production issues are visible.',
      ]),
      h('testing-actions', 'Testing actions'),
      steps([
        'Create the action with a safe test endpoint first.',
        'Run the built-in test panel or mock endpoint.',
        'Ask the widget a customer question that should trigger the action.',
        'Confirm the inbox timeline shows the action result clearly.',
        'Review logs for latency and errors before enabling production usage.',
      ]),
      screenshot('AI actions page screenshot', 'Capture the actions builder with one read action and one preview/write action visible.', '/docs-assets/screenshots/ai-actions-v1.png'),
      callout('Keep v1 stable', 'Do not add complex procedure builders until basic action creation, testing, approval, and monitoring are consistently reliable.', 'info'),
    ],
  },
  {
    slug: 'channels/chat-widget',
    section: 'Channels',
    title: 'Chat widget channel',
    description: 'Use the web widget as the primary customer chat, AI support, help, and handoff channel.',
    updatedAt,
    readingTime: '5 min read',
    keywords: ['chat', 'widget', 'channel'],
    blocks: [
      p('The chat widget channel is the easiest way for website visitors to contact the team. It supports AI first response, human takeover, history, help content, and conversation routing.'),
      h('recommended-setup', 'Recommended setup'),
      list([
        'Install the widget on staging first.',
        'Keep the launcher visible but not visually aggressive.',
        'Write concise suggested prompts based on actual customer questions.',
        'Make Talk to Human available but not mixed into AI suggestion chips.',
      ]),
      h('daily-operations', 'Daily operations'),
      list([
        'Monitor new chat conversations from the inbox.',
        'Use assignment and SLA filters to keep ownership clear.',
        'Review AI answers where confidence or source coverage is weak.',
      ]),
    ],
  },
  {
    slug: 'channels/email',
    section: 'Channels',
    title: 'Email channel',
    description: 'Connect support email so threads can be handled alongside chat and other channels.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['email', 'smtp', 'imap', 'thread'],
    blocks: [
      p('The email channel brings customer email threads into the support workspace. It is best used for slower, higher context conversations that need a record of back and forth communication.'),
      h('plan-availability', 'Plan availability'),
      p('Email should not be included on Starter if your launch packaging keeps advanced channels for higher plans. When disabled, show clear preview or upgrade messaging instead of a generic blocked state.'),
      h('setup-checks', 'Setup checks'),
      list([
        'Confirm sending identity and inbox address.',
        'Send a test email into the support inbox.',
        'Reply from the dashboard and confirm the customer receives it.',
        'Verify thread grouping and contact matching.',
      ]),
      screenshot('Email channel settings screenshot', 'Capture the email settings page with channel status and test connection state.', '/docs-assets/screenshots/email-channel-settings.png'),
    ],
  },
  {
    slug: 'channels/whatsapp',
    section: 'Channels',
    title: 'WhatsApp channel',
    description: 'Prepare WhatsApp support with account setup, contact matching, and conversation handling.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['whatsapp', 'meta', 'channel'],
    blocks: [
      p('WhatsApp is a high-intent support channel. Keep setup strict, because customer identity, opt-in expectations, and template rules matter more than in web chat.'),
      h('setup-flow', 'Setup flow'),
      steps([
        'Open Channels and select WhatsApp.',
        'Connect the WhatsApp account or configure required credentials.',
        'Send a test inbound message from a real phone number.',
        'Confirm the contact and conversation are matched correctly.',
        'Reply from the dashboard and verify delivery.',
      ]),
      h('operational-notes', 'Operational notes'),
      list([
        'Keep WhatsApp as a paid plan channel if messaging cost and operational load are higher.',
        'Show contact phone number and channel badge clearly in the inbox.',
        'Avoid duplicate contacts when the same customer also uses chat or email.',
      ]),
      screenshot('WhatsApp channel screenshot', 'Capture WhatsApp settings and a WhatsApp conversation in the inbox.', '/docs-assets/screenshots/whatsapp-channel.png'),
    ],
  },
  {
    slug: 'channels/voice',
    section: 'Channels',
    title: 'Voice assistant and calls',
    description: 'Use AI voice calls with configured minutes, call logs, transcripts, and support escalation.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['voice', 'calls', 'vapi', 'transcript'],
    blocks: [
      p('Voice support uses your configured provider keys and plan based minute limits. It should be treated like a premium channel because calls have direct provider cost and a higher customer expectation.'),
      h('voice-limits', 'Voice limits'),
      table(['Plan', 'Included minutes', 'Notes'], [
        ['Pro', '60 minutes', 'Suitable for early customer calls and AI voice testing.'],
        ['Scale', '250 minutes', 'Better for teams with regular voice demand.'],
        ['Add-on', 'Custom minutes', 'Customers can buy extra minutes when they run out.'],
      ]),
      h('call-experience', 'Call experience'),
      list([
        'The call page should show status, elapsed time, animated voice activity, and transcript clearly.',
        'Transcripts should be saved for review and customer context.',
        'Failed or missed calls should be visible in the call logs.',
      ]),
      screenshot('Voice call UI screenshot', 'Capture the professional call UI with voice bars, call status, and transcript area visible.', '/docs-assets/screenshots/voice-call-ui.png'),
    ],
  },
  {
    slug: 'admin/team-permissions',
    section: 'Admin',
    title: 'Team and permissions',
    description: 'Invite members, manage roles, and keep sensitive workspace controls limited to admins.',
    updatedAt,
    readingTime: '5 min read',
    keywords: ['team', 'permissions', 'roles', 'admin'],
    blocks: [
      p('Team access should be simple at launch. Use admins for configuration and agents for customer support workflows. Add granular permissions only where the UI already supports them clearly.'),
      h('roles', 'Roles'),
      table(['Role', 'Best use', 'Access level'], [
        ['Admin', 'Founder, support lead, workspace owner', 'Billing, channels, widget, knowledge, team, analytics.'],
        ['Agent', 'Support teammate', 'Inbox, assigned conversations, contacts, and allowed operational views.'],
      ]),
      h('invite-flow', 'Invite flow'),
      steps([
        'Open Team settings.',
        'Invite the teammate by email.',
        'Choose the correct role.',
        'Ask the teammate to accept the invite and verify organization access.',
      ]),
      screenshot('Team settings screenshot', 'Capture team members, roles, and invite state in the team settings page.', '/docs-assets/screenshots/team-settings.png'),
    ],
  },
  {
    slug: 'admin/billing-usage-addons',
    section: 'Admin',
    title: 'Billing, usage, and add-ons',
    description: 'Understand plan limits, automatic discounts, trials, usage tracking, and custom add-on checkout.',
    updatedAt,
    readingTime: '9 min read',
    keywords: ['billing', 'plans', 'addons', 'usage', 'discounts'],
    blocks: [
      p('Billing should make cost predictable before checkout. Customers should see plan price, automatic discount, trial state, add-on quantity, and due today amount before they pay.'),
      h('plans', 'Launch plans'),
      table(['Plan', 'Price', 'Good for', 'Voice minutes'], [
        ['Free', '$0', 'Testing the workspace and previewing core workflows.', 'Limited or disabled.'],
        ['Starter', 'Entry paid plan', 'Small chat-first teams without advanced channels.', 'Based on configured package.'],
        ['Pro', '$29/month', 'AI support with stronger operations and 60 voice minutes.', '60 minutes.'],
        ['Scale', '$79/month', 'Higher volume teams with broader limits and 250 voice minutes.', '250 minutes.'],
      ]),
      h('add-ons', 'Add-ons'),
      list([
        'Extra conversations can be purchased with a minimum custom unit amount.',
        'Extra voice minutes can be purchased when included minutes are used.',
        'Extra team seats, knowledge bases, and knowledge chunks extend workspace capacity.',
        'The checkout amount is calculated from the requested units instead of forcing fixed packs only.',
      ]),
      h('discounts-and-trials', 'Discounts and trials'),
      p('Automatic discounts should be configured through environment variables or billing settings so customers do not need to enter promo codes manually. Checkout should pass the coupon or promotion code directly to Stripe.'),
      screenshot('Billing page screenshot', 'Capture plan cards, due today pricing, trial message, and add-on custom quantity controls.', '/docs-assets/screenshots/billing-usage-addons.png'),
    ],
  },
  {
    slug: 'admin/analytics-reporting',
    section: 'Admin',
    title: 'Analytics and reporting',
    description: 'Use premium analytics to understand channel volume, SLA health, team load, AI actions, and support trends.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['analytics', 'reporting', 'graphs', 'sla'],
    blocks: [
      p('Analytics should answer operational questions, not just show decorative cards. Focus on trend lines, channel mix, SLA outcomes, team workload, resolution speed, and AI action reliability.'),
      h('core-reports', 'Core reports'),
      list([
        'Conversation volume over time by channel.',
        'SLA met, at-risk, and breached trends.',
        'Assigned workload and resolution count by teammate.',
        'AI action success, failure, retry, and latency.',
        'Voice minutes used and call outcome trend.',
      ]),
      h('demo-seed-data', 'Demo seed data'),
      p('Use demo seed data only for UI testing and screenshots. Clean it before production demos if it could confuse real reporting.'),
      code('powershell', 'pnpm --filter @workspace/api seed:analytics-demo -- --org=YOUR_ORG_ID --seed=analytics-look-test\npnpm --filter @workspace/api cleanup:analytics-demo -- --org=YOUR_ORG_ID --seed=analytics-look-test'),
      screenshot('Analytics dashboard screenshot', 'Capture the analytics page with line, bar, area, and channel mix charts populated.', '/docs-assets/screenshots/analytics-reporting.png'),
    ],
  },
  {
    slug: 'developers/widget-api',
    section: 'Developers',
    title: 'Widget JavaScript API',
    description: 'Reference for loading the widget, identifying visitors, and passing metadata from the host website.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['javascript', 'widget api', 'identify', 'metadata'],
    blocks: [
      p('The widget should work with only the script tag. Advanced websites can pass visitor identity and metadata so conversations connect to real customers instead of anonymous contacts.'),
      h('basic-install', 'Basic install'),
      code('html', `<script
  src="https://YOUR_APP_DOMAIN/widget.js"
  data-organization-id="YOUR_ORGANIZATION_ID"
  async
></script>`),
      h('visitor-identification', 'Visitor identification'),
      code('html', `<script>
  window.tinfinAI = window.tinfinAI || [];
  window.tinfinAI.push(['identify', {
    externalId: 'customer_123',
    name: 'Ava Brooks',
    email: 'ava@example.com',
    metadata: {
      plan: 'pro',
      accountStatus: 'active'
    }
  }]);
</script>`),
      h('metadata-guidelines', 'Metadata guidelines'),
      list([
        'Do not send secrets, passwords, tokens, payment card data, or sensitive medical data.',
        'Send stable customer IDs when available so contacts can merge correctly.',
        'Keep metadata small and useful for support context.',
      ]),
      callout('Future API keys', 'A public/private key system can later expose authenticated developer APIs for contacts, conversations, events, webhooks, and action callbacks. Keep widget public identifiers separate from server-side private keys.', 'info'),
    ],
  },
  {
    slug: 'developers/security-production',
    section: 'Developers',
    title: 'Security and production checklist',
    description: 'Secure secrets, API actions, provider keys, customer data, and deployment operations before launch.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['security', 'production', 'secrets', 'privacy'],
    blocks: [
      p('Security work should be boring in the best way: clear boundaries, least privilege, protected secrets, safe defaults, and visible operational logs.'),
      h('secrets', 'Secrets'),
      list([
        'Keep provider keys in server-side environment variables only.',
        'Never expose AI action secrets to the browser or widget.',
        'Use different keys for development and production.',
        'Rotate keys if they are pasted into chat, docs, screenshots, or client code by mistake.',
      ]),
      h('ai-actions', 'AI actions'),
      list([
        'Use outbound domain allowlists.',
        'Require explicit confirmation or approval for write actions.',
        'Store action results with enough detail for debugging but without leaking secrets.',
        'Set timeouts and handle failed requests gracefully.',
      ]),
      h('deployment', 'Deployment'),
      list([
        'Run typecheck before deploying.',
        'Apply database migrations from the project, not manual SQL editor snippets.',
        'Verify Stripe webhook events in production mode.',
        'Confirm Supabase RLS policies and service role usage are intentional.',
      ]),
      screenshot('Production settings screenshot', 'Capture environment checklist or deployment checklist screen if you add one later.', '/docs-assets/screenshots/security-production-checklist.png'),
    ],
  },
  {
    slug: 'troubleshooting/common-issues',
    section: 'Troubleshooting',
    title: 'Common issues',
    description: 'Resolve common setup issues with widget install, realtime inbox, billing, AI answers, and channel access.',
    updatedAt,
    readingTime: '9 min read',
    keywords: ['troubleshooting', 'fix', 'issue', 'debug'],
    blocks: [
      h('widget-not-showing', 'Widget is not showing'),
      list([
        'Confirm the script is loaded on the page where you are testing.',
        'Confirm the organization ID is correct.',
        'Check browser console errors for blocked scripts or CSP rules.',
        'Test in a private browser window to avoid stale local state.',
      ]),
      h('messages-delayed', 'Messages feel delayed'),
      list([
        'Confirm websocket or realtime connection is active.',
        'Check whether the UI waits for a full API refetch instead of applying an optimistic local update.',
        'Verify the conversation list and selected conversation subscribe to the same org and channel scope.',
      ]),
      h('ai-answer-not-grounded', 'AI answers are not grounded'),
      list([
        'Review the knowledge source that should answer the question.',
        'Ask a question that exactly matches the source topic to test retrieval.',
        'Remove broad prompt instructions that allow generic model knowledge for company specific answers.',
        'Escalate to human when the source does not contain enough information.',
      ]),
      h('discount-not-applied', 'Discount is not applied at checkout'),
      list([
        'Confirm the Stripe coupon or promotion code ID is configured in the server environment.',
        'Use coupon IDs with the checkout discounts parameter if you do not want users to type promo codes.',
        'Restart the API server after changing environment variables.',
        'Create a new checkout session after changing discount settings.',
      ]),
      h('migration-fails', 'Database migration fails'),
      list([
        'Do not delete old migration files that already exist in the Drizzle journal.',
        'Make sure migration trigger functions reference functions that exist in baseline SQL.',
        'Run migrations from the project command instead of manual SQL editor copy paste.',
      ]),
    ],
  },
]

export const docsPageMap = new Map(docsPages.map((page) => [page.slug, page]))

export function getDocsHref(slug: string): string {
  return slug === DOCS_DEFAULT_SLUG ? '/docs' : `/docs/${slug}`
}

export function getDocsPage(slugParts?: string[]): DocsPage | undefined {
  const slug = slugParts && slugParts.length > 0 ? slugParts.join('/') : DOCS_DEFAULT_SLUG
  return docsPageMap.get(slug)
}

export function getDocsPreviousNext(slug: string): { previous?: DocsPage; next?: DocsPage } {
  const index = docsPages.findIndex((page) => page.slug === slug)
  return {
    previous: index > 0 ? docsPages[index - 1] : undefined,
    next: index >= 0 && index < docsPages.length - 1 ? docsPages[index + 1] : undefined,
  }
}

function blockText(block: DocsBlock): string {
  if (block.type === 'paragraph') return block.text
  if (block.type === 'heading') return block.title
  if (block.type === 'list' || block.type === 'steps') return [block.title, ...block.items].filter(Boolean).join(' ')
  if (block.type === 'callout') return `${block.title} ${block.body}`
  if (block.type === 'code') return block.code
  if (block.type === 'table') return [...block.headers, ...block.rows.flat()].join(' ')
  if (block.type === 'screenshot') return `${block.title} ${block.description} ${block.suggestedPath}`
  return ''
}

export const docsSearchItems = docsPages.map((page) => ({
  slug: page.slug,
  href: getDocsHref(page.slug),
  title: page.title,
  section: page.section,
  description: page.description,
  value: [page.title, page.section, page.description, ...page.keywords, ...page.blocks.map(blockText)].join(' '),
}))

export const docsScreenshotPlaceholders = docsPages.flatMap((page) =>
  page.blocks
    .filter((block): block is Extract<DocsBlock, { type: 'screenshot' }> => block.type === 'screenshot')
    .map((block) => ({ page: page.title, slug: page.slug, ...block }))
)

