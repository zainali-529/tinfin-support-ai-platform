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

const updatedAt = 'May 5, 2026'

export const DOCS_DEFAULT_SLUG = 'getting-started/overview'

export const docsSections: DocsSection[] = [
  {
    title: 'Get Started',
    description: 'Setup path, workspace configuration, QA, and support workflows.',
    pages: ['getting-started/overview', 'getting-started/workspace-setup', 'getting-started/production-checklist'],
  },
  {
    title: 'Widget',
    description: 'Install, customize, test, and publish the customer-facing widget.',
    pages: ['widget/install', 'widget/no-code-installation', 'widget/customization', 'widget/testing'],
  },
  {
    title: 'Inbox Operations',
    description: 'Run support with saved views, ownership, SLA, notes, timeline, and notifications.',
    pages: ['inbox/unified-inbox', 'inbox/saved-views', 'inbox/assignments-sla', 'inbox/notes-timeline', 'inbox/notifications'],
  },
  {
    title: 'AI Support',
    description: 'Grounded AI, Knowledge Base health, AI Improvements, actions, and Agent Copilot.',
    pages: ['ai/knowledge-base', 'ai/ai-improvements', 'ai/channel-aware-behavior', 'ai/actions-v1', 'ai/agent-copilot'],
  },
  {
    title: 'Channels',
    description: 'Chat, email, WhatsApp, and voice support channels.',
    pages: ['channels/chat-widget', 'channels/email', 'channels/whatsapp', 'channels/voice'],
  },
  {
    title: 'Admin',
    description: 'Team, billing, customer profiles, CSAT, analytics, and reporting.',
    pages: ['admin/team-permissions', 'admin/billing-usage-addons', 'admin/customer-profiles', 'admin/csat-feedback', 'admin/analytics-reporting'],
  },
  {
    title: 'Developers',
    description: 'Widget API, production security, and deployment checks.',
    pages: ['developers/widget-api', 'developers/security-production'],
  },
  {
    title: 'Troubleshooting',
    description: 'Common setup and production issues.',
    pages: ['troubleshooting/common-issues'],
  },
]

export const docsPages: DocsPage[] = [
  {
    slug: 'getting-started/overview',
    section: 'Get Started',
    title: 'Platform overview',
    description: 'Understand how Tinfiz combines AI support, inbox operations, channels, actions, billing, and reporting in one workspace.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['overview', 'platform', 'workspace', 'production'],
    blocks: [
      p('Tinfiz is a customer support workspace for teams that want AI-assisted conversations without losing human control. A production-ready workspace usually includes the widget, knowledge base, inbox ownership, SLA rules, notifications, customer profiles, safe AI actions, CSAT, analytics, and billing limits.'),
      screenshot('Dashboard overview screenshot', 'Capture the dashboard after onboarding, recent conversations, activity, and metrics are populated.', '/docs-assets/screenshots/dashboard-overview.png'),
      h('core-areas', 'Core areas'),
      list([
        'Widget: customer-facing chat, help, history, voice entry, CSAT, and human handoff.',
        'Unified inbox: realtime chat, email, WhatsApp, voice-linked conversations, saved views, assignment, SLA, notes, timeline, and Agent Copilot.',
        'Knowledge Base: text, URL, and document sources with source health, re-indexing, duplicate warnings, and AI improvement suggestions.',
        'AI Actions v1: endpoint-based tools with templates, tests, preview, logs, secrets, domain allowlists, approvals, retries, and analytics.',
        'Customer profiles: timeline, notes, tags, custom fields, conversation history, calls, CSAT history, and actions used.',
        'Reporting: conversation demand, SLA pressure, CSAT, action quality, channel quality, and workspace readiness checks.',
      ]),
      h('product-focus', 'Product focus'),
      p('Product reliability matters more than decorative marketing. The dashboard, inbox, widget, knowledge base, billing guards, notifications, analytics, and docs should feel stable, understandable, and easy to operate.'),
      callout('Production readiness', 'Tinfiz is designed for real support workflows when production environment variables, migrations, Stripe, Supabase, email, WhatsApp, Vapi, and AI provider keys are configured correctly.', 'success'),
    ],
  },
  {
    slug: 'getting-started/workspace-setup',
    section: 'Get Started',
    title: 'Workspace setup',
    description: 'Create an organization, select a plan, configure basics, and prepare the workspace for customer traffic.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['workspace', 'organization', 'setup', 'team'],
    blocks: [
      p('A workspace belongs to an organization. The active organization controls billing, feature access, usage, widget configuration, channels, knowledge bases, actions, notifications, and customer data. Always verify the active organization before testing, taking screenshots, or changing billing.'),
      screenshot('Organization switcher screenshot', 'Capture the organization switcher with the active organization visible.', '/docs-assets/screenshots/organization-switcher.png'),
      h('recommended-order', 'Recommended setup order'),
      steps([
        'Create or select the organization from the sidebar organization switcher.',
        'Choose the plan that matches the workspace requirements: Free, Starter, Pro, or Scale.',
        'Configure the widget profile and install it on staging first.',
        'Add the first Knowledge Base sources and verify source health.',
        'Invite at least one teammate if you want assignment, notifications, and Copilot screenshots.',
        'Configure channels included in the selected plan.',
        'Create one read-only AI action and one confirmation or approval action for testing.',
        'Send a test conversation from the widget and verify realtime inbox updates.',
      ]),
      h('do-not-do', 'Do not do this'),
      list([
        'Do not paste new database changes directly in Supabase SQL editor during normal development. Use project migrations.',
        'Do not delete contacts to clean usage. Contact hard-delete is disabled in the app to preserve history and prevent usage reset abuse.',
        'Do not expose provider secrets or AI action secrets in screenshots, docs, or browser code.',
      ]),
    ],
  },
  {
    slug: 'getting-started/production-checklist',
    section: 'Get Started',
    title: 'Production checklist',
    description: 'Final production QA across widget, inbox, AI, billing, channels, realtime, and rollback readiness.',
    updatedAt,
    readingTime: '10 min read',
    keywords: ['qa', 'production', 'checklist', 'readiness'],
    blocks: [
      p('Use this checklist before sending real customers to the widget. The goal is to remove avoidable surprises while keeping setup practical.'),
      h('core-checks', 'Core checks'),
      list([
        'Database migrations apply from the project without manual SQL editor patches.',
        'Widget installs correctly on staging and production domains.',
        'New conversations, messages, assignment changes, notes, timeline events, and notifications update in realtime.',
        'AI answers stay grounded in approved knowledge or allowed action context.',
        'No verified answer behavior is professional and can route to a human when the visitor asks for help.',
        'SLA policies exist and inbox timers show clear met, at-risk, breached, and backlog states.',
        'Billing guards match UI and backend guards are the final authority.',
      ]),
      h('advanced-capabilities', 'Advanced capabilities'),
      list([
        'AI Improvements page inside Knowledge Base without heavy AI profile or complex eval UI.',
        'Channel-aware AI behavior for chat, email, WhatsApp, and voice.',
        'AI Actions v1 hardening: templates, testing, preview, logs, retry, secrets rotation, domain allowlist, approvals, and analytics.',
        'Customer profiles with timeline, notes, tags, custom fields, CSAT history, calls, and actions used.',
        'Widget CSAT after resolved conversations and CSAT analytics.',
        'Agent Copilot on Pro and Scale only.',
      ]),
      h('rollback-readiness', 'Rollback readiness'),
      list([
        'Know how to disable AI actions without disabling the whole inbox.',
        'Know how to turn off a broken channel while keeping chat active.',
        'Know how to revert the latest deployment and keep database migrations safe.',
        'Keep support contact details ready for Stripe, Supabase, AI provider, email provider, WhatsApp, and Vapi incidents.',
      ]),
      callout('Readiness answer', 'If production configuration is complete and this checklist passes, the workspace is ready for real customer usage. Continue improving from real conversations and analytics.', 'success'),
    ],
  },
  {
    slug: 'widget/install',
    section: 'Widget',
    title: 'Install the widget',
    description: 'Install the customer-facing widget with a script tag and organization ID.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['widget', 'install', 'script', 'embed'],
    blocks: [
      p('The widget is installed with a hosted JavaScript bundle. The organization ID tells the widget which workspace should receive conversations and load theme settings.'),
      screenshot('Widget embed settings screenshot', 'Capture the widget install page with organization ID and script snippet visible.', '/docs-assets/screenshots/widget-embed-settings.png'),
      h('basic-snippet', 'Basic snippet'),
      code('html', '<script\n  src="https://YOUR_APP_DOMAIN/widget.js"\n  data-organization-id="YOUR_ORGANIZATION_ID"\n  async\n></script>'),
      h('where-to-place-it', 'Where to place it'),
      list([
        'Static website: place the script before the closing body tag.',
        'Next.js or React app: load the script once in the root layout or app shell.',
        'CMS or no-code platform: use the global custom code area when available.',
        'Tag manager: use a Custom HTML tag triggered on all pages after consent rules are handled.',
      ]),
      h('verify', 'Verify installation'),
      steps([
        'Open the website in a private browser window.',
        'Confirm the launcher appears in bottom-left or bottom-right position.',
        'Send a test message from the widget.',
        'Open inbox and confirm the conversation appears in realtime.',
        'Reply from inbox and confirm the visitor sees the reply without refreshing.',
      ]),
    ],
  },
  {
    slug: 'widget/no-code-installation',
    section: 'Widget',
    title: 'No-code installation',
    description: 'Help non-technical customers install the widget through website builders and tag managers.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['no-code', 'wordpress', 'shopify', 'webflow', 'tag manager'],
    blocks: [
      p('Non-technical users usually need guided installation. Fully automatic installation is only possible when the customer grants access through a platform integration. Until then, use clear copyable script instructions plus platform-specific guidance.'),
      h('supported-guides', 'Supported guides'),
      table(['Website type', 'Recommended method', 'Notes'], [
        ['WordPress', 'Header/footer plugin or theme custom code', 'Add globally and clear cache after saving.'],
        ['Shopify', 'Theme custom liquid or app embed area', 'Publish theme changes after adding snippet.'],
        ['Webflow', 'Site settings custom code', 'Republish site.'],
        ['Framer', 'Custom code section', 'Add globally.'],
        ['Google Tag Manager', 'Custom HTML tag', 'Trigger on all pages after consent rules.'],
      ]),
      h('future-auto-install', 'Future automatic install'),
      p('A future installer can detect the website platform from a URL, show exact instructions, and use OAuth for supported platforms to inject the script with customer approval. This is useful later, but not required for the basic setup.'),
      screenshot('No-code install wizard screenshot', 'Capture platform selection and install instructions.', '/docs-assets/screenshots/widget-no-code-wizard.png'),
    ],
  },
  {
    slug: 'widget/customization',
    section: 'Widget',
    title: 'Widget customization',
    description: 'Customize light and dark themes, launcher position, help content, and live preview.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['widget', 'customization', 'theme', 'dark mode', 'preview'],
    blocks: [
      p('Widget customization controls how customers experience support on the website. Keep it branded, readable, and lightweight. The widget supports light and dark theme configuration, help content, smooth expand/collapse, chat history, calls, and bottom navigation.'),
      screenshot('Widget customization screenshot', 'Capture settings and live preview side by side on desktop.', '/docs-assets/screenshots/widget-customization.png'),
      h('theme-controls', 'Theme controls'),
      list([
        'Customize light mode colors and background.',
        'Customize dark mode colors and background.',
        'Use bottom-right or bottom-left launcher position only.',
        'Keep message bubbles compact and render long AI answers with markdown formatting.',
        'Expanded widget should animate smoothly and return to configured normal size.',
      ]),
      h('responsive-testing', 'Responsive testing'),
      steps([
        'Test desktop preview with settings and preview panels side by side.',
        'Test tablet widths where settings and preview stack cleanly.',
        'Test mobile widths where composer and primary actions remain visible.',
      ]),
    ],
  },
  {
    slug: 'widget/testing',
    section: 'Widget',
    title: 'Test the widget',
    description: 'Run end-to-end tests for conversations, realtime, AI replies, handoff, voice, and CSAT.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['widget testing', 'realtime', 'handoff', 'csat'],
    blocks: [
      p('Widget testing should cover first visitor experience, returning visitor experience, AI flow, human takeover, resolved conversation CSAT, and mobile behavior. Use a private browser window when you need a clean visitor identity.'),
      h('chat-tests', 'Chat tests'),
      steps([
        'Open the widget as a new visitor and send a first message.',
        'Confirm the new conversation appears in inbox quickly without manual refresh.',
        'Reply from inbox and confirm the widget receives it in realtime.',
        'Take over from AI and release back to AI. Composer state should change immediately.',
        'Resolve the conversation and confirm CSAT appears in the widget.',
      ]),
      h('ai-tests', 'AI tests'),
      list([
        'Ask a question that exists in Knowledge Base and confirm source-backed answer trust appears in inbox.',
        'Ask a question outside Knowledge Base and confirm AI does not invent company-specific details.',
        'Ask for a human and confirm handoff works.',
        'Ask action-related questions with and without required parameters to confirm AI asks for missing values instead of guessing.',
      ]),
      screenshot('Widget live test screenshot', 'Capture a widget conversation with grounded AI answer, human handoff option, and CSAT after resolve.', '/docs-assets/screenshots/widget-live-test.png'),
    ],
  },
  {
    slug: 'inbox/unified-inbox',
    section: 'Inbox Operations',
    title: 'Unified inbox',
    description: 'Manage chat, email, WhatsApp, voice-linked conversations, AI handoff, and human support in one realtime workspace.',
    updatedAt,
    readingTime: '9 min read',
    keywords: ['inbox', 'realtime', 'conversation', 'channels'],
    blocks: [
      p('The unified inbox is the main operating surface for support agents. It should make ownership, channel, status, SLA pressure, AI mode, and next action obvious.'),
      screenshot('Unified inbox screenshot', 'Capture inbox with saved views, channel filter, selected conversation, SLA badges, timeline, and Copilot tab.', '/docs-assets/screenshots/unified-inbox.png'),
      h('main-areas', 'Main areas'),
      list([
        'Conversation list: saved view selector, channel filter, search, status badges, SLA/backlog badges, and recent preview.',
        'Conversation detail: customer identity, assignment, AI or human mode, message thread, trust panel, and composer.',
        'Side panel: notes and timeline plus Agent Copilot for Pro and Scale plans.',
      ]),
      h('realtime-expectation', 'Realtime expectation'),
      p('New conversations, incoming messages, agent replies, assignment changes, status updates, notes, timeline events, notifications, and approval requests should update through realtime events. API refetches are useful for reconciliation, but the visible UI should not wait several seconds for normal updates.'),
      h('responsive-behavior', 'Responsive behavior'),
      list([
        'Conversation list and side panel can be collapsed on wide screens.',
        'On small screens, list, message detail, and side panel become navigable panels.',
        'When no conversation is selected, the empty state should be centered in the available area.',
      ]),
    ],
  },
  {
    slug: 'inbox/saved-views',
    section: 'Inbox Operations',
    title: 'Inbox saved views',
    description: 'Use system saved views to reduce filter confusion and make workflows easier.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['saved views', 'filters', 'inbox'],
    blocks: [
      p('Saved views are curated operational views, not another copy of every status tab. They answer practical questions: what is mine, what is unassigned, what is at risk, what needs human takeover, and what failed.'),
      h('system-views', 'System views'),
      list([
        'All conversations: default inbox overview.',
        'My open conversations: active conversations assigned to the current user.',
        'Unassigned: conversations waiting for ownership.',
        'SLA at risk and SLA breached: conversations needing urgent attention.',
        'Waiting for customer: conversations where the next move is likely the customer.',
        'Human takeover: conversations where AI asked for human help or AI was taken over.',
        'Email only and WhatsApp only: channel-specific work queues.',
        'AI handled: conversations currently handled by AI.',
        'Actions failed: conversations with failed or timed-out AI action logs.',
      ]),
      callout('Minimal UI rule', 'Do not show duplicate tabs, duplicate badges, and duplicate saved views for the same idea. Saved views should replace clutter, not add clutter.', 'info'),
    ],
  },
  {
    slug: 'inbox/assignments-sla',
    section: 'Inbox Operations',
    title: 'Assignments, SLA, and backlog',
    description: 'Use assignment, queue state, SLA timers, and backlog indicators to control workload.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['assignment', 'sla', 'backlog', 'routing'],
    blocks: [
      p('Assignments answer who owns the conversation. SLA answers when the next response or resolution is expected. Backlog shows how long work has been waiting in the current operational state.'),
      h('assignment-model', 'Assignment model'),
      list([
        'Assigned agent is visible in conversation header and customer context.',
        'Assignment changes update other open sessions in realtime.',
        'Routing engine v1 can assign round-robin or load-aware depending on configured logic.',
        'Unassigned conversations are available from saved views.',
      ]),
      h('sla-model', 'SLA model'),
      table(['Timer', 'Meaning', 'Typical use'], [
        ['First response', 'Time from customer start to first AI or agent response.', 'Fast acknowledgement.'],
        ['Next response', 'Time allowed after latest customer reply.', 'Ongoing conversation discipline.'],
        ['Resolution', 'Target time to resolve or close the conversation.', 'Operational quality and reporting.'],
      ]),
      h('backlog-model', 'Backlog model'),
      p('Backlog is not the same as SLA. Backlog should stop being scary when the conversation is resolved or when the team is waiting on the customer. It should highlight active work that has waited too long.'),
      screenshot('SLA and backlog screenshot', 'Capture conversation cards with at-risk, breached, met, and backlog labels visible.', '/docs-assets/screenshots/inbox-sla-backlog.png'),
    ],
  },
  {
    slug: 'inbox/notes-timeline',
    section: 'Inbox Operations',
    title: 'Internal notes and timeline',
    description: 'Collaborate privately inside conversations and keep an auditable timeline of important events.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['notes', 'timeline', 'collaboration', 'audit'],
    blocks: [
      p('Internal notes are private to the team and never shown to the customer. Timeline events record important operational changes so agents understand what happened before they joined.'),
      h('internal-notes', 'Internal notes'),
      list([
        'Agents can add notes that customers cannot see.',
        'The note author can edit or delete their own note.',
        'Edited notes are marked as edited.',
        'Deleted notes stay in the same timeline position with a deleted-note message instead of disappearing from context.',
      ]),
      h('timeline-events', 'Timeline events'),
      list([
        'Customer message received, AI response sent, agent joined, assignment changed, status changed, SLA changed, action executed, contact updated, and CSAT received.',
      ]),
      screenshot('Notes and timeline screenshot', 'Capture internal note composer, edited/deleted note state, and timeline events.', '/docs-assets/screenshots/inbox-notes-timeline.png'),
    ],
  },
  {
    slug: 'inbox/notifications',
    section: 'Inbox Operations',
    title: 'Notifications',
    description: 'Keep agents aware of assignments, new conversations, SLA risk, handoff requests, and approval requests.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['notifications', 'browser notifications', 'email notifications'],
    blocks: [
      p('Notifications help agents notice work even when they are not staring at the inbox. The product includes in-app notifications, optional browser notifications, and email notification infrastructure.'),
      h('notification-types', 'Notification types'),
      list([
        'New conversation notification.',
        'Assigned-to-me notification.',
        'SLA at-risk or breached notification.',
        'AI handoff request notification.',
        'Action approval request notification.',
      ]),
      h('channels', 'Channels'),
      table(['Channel', 'Status', 'Notes'], [
        ['In-app bell', 'Available', 'Available in dashboard topbar/sidebar area.'],
        ['Browser notification', 'Optional', 'Requires user permission.'],
        ['Email notification', 'Email-ready', 'Use Resend or SMTP style provider from server-side environment.'],
        ['Slack', 'Not included now', 'Can be added later when needed.'],
      ]),
      screenshot('Notification bell screenshot', 'Capture notification bell with unread notifications and browser permission state.', '/docs-assets/screenshots/notification-bell.png'),
    ],
  },
  {
    slug: 'ai/knowledge-base',
    section: 'AI Support',
    title: 'Knowledge Base',
    description: 'Manage the sources AI uses to answer grounded customer questions.',
    updatedAt,
    readingTime: '9 min read',
    keywords: ['knowledge base', 'sources', 'rag', 'grounding'],
    blocks: [
      p('The Knowledge Base is the source of truth for company and product answers. AI should act like a support agent representing the current organization, but it should not invent company-specific facts that are not in approved knowledge or action context.'),
      screenshot('Knowledge Base screenshot', 'Capture sources, health status, chunk count, re-index button, delete source button, and AI behavior panel.', '/docs-assets/screenshots/knowledge-base.png'),
      h('source-types', 'Source types'),
      list([
        'Text notes: best for company overview, pricing policy, support rules, product FAQs, and company-specific facts.',
        'URL sources: best for public docs, help centers, and policy pages that should be recrawled.',
        'Documents: best for internal manuals, onboarding guides, or customer support playbooks.',
      ]),
      h('source-health', 'Source health'),
      list([
        'Indexed: source is available for retrieval.',
        'Failed: source could not be indexed and should be fixed or deleted.',
        'Stale: source should be recrawled or reviewed.',
        'Duplicate warning: another source appears to cover the same title or URL.',
        'Low quality warning: source may be too short, vague, outdated, or not useful for support answers.',
      ]),
      h('company-representation', 'Company representation'),
      p('There is no separate heavy AI Profile now. Put company identity, product overview, target customers, services, policies, and support boundaries directly into the Knowledge Base. This keeps the system simple and prevents conflicting profile data.'),
      callout('Grounding rule', 'AI can answer greetings and simple conversational transitions naturally, but company, product, pricing, policy, and account answers should come from verified knowledge or safe actions.', 'info'),
    ],
  },
  {
    slug: 'ai/ai-improvements',
    section: 'AI Support',
    title: 'AI Improvements',
    description: 'Review unanswered questions, low-confidence answers, handoff reasons, and suggested knowledge notes inside Knowledge Base.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['ai improvements', 'quality center', 'unanswered', 'low confidence'],
    blocks: [
      p('AI Improvements is a lightweight quality center inside Knowledge Base. It does not add a heavy AI profile or complex evaluation UI. It turns real failed questions into useful knowledge updates.'),
      h('what-it-shows', 'What it shows'),
      list([
        'Unanswered questions where AI had no verified answer.',
        'Low-confidence answers that need source improvement.',
        'Human handoff reasons and repeated escalation patterns.',
        'Top missing topics extracted from recent customer questions.',
        'Suggested KB note title and draft content that an admin can copy into a real source.',
        'Conversation links so the team can inspect original context.',
      ]),
      h('workflow', 'Workflow'),
      steps([
        'Open Knowledge Base > AI Improvements.',
        'Review top missing topics first.',
        'Open the conversation link for context.',
        'Create or update a KB source with the official answer.',
        'Re-test the same question from the widget.',
      ]),
      screenshot('AI Improvements screenshot', 'Capture unanswered questions, missing topics, handoff reasons, and suggested KB note.', '/docs-assets/screenshots/ai-improvements.png'),
    ],
  },
  {
    slug: 'ai/channel-aware-behavior',
    section: 'AI Support',
    title: 'Channel-aware AI behavior',
    description: 'Adjust answer style for chat, email, WhatsApp, and voice without complex prompt systems.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['ai behavior', 'tone', 'chat', 'email', 'whatsapp', 'voice'],
    blocks: [
      p('The same answer should not look identical in every channel. Channel-aware behavior keeps support responses appropriate for the medium while still using the same grounded knowledge.'),
      h('default-tones', 'Default tones'),
      table(['Channel', 'Tone', 'Expected output'], [
        ['Chat', 'Short and conversational', 'Helpful, direct, with quick next step.'],
        ['Email', 'Structured and complete', 'Greeting, clear sections, full answer, optional signature.'],
        ['WhatsApp', 'Concise and friendly', 'Shorter than email and easy on mobile.'],
        ['Voice', 'Very short and spoken', 'One or two natural spoken sentences.'],
      ]),
      screenshot('AI channel behavior screenshot', 'Capture chat, email, WhatsApp, and voice tone controls.', '/docs-assets/screenshots/ai-channel-behavior.png'),
    ],
  },
  {
    slug: 'ai/actions-v1',
    section: 'AI Support',
    title: 'AI Actions v1',
    description: 'Use endpoint-based actions safely with templates, tests, preview, logs, approvals, retries, secrets, and allowlists.',
    updatedAt,
    readingTime: '10 min read',
    keywords: ['ai actions', 'api', 'secrets', 'approval', 'templates'],
    blocks: [
      p('AI Actions v1 lets AI call approved API endpoints during a conversation. V1 is intentionally endpoint-based, not a complex connector/procedure builder. The priority is stability, safety, logs, and clear admin testing.'),
      screenshot('AI Actions page screenshot', 'Capture action templates, builder, test panel, execution preview, logs, secrets rotation, domain allowlist, and approval queue.', '/docs-assets/screenshots/ai-actions-v1.png'),
      h('safe-design', 'Safe design'),
      list([
        'Use read-only actions for order lookup, subscription status, appointment lookup, account metadata, and delivery tracking.',
        'Require confirmation and/or approval for write actions such as cancel order, refund, update account, book appointment, or change subscription.',
        'Never let AI guess required parameters. If a parameter is missing, it should ask the customer for that parameter.',
        'Use action execution preview before production calls.',
        'Review request, response, status, latency, failure reason, and retry count in logs.',
      ]),
      h('security-controls', 'Security controls'),
      list([
        'Secrets are stored server-side and masked in UI output.',
        'Secrets can be rotated from action settings.',
        'Outbound domain allowlist controls which hosts actions can call.',
        'Failures are translated into readable explanations for admins.',
      ]),
      code('text', 'Read order example: ask \"What is the status of ORDER-12345?\"\nWrite action example: ask \"Can you cancel ORDER-12345 because the customer requested it?\"\nExpected behavior: read actions can run when required parameters are present; write actions require confirmation or approval.'),
      callout('Do not rebuild V2 yet', 'Advanced connectors, procedures, step builder, conditions, dry-run simulator, and temporary attributes are future V2 scope. Keep V1 reliable first.', 'warning'),
    ],
  },
  {
    slug: 'ai/agent-copilot',
    section: 'AI Support',
    title: 'Agent Copilot',
    description: 'Use internal AI assistance for human agents on Pro and Scale plans.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['copilot', 'agent productivity', 'draft reply', 'summarize'],
    blocks: [
      p('Agent Copilot is an internal assistant for human support agents. It is not shown to the customer. It helps agents draft replies, summarize conversations, rewrite text, translate, suggest next actions, and find similar resolved conversations.'),
      callout('Plan availability', 'Agent Copilot is available on Pro and Scale only. Free and Starter see an upgrade prompt, and the backend guard blocks direct API usage.', 'info'),
      h('features', 'Features'),
      list([
        'Draft reply based on conversation and verified sources.',
        'Summarize issue and next step.',
        'Rewrite current draft as friendlier, shorter, more formal, or clearer.',
        'Translate the current draft.',
        'Suggest the next action.',
        'Find similar resolved conversations.',
        'Save useful Copilot output as an internal note.',
      ]),
      screenshot('Agent Copilot screenshot', 'Capture quick actions, composer tools, generated output, sources, suggested actions, and similar conversations.', '/docs-assets/screenshots/agent-copilot.png'),
    ],
  },
  {
    slug: 'channels/chat-widget',
    section: 'Channels',
    title: 'Chat widget channel',
    description: 'Use website chat as the primary AI support, help, handoff, and CSAT channel.',
    updatedAt,
    readingTime: '5 min read',
    keywords: ['chat', 'widget', 'channel'],
    blocks: [
      p('The chat widget is the easiest channel to start with. It supports AI-first replies, human takeover, help content, conversation history, voice entry, and CSAT after resolution.'),
      list([
        'Monitor new chat conversations from saved views.',
        'Use AI answer trust indicators to decide whether to improve knowledge.',
        'Take over when the customer asks for a human or AI confidence is low.',
        'Resolve conversations only when the customer issue is complete.',
      ], 'Daily use'),
    ],
  },
  {
    slug: 'channels/email',
    section: 'Channels',
    title: 'Email channel',
    description: 'Connect email support for structured, slower customer conversations.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['email', 'channel', 'threading'],
    blocks: [
      p('Email is a paid advanced channel. It should not be available on Starter. When unavailable, show clear upgrade messaging instead of confusing preview copy.'),
      list([
        'Configure sender identity and inbound address.',
        'Send a test inbound email.',
        'Reply from dashboard and verify delivery.',
        'Confirm contact matching and thread grouping.',
        'Use email tone for AI: structured, complete, and easy to reference later.',
      ], 'Setup checks'),
      screenshot('Email settings screenshot', 'Capture email channel status, setup state, and a sample email conversation.', '/docs-assets/screenshots/email-channel-settings.png'),
    ],
  },
  {
    slug: 'channels/whatsapp',
    section: 'Channels',
    title: 'WhatsApp channel',
    description: 'Prepare WhatsApp support with phone identity and concise AI behavior.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['whatsapp', 'meta', 'channel'],
    blocks: [
      p('WhatsApp is a high-intent support channel and should stay on higher plans because it adds messaging cost and operational load. Keep replies concise and mobile-friendly.'),
      steps([
        'Connect the WhatsApp account or configure provider credentials.',
        'Send a real inbound test message.',
        'Confirm contact phone and WhatsApp ID appear in customer context.',
        'Reply from dashboard and verify delivery.',
        'Confirm the conversation appears in WhatsApp saved view and channel filters.',
      ], 'Setup checks'),
      screenshot('WhatsApp channel screenshot', 'Capture WhatsApp channel settings and an inbox WhatsApp conversation.', '/docs-assets/screenshots/whatsapp-channel.png'),
    ],
  },
  {
    slug: 'channels/voice',
    section: 'Channels',
    title: 'Voice assistant and calls',
    description: 'Use AI voice calls with Vapi keys, voice minute limits, call logs, transcripts, and summaries.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['voice', 'calls', 'vapi', 'transcript'],
    blocks: [
      p('Voice support is a premium channel because it has provider cost and customers expect fast, natural answers. The product uses platform provider keys by default instead of asking every customer to bring their own keys.'),
      table(['Plan', 'Included voice minutes', 'Notes'], [
        ['Free', '0', 'No voice minutes included.'],
        ['Starter', '0', 'Chat-first plan.'],
        ['Pro', '60', 'Good for early customer calls and AI voice testing.'],
        ['Scale', '250', 'Better for regular call volume.'],
      ]),
      list([
        'Show call status, elapsed time, professional voice activity bars, and transcript clearly.',
        'Avoid cartoon-style visuals in production.',
        'Save call summaries and transcripts for customer profile context.',
      ], 'Call UI'),
      screenshot('Voice call UI screenshot', 'Capture professional call state, animated voice bars, and transcript area.', '/docs-assets/screenshots/voice-call-ui.png'),
    ],
  },
  {
    slug: 'admin/team-permissions',
    section: 'Admin',
    title: 'Team and permissions',
    description: 'Invite teammates, assign roles, and keep sensitive workspace controls limited.',
    updatedAt,
    readingTime: '6 min read',
    keywords: ['team', 'permissions', 'roles'],
    blocks: [
      p('Keep team access simple. Admins configure the workspace. Agents handle customer conversations and customer context.'),
      table(['Role', 'Best use', 'Access'], [
        ['Admin', 'Founder, support lead, workspace owner', 'Billing, channels, widget, knowledge, team, analytics, and actions.'],
        ['Agent', 'Support teammate', 'Inbox, assigned conversations, customer context, notes, and allowed workflows.'],
      ]),
      list([
        'Invite team after widget, knowledge, channels, and billing are configured.',
        'Use assignment and saved views to separate workload.',
        'Use notifications so agents notice assigned conversations and SLA risk.',
      ], 'Team workflow'),
      screenshot('Team settings screenshot', 'Capture team members, roles, invite state, and permissions.', '/docs-assets/screenshots/team-settings.png'),
    ],
  },
  {
    slug: 'admin/billing-usage-addons',
    section: 'Admin',
    title: 'Billing, usage, and add-ons',
    description: 'Understand plans, feature gates, discounts, trials, usage limits, and custom add-ons.',
    updatedAt,
    readingTime: '10 min read',
    keywords: ['billing', 'plans', 'addons', 'usage', 'stripe'],
    blocks: [
      p('Billing should be predictable before checkout. Customers should see the correct plan price, automatic discount, trial state, due today amount, usage limits, and add-on quantity before payment.'),
      table(['Plan', 'Price', 'Best for', 'Important limits'], [
        ['Free', '$0', 'Testing and preview', 'Limited conversations, no advanced channels, no Copilot.'],
        ['Starter', '$19/mo', 'Solo chat-first teams', 'Chat and widget customization, no email/WhatsApp/voice/actions/Copilot.'],
        ['Pro', '$29/mo', 'Growing support teams', 'Email, WhatsApp, voice 60 min, analytics, actions, Copilot.'],
        ['Scale', '$79/mo', 'Higher-volume teams', 'Larger limits, voice 250 min, priority support, Copilot.'],
      ]),
      list([
        'Extra conversations: custom quantity with a minimum amount.',
        'Extra voice minutes: custom quantity with a minimum amount.',
        'Extra team seats: custom quantity with clear cost calculation.',
        'Extra knowledge bases and KB chunks: extend knowledge capacity.',
      ], 'Add-ons'),
      p('Contact hard-delete is disabled from the app. This protects conversation history, call logs, audit trails, and usage limits. Editing contact identity is allowed; deleting support history to reduce usage is not allowed.'),
      screenshot('Billing page screenshot', 'Capture plan cards, feature comparison, discounted due today amount, and add-on custom quantity controls.', '/docs-assets/screenshots/billing-usage-addons.png'),
    ],
  },
  {
    slug: 'admin/customer-profiles',
    section: 'Admin',
    title: 'Customer profiles',
    description: 'Use contacts as a customer intelligence center with history, timeline, notes, tags, custom fields, calls, CSAT, and actions used.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['contacts', 'customer profile', 'timeline', 'custom fields'],
    blocks: [
      p('Contacts is not only an address book. It is the customer intelligence center for support teams. Agents should quickly understand who the customer is, what they asked before, which channels they used, and what actions were taken.'),
      screenshot('Customer profile screenshot', 'Capture profile with timeline, notes, channel history, tags, custom fields, CSAT, calls, and AI actions used.', '/docs-assets/screenshots/customer-profile.png'),
      list([
        'Overview: contact identity, last seen, current page, tags, custom fields, and account attributes.',
        'Timeline: conversations, messages, calls, notes, CSAT, and action events.',
        'Conversations: chat, email, WhatsApp, and voice history grouped by channel.',
        'Notes: internal customer notes that customers cannot see.',
        'CSAT and AI action history: satisfaction and operational actions used for this contact.',
      ], 'Profile sections'),
      p('Contact editing remains available for correcting name, email, phone, tags, notes, and custom fields. Contact hard-delete is disabled to avoid data loss and usage reset abuse. Future archive or anonymize flows can be added without deleting conversation history.'),
    ],
  },
  {
    slug: 'admin/csat-feedback',
    section: 'Admin',
    title: 'CSAT and feedback',
    description: 'Capture customer satisfaction after resolved conversations and review CSAT by channel, agent, and handling mode.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['csat', 'feedback', 'satisfaction', 'analytics'],
    blocks: [
      p('CSAT shows whether customers are satisfied, not only whether support was fast. It fills the gap between operational performance and customer sentiment.'),
      list([
        'CSAT appears after a widget conversation is resolved.',
        'Customer can choose a rating and optionally leave a comment.',
        'Rating is saved against conversation, contact, channel, and handling mode.',
      ], 'Widget CSAT'),
      list([
        'CSAT trend over time.',
        'CSAT by channel.',
        'CSAT by assigned agent.',
        'CSAT by AI vs human handled conversations.',
        'Recent customer comments for qualitative review.',
      ], 'Analytics'),
      screenshot('CSAT feedback screenshot', 'Capture widget CSAT and analytics CSAT breakdown.', '/docs-assets/screenshots/csat-feedback.png'),
    ],
  },
  {
    slug: 'admin/analytics-reporting',
    section: 'Admin',
    title: 'Analytics and reporting',
    description: 'Track conversation demand, SLA pressure, CSAT, action quality, and workspace readiness.',
    updatedAt,
    readingTime: '8 min read',
    keywords: ['analytics', 'reporting', 'graphs', 'workspace readiness'],
    blocks: [
      p('Analytics should answer operational questions, not just display decorative cards. The current analytics experience focuses on graphs and trends: demand, SLA, CSAT, channel quality, action reliability, and readiness.'),
      list([
        'Operations pulse: intake, resolved volume, message volume, and SLA breach spikes over time.',
        'CSAT trend: ratings and response count by date.',
        'CSAT breakdown: channel, handling mode, agent, and recent comments.',
        'SLA and channel quality: breach rate, speed, and pressure by channel.',
        'Action quality: success, fail, timeout, retry, latency, and recent failure reasons.',
        'Workspace readiness: SLA policies, active breaches, action health, operational testing, and recovery checks.',
      ], 'Core reports'),
      screenshot('Analytics dashboard screenshot', 'Capture analytics after conversations, CSAT responses, channel activity, SLA states, and action logs are visible.', '/docs-assets/screenshots/analytics-reporting.png'),
    ],
  },
  {
    slug: 'developers/widget-api',
    section: 'Developers',
    title: 'Widget JavaScript API',
    description: 'Reference for loading the widget and passing visitor identity or metadata from the host website.',
    updatedAt,
    readingTime: '7 min read',
    keywords: ['widget api', 'javascript', 'identify', 'metadata'],
    blocks: [
      p('The widget works with only the script tag. Advanced websites can pass visitor identity and metadata so conversations connect to real customers instead of anonymous contacts.'),
      code('html', '<script\n  src="https://YOUR_APP_DOMAIN/widget.js"\n  data-organization-id="YOUR_ORGANIZATION_ID"\n  async\n></script>'),
      code('html', '<script>\n  window.TinfizAI = window.TinfizAI || [];\n  window.TinfizAI.push(["identify", {\n    externalId: "customer_123",\n    name: "Ava Brooks",\n    email: "ava@example.com",\n    metadata: { plan: "pro", accountStatus: "active" }\n  }]);\n</script>'),
      list([
        'Do not send passwords, secrets, private tokens, payment card data, or sensitive regulated data.',
        'Send stable customer IDs when available so contacts merge correctly.',
        'Keep metadata small and useful for support context.',
      ], 'Metadata rules'),
      callout('Future API keys', 'A public/private key system can later expose server APIs for contacts, conversations, events, webhooks, and action callbacks. Keep widget public identifiers separate from server-side private keys.', 'info'),
    ],
  },
  {
    slug: 'developers/security-production',
    section: 'Developers',
    title: 'Security and production checklist',
    description: 'Secure secrets, actions, provider keys, customer data, migrations, and deployment operations before production use.',
    updatedAt,
    readingTime: '9 min read',
    keywords: ['security', 'production', 'secrets', 'deployment'],
    blocks: [
      p('Production security should be clear and boring: least privilege, server-side secrets, safe defaults, migrations from the repo, and visible operational logs.'),
      list([
        'Set Supabase URL and service key on the API server only.',
        'Set AI provider keys server-side only.',
        'Set Stripe secret, webhook secret, plan price IDs, coupons, and app URL correctly.',
        'Set email notification sender, reply-to, and Resend or SMTP credentials server-side.',
        'Set Vapi credentials server-side if voice is enabled.',
      ], 'Environment'),
      list([
        'Store action secrets encrypted and never expose them to browser.',
        'Use outbound domain allowlists.',
        'Require confirmation or approval for write actions.',
        'Set action timeouts and log readable failure reasons.',
      ], 'Actions security'),
      list([
        'Apply Drizzle migrations from the project.',
        'Do not delete migration files listed in the Drizzle journal.',
        'Keep RLS policies and service role access intentional.',
        'Use cleanup scripts only for rows with demo seed markers.',
      ], 'Database'),
    ],
  },
  {
    slug: 'troubleshooting/common-issues',
    section: 'Troubleshooting',
    title: 'Common issues',
    description: 'Resolve common setup issues with widget install, realtime inbox, billing, AI, channels, and migrations.',
    updatedAt,
    readingTime: '10 min read',
    keywords: ['troubleshooting', 'issues', 'debug', 'fix'],
    blocks: [
      h('widget-not-showing', 'Widget is not showing'),
      list([
        'Confirm script is present on the page.',
        'Confirm organization ID is correct.',
        'Check browser console for blocked scripts, CSP, or network errors.',
        'Test in a private window to avoid stale local state.',
      ]),
      h('realtime-delayed', 'Realtime feels delayed'),
      list([
        'Confirm websocket connection is active.',
        'Check whether UI waits for API refetch instead of applying realtime events.',
        'Verify organization ID and selected conversation subscriptions match active workspace.',
        'Use API refetch as reconciliation, not as the primary visible update path.',
      ]),
      h('ai-not-grounded', 'AI answer is not grounded'),
      list([
        'Review the knowledge source that should answer the question.',
        'Check source status, chunk count, and last indexed time.',
        'Ask a direct test question matching the source text.',
        'Do not add broad prompts that allow generic company-specific claims.',
      ]),
      h('action-did-not-run', 'AI action did not run'),
      list([
        'Confirm action is active and domain is allowlisted.',
        'Confirm all required parameters are present.',
        'Check secrets, rendered URL, request preview, and latest log failure reason.',
        'For write actions, confirm required confirmation or approval happened.',
      ]),
      h('billing-access-wrong', 'Billing access looks wrong'),
      list([
        'Refresh after switching organizations.',
        'Confirm frontend plan details and server-side plan guards use the same plan source.',
        'Remember: Agent Copilot, AI Actions, email, WhatsApp, voice, and analytics are not Starter features.',
      ]),
      h('migration-failed', 'Migration failed'),
      list([
        'Do not remove migration files already referenced by Drizzle journal.',
        'Run migrations from the project command.',
        'Check that referenced SQL functions exist in baseline migration.',
        'Use a fresh database only when you intentionally want a clean production reset.',
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


