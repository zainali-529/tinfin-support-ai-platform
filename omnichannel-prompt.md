PROMPT: WhatsApp Channel + Unified Omnichannel Inbox
```
────────────────────────────────────────────────────────────────────
CONTEXT \& EXISTING STACK
────────────────────────────────────────────────────────────────────

Tinfin is an AI-powered customer support SaaS (Turborepo monorepo):
  apps/api   → Express + tRPC v11, Supabase JS client, BullMQ, ioredis
  apps/web   → Next.js 16 App Router, NativeWind-style TW, shadcn/ui
  packages/ai → OpenAI RAG pipeline (queryRAG), Vapi voice service
  packages/ui → Full shadcn component library

Database: Supabase (PostgreSQL + pgvector + Realtime)

EXISTING relevant tables:
  organizations, users, user\_organizations, contacts,
  conversations (has: id, org\_id, contact\_id, status, channel, assigned\_to, started\_at),
  messages (has: id, conversation\_id, org\_id, role, content, attachments, ai\_metadata),
  email\_accounts (BYOK email channel config)
  email\_messages (email-specific thread data)

EXISTING conversation channels: 'chat' | 'email'
EXISTING conversation statuses: 'bot' | 'pending' | 'open' | 'resolved' | 'closed'

────────────────────────────────────────────────────────────────────
WHAT WE ARE BUILDING
────────────────────────────────────────────────────────────────────

1. WhatsApp Channel (BYOK via Meta Cloud API)
2. Unified Omnichannel Inbox (replaces separate chat/email inboxes)

The unified inbox is designed to SCALE to future channels:
  Current:  'chat' | 'email' | 'whatsapp'
  Future:   + 'facebook' | 'instagram' | 'sms' | 'telegram'

────────────────────────────────────────────────────────────────────
DATABASE SCHEMA — ADD THESE
────────────────────────────────────────────────────────────────────

-- WhatsApp account config (BYOK — user brings Meta credentials)
CREATE TABLE whatsapp\_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  org\_id                UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  phone\_number\_id       TEXT NOT NULL,          -- Meta Phone Number ID
  whatsapp\_business\_id  TEXT NOT NULL,          -- WABA ID
  access\_token          TEXT NOT NULL,          -- encrypted permanent token
  display\_phone\_number  TEXT,                   -- "+923001234567"
  display\_name          TEXT,                   -- shown to customers
  webhook\_verify\_token  TEXT NOT NULL UNIQUE,   -- for Meta webhook handshake
  is\_active             BOOLEAN DEFAULT true,
  ai\_auto\_reply         BOOLEAN DEFAULT true,
  created\_at            TIMESTAMPTZ DEFAULT now(),
  updated\_at            TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp-specific message data (mirrors email\_messages pattern)
CREATE TABLE whatsapp\_messages (
  id                  UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  org\_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation\_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message\_id          UUID REFERENCES messages(id) ON DELETE SET NULL,
  wa\_message\_id       TEXT UNIQUE,             -- Meta's message ID (dedup key)
  wa\_contact\_id       TEXT,                    -- WhatsApp phone number of contact
  direction           TEXT NOT NULL,           -- 'inbound' | 'outbound'
  status              TEXT DEFAULT 'sent',     -- 'sent' | 'delivered' | 'read' | 'failed'
  message\_type        TEXT DEFAULT 'text',     -- 'text' | 'image' | 'audio' | 'document' | 'template'
  media\_url           TEXT,                    -- for image/audio/document messages
  media\_mime\_type     TEXT,
  raw\_payload         JSONB,                   -- full Meta webhook payload
  created\_at          TIMESTAMPTZ DEFAULT now()
);

-- Index for fast dedup lookups
CREATE INDEX idx\_whatsapp\_messages\_wa\_id ON whatsapp\_messages (wa\_message\_id);
CREATE INDEX idx\_whatsapp\_messages\_conv  ON whatsapp\_messages (conversation\_id);

-- Update conversations channel constraint to allow 'whatsapp'
-- (no migration needed if channel is TEXT type, just update app-layer validation)

────────────────────────────────────────────────────────────────────
BACKEND FILES TO CREATE
────────────────────────────────────────────────────────────────────

FILE 1: apps/api/src/services/whatsapp.service.ts
  
  Export these functions:
  
  parseWhatsAppWebhook(body: unknown): ParsedWAMessage | null
    - Parse Meta webhook payload
    - Extract: fromPhone, waMessageId, messageType, text, mediaId, timestamp
    - Return null if not a message event (delivery receipts, etc.)
  
  sendWhatsAppMessage(params: {
    phoneNumberId: string
    accessToken: string  
    toPhone: string
    text: string
    replyToWaMessageId?: string  // for threading
  }): Promise<{ waMessageId: string }>
    - POST to https://graph.facebook.com/v18.0/{phoneNumberId}/messages
    - Authorization: Bearer {accessToken}
    - Body: { messaging\_product: "whatsapp", to, type: "text", text: { body } }
    - Return Meta's response message ID
  
  downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<Buffer>
    - GET https://graph.facebook.com/v18.0/{mediaId} → get download URL
    - GET that URL with Bearer token → return buffer
  
  verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean
    - HMAC-SHA256 verify: "sha256=" + hex(HMAC(appSecret, payload))
    - Use timingSafeEqual
  
  interface ParsedWAMessage {
    fromPhone: string           // "923001234567"
    fromName: string | null     // display name if available
    waMessageId: string         // "wamid.xxx"
    messageType: 'text' | 'image' | 'audio' | 'document' | 'sticker' | 'unsupported'
    text: string                // for text messages
    mediaId?: string            // for media messages
    mediaMimeType?: string
    timestamp: string           // Unix timestamp string
    phoneNumberId: string       // which WA number received this
    wabaId: string              // WABA ID
  }

FILE 2: apps/api/src/routes/whatsapp-webhook.route.ts

  GET /:token
    - Meta webhook verification (hub.challenge handshake)
    - Lookup whatsapp\_accounts WHERE webhook\_verify\_token = token
    - Verify hub.verify\_token matches, return hub.challenge
  
  POST /:token
    - Verify X-Hub-Signature-256 header (use verifyWebhookSignature)
    - Parse with parseWhatsAppWebhook()
    - If null (delivery receipt etc.) → return 200 immediately
    - Dedup check: SELECT FROM whatsapp\_messages WHERE wa\_message\_id = ?
    - resolveConversation() → same pattern as email-inbound.route.ts:
        1. Look up contact by phone number
        2. Find existing open conversation for this contact+channel='whatsapp'
        3. If none: create new conversation { status: 'pending', channel: 'whatsapp' }
    - upsertContact() → create/update contact with phone number
    - Store in messages table: { role: 'user', content: text }
    - Store in whatsapp\_messages: { wa\_message\_id, direction: 'inbound', ... }
    - If account.ai\_auto\_reply → call queryRAG() → sendWhatsAppMessage()
    - Return 200 immediately (Meta retries on non-200)
  
  Register in apps/api/src/index.ts:
    app.use('/api/whatsapp-webhook', express.json(), whatsappWebhookRoute)

FILE 3: apps/api/src/routers/whatsapp.router.ts (tRPC)
  
  Procedures:
  
  getAccount → SELECT from whatsapp\_accounts WHERE org\_id = userOrgId
    Returns: { id, displayPhoneNumber, displayName, isActive, aiAutoReply, webhookUrl }
    webhookUrl = `${process.env.API\_BASE\_URL}/api/whatsapp-webhook/${account.webhook\_verify\_token}`
    NEVER return access\_token to frontend (security)
  
  setupAccount (admin only) → input: {
    phoneNumberId: string
    whatsappBusinessId: string
    accessToken: string       // will be stored encrypted
    displayPhoneNumber: string
    displayName?: string
  }
    - requireFeature(supabase, orgId, 'whatsappChannel')  ← add to plan features
    - Generate webhook\_verify\_token = crypto.randomBytes(32).hex()
    - Verify token works by calling Meta Graph API test: 
      GET https://graph.facebook.com/v18.0/{phoneNumberId}?access\_token={token}
      If 200 → token valid
    - Upsert into whatsapp\_accounts
    - Return { webhookUrl, verifyToken } so user can configure in Meta dashboard
  
  deleteAccount (admin only)
    → DELETE from whatsapp\_accounts WHERE org\_id = userOrgId
  
  testConnection (admin only)
    → GET Meta API to verify token still valid
  
  getMessages({ conversationId }) 
    → SELECT from whatsapp\_messages WHERE conversation\_id = ?
  
  sendReply (input: { conversationId, content })
    → requireFeature 'whatsappChannel'
    → Get whatsapp\_account for org
    → Get contact's phone number from conversation
    → sendWhatsAppMessage()
    → Insert into messages + whatsapp\_messages
    → Update conversation status if needed

Add 'whatsapp: whatsappRouter' to apps/api/src/trpc/router.ts

────────────────────────────────────────────────────────────────────
PLAN FEATURES UPDATE
────────────────────────────────────────────────────────────────────

In apps/api/src/lib/plans.ts, add to features:
  whatsappChannel: false (free) / true (pro+)

In FEATURE\_NAMES:
  whatsappChannel: 'WhatsApp Channel'

────────────────────────────────────────────────────────────────────
FRONTEND — UNIFIED OMNICHANNEL INBOX
────────────────────────────────────────────────────────────────────

CORE PRINCIPLE: One inbox, all channels. No more separate /email and /inbox pages.

The unified inbox replaces both:
  apps/web/app/(dashboard)/inbox/page.tsx   (chat only)
  apps/web/app/(dashboard)/email/page.tsx   (email only)

New structure:
  apps/web/app/(dashboard)/inbox/page.tsx   ← unified omnichannel inbox

FILE: apps/web/components/inbox/UnifiedInbox.tsx (main component)
  
  LAYOUT:
  ┌─────────────────────────────────────────────────────────┐
  │  SIDEBAR (300px)          │  CONVERSATION VIEW           │
  │                           │                             │
  │  \[🔍 Search]              │  (ConversationView or       │
  │                           │   EmailConversationView or  │
  │  Filter tabs:             │   WhatsAppConversationView  │
  │  \[All] \[Bot] \[Open]       │   — selected by channel)    │
  │  \[Pending] \[Resolved]     │                             │
  │                           │                             │
  │  Channel filter:          │                             │
  │  \[All Channels ▼]         │                             │
  │   ├ 💬 Chat               │                             │
  │   ├ 📧 Email              │                             │
  │   └ 📱 WhatsApp           │                             │
  │                           │                             │
  │  \[ConversationListItem]   │                             │
  │  \[ConversationListItem]   │                             │
  │  \[ConversationListItem]   │                             │
  └─────────────────────────────────────────────────────────┘

FILE: apps/web/components/inbox/ConversationListItem.tsx
  
  Show channel icon badge on each conversation:
    💬 = chat, 📧 = email, 📱 = WhatsApp
  
  interface ConversationListItemProps {
    conversation: Conversation  // channel field drives icon
    isSelected: boolean
    onSelect: () => void
  }
  
  Channel icon helper:
    const CHANNEL\_ICONS = {
      chat:      '💬',
      email:     '📧',
      whatsapp:  '📱',
      facebook:  '👥',   // future
      instagram: '📸',   // future
      sms:       '📲',   // future
      telegram:  '✈️',   // future
    }
  
  Contact display: name ?? email ?? phone ?? 'Anonymous'
  
  Preview text logic:
    chat/whatsapp: last message content
    email: subject line from email\_messages

FILE: apps/web/components/inbox/ConversationRenderer.tsx
  
  Channel-aware right panel renderer:
  
  function ConversationRenderer({ conversation, orgId, agentId, onStatusChange }) {
    switch (conversation.channel) {
      case 'email':
        return <EmailConversationView ... />
      case 'whatsapp':
        return <WhatsAppConversationView ... />
      case 'chat':
      default:
        return <ConversationView ... />  // existing WebSocket chat
    }
  }

FILE: apps/web/components/inbox/WhatsAppConversationView.tsx
  
  Similar to EmailConversationView but for WhatsApp:
  
  Top header:
    Contact name + phone number
    Channel badge: \[📱 WhatsApp]
    Status controls: \[Take Over] \[Resolve]
  
  Messages area:
    Fetch from trpc.whatsapp.getMessages({ conversationId })
    Also fetch from trpc.chat.getMessages for AI messages
    Merge and sort by timestamp
    
    Message bubble styles:
      Inbound (customer): left-aligned, gray bubble
      Outbound AI:        right-aligned, primary/brand color
      Outbound Agent:     right-aligned, green bubble
      System:             centered, gray text
  
  Media messages:
    image → <img> with download link
    audio → <audio controls>
    document → file card with download
    unsupported → "Media message (view on WhatsApp)"
  
  Reply composer (bottom):
    Textarea (no rich text needed for WA)
    \[Send] button → trpc.whatsapp.sendReply.mutate()
    Character counter (WhatsApp limit: 4096 chars)
    
    If conversation.status === 'bot' or 'pending':
      Show "Take over conversation first" overlay
      \[Take Over] button → updates status to 'open'

FILE: apps/web/components/channels/WhatsAppSetupPage.tsx
  
  Settings → Channels → WhatsApp
  
  If not connected:
    Step 1: Input fields
      Phone Number ID (from Meta dashboard)
      WhatsApp Business Account ID
      Access Token (permanent token)
      Display Phone Number
      \[Connect WhatsApp] button → trpc.whatsapp.setupAccount
    
    After connect → show webhook configuration:
    ┌─────────────────────────────────────────────┐
    │ ✅ WhatsApp connected!                       │
    │                                             │
    │ Now configure in Meta dashboard:            │
    │                                             │
    │ Webhook URL:                                │
    │ https://api.tinfin.com/api/whatsapp-webhook/│
    │ {token}                    \[📋 Copy]        │
    │                                             │
    │ Verify Token:                               │
    │ {verifyToken}              \[📋 Copy]        │
    │                                             │
    │ Subscribe to: messages, message\_deliveries  │
    └─────────────────────────────────────────────┘
  
  If connected:
    Status card showing phone number + active status
    AI Auto Reply toggle
    \[Test Connection] \[Disconnect] buttons

ROUTES TO ADD/MODIFY:
  
  apps/web/app/(dashboard)/inbox/page.tsx
    → Replace with UnifiedInbox component
    → Remove channel-specific filtering (it's now in the inbox itself)
  
  apps/web/app/(dashboard)/email/page.tsx
    → Add redirect to /inbox?channel=email
    OR keep but add deprecation notice
    → Recommended: redirect to unified inbox with filter preset
  
  apps/web/app/(dashboard)/settings/channels/page.tsx (new)
    → Channel management hub
    → Lists all channels with status
    → Links to per-channel setup pages
  
  apps/web/app/(dashboard)/settings/channels/whatsapp/page.tsx (new)
    → WhatsAppSetupPage component

────────────────────────────────────────────────────────────────────
HOOKS
────────────────────────────────────────────────────────────────────

apps/web/hooks/useConversations.ts (modify existing)
  - Add optional channelFilter parameter
  - Supabase realtime subscription already handles live updates
  - Add channel to the query select

apps/web/hooks/useWhatsApp.ts (new)
  export function useWhatsAppAccount()
    → trpc.whatsapp.getAccount
  
  export function useWhatsAppMessages(conversationId: string | null)
    → trpc.whatsapp.getMessages
    → Realtime: subscribe to whatsapp\_messages table
  
  export function useWhatsAppReply()
    → trpc.whatsapp.sendReply mutation

────────────────────────────────────────────────────────────────────
SIDEBAR NAVIGATION UPDATE
────────────────────────────────────────────────────────────────────

In apps/web/components/app-sidebar.tsx:

Remove:
  - Separate "Email" inbox link

Update:
  - "Inbox" → now unified (all channels)
  - Add badge showing total unread count across all channels

Add to Settings section:
  - "Channels" → /settings/channels

────────────────────────────────────────────────────────────────────
SCALABILITY — ADDING FUTURE CHANNELS
────────────────────────────────────────────────────────────────────

This architecture is designed so adding Facebook/Instagram/SMS/Telegram
requires only:

1. New DB table: {platform}\_messages (same pattern as whatsapp\_messages)
2. New service: {platform}.service.ts (parse + send functions)
3. New webhook route: {platform}-webhook.route.ts
4. New tRPC router: {platform}.router.ts
5. New setup UI: {Platform}SetupPage.tsx
6. Add case to ConversationRenderer.tsx
7. Add channel icon to CHANNEL\_ICONS
8. Add plan feature flag

The UnifiedInbox, ConversationListItem, ConversationRenderer
DO NOT need to be rewritten — they scale automatically
because they're driven by conversation.channel.

────────────────────────────────────────────────────────────────────
META BUSINESS SETUP GUIDE (for docs/settings page)
────────────────────────────────────────────────────────────────────

Show this in WhatsApp setup page as a collapsible guide:

Step 1: Go to developers.facebook.com
Step 2: Create App → Business type
Step 3: Add "WhatsApp" product to your app
Step 4: In WhatsApp → Getting Started:
  - Note your "Phone Number ID"
  - Note your "WhatsApp Business Account ID"
  - Generate a "Permanent Access Token" (not temporary)
Step 5: Paste those 3 values into Tinfin setup form
Step 6: Click Connect → Copy the Webhook URL and Verify Token shown
Step 7: In Meta App → WhatsApp → Configuration:
  - Paste Webhook URL
  - Paste Verify Token
  - Click Verify and Save
  - Subscribe to: messages, message\_deliveries, message\_reads
Step 8: Done! Send a test WhatsApp message to your number.

────────────────────────────────────────────────────────────────────
CODE QUALITY REQUIREMENTS
────────────────────────────────────────────────────────────────────

- All existing features must continue working unchanged
  (chat WebSocket, email channel, Vapi calls, KB, analytics)

- TypeScript strict mode throughout
- All API errors caught and logged (never crash webhook handler)
- Webhook handlers always return 200 (Meta retries on non-200)
- Deduplication on wa\_message\_id (Meta sends duplicates sometimes)
- Access tokens NEVER returned to frontend
- Webhook signature verification in production mode
- Prettier config: singleQuote: false, printWidth: 80, semi: false

- Supabase realtime subscription for whatsapp\_messages
  so agent sees new WA messages without refresh

- Follow exact same patterns as email channel:
  email\_accounts → whatsapp\_accounts
  email\_messages → whatsapp\_messages
  email.router.ts → whatsapp.router.ts
  email-inbound.route.ts → whatsapp-webhook.route.ts
  EmailConversationView → WhatsAppConversationView

────────────────────────────────────────────────────────────────────
DELIVERABLES CHECKLIST
────────────────────────────────────────────────────────────────────

Backend:
\[ ] SQL migration (whatsapp\_accounts, whatsapp\_messages tables)
\[ ] apps/api/src/services/whatsapp.service.ts
\[ ] apps/api/src/routes/whatsapp-webhook.route.ts
\[ ] apps/api/src/routers/whatsapp.router.ts
\[ ] Update apps/api/src/lib/plans.ts (add whatsappChannel feature)
\[ ] Update apps/api/src/trpc/router.ts (register whatsapp router)
\[ ] Update apps/api/src/index.ts (register webhook route)

Frontend:
\[ ] apps/web/components/inbox/UnifiedInbox.tsx
\[ ] apps/web/components/inbox/ConversationListItem.tsx (updated)
\[ ] apps/web/components/inbox/ConversationRenderer.tsx
\[ ] apps/web/components/inbox/WhatsAppConversationView.tsx
\[ ] apps/web/components/channels/WhatsAppSetupPage.tsx
\[ ] apps/web/app/(dashboard)/inbox/page.tsx (updated to unified)
\[ ] apps/web/app/(dashboard)/settings/channels/page.tsx (new)
\[ ] apps/web/app/(dashboard)/settings/channels/whatsapp/page.tsx (new)
\[ ] apps/web/hooks/useWhatsApp.ts (new)
\[ ] Update sidebar navigation

SQL:
\[ ] vapi migration already done
\[ ] whatsapp\_accounts table
\[ ] whatsapp\_messages table
\[ ] indexes