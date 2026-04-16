import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from './trpc/router'
import { createContext } from './trpc/context'
import { createWsServer } from './ws/wsServer'
import { widgetConfigRoute } from './routes/widget-config.route'
import { vapiWebhookRoute } from './routes/vapi-webhook.route'
import { voicePreviewRoute } from './routes/voice-preview.route'
import { stripeWebhookRoute } from './routes/stripe-webhook.route'
import { uploadRoute } from './routes/upload.route'
import { emailInboundRoute } from './routes/email-inbound.route'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const WS_PORT = Number(process.env.WS_PORT || 3003)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// ── Custom routes registered BEFORE global express.json ─────────────────────

// File upload — larger JSON limit
app.use('/api/upload', express.json({ limit: '15mb' }), uploadRoute)

app.use('/api/widget-config', widgetConfigRoute)

// Email inbound webhooks — support both JSON (Postmark) and URL-encoded (Mailgun)
// Must be registered before global express.json()
app.use(
  '/api/email-inbound',
  (req: Request, res: Response, next: NextFunction) => {
    const ct = req.headers['content-type'] ?? ''
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      express.urlencoded({ extended: true, limit: '5mb' })(req, res, next)
    } else {
      express.json({ limit: '5mb' })(req, res, next)
    }
  },
  emailInboundRoute
)

// ── Global CORS ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }))

// ── Raw body routes (BEFORE express.json) ─────────────────────────────────────

// Vapi webhook
app.use(
  '/api/vapi-webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  (req: Request & { rawBody?: string }, _res: Response, next: NextFunction) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8')
      try {
        req.body = JSON.parse(req.rawBody) as Record<string, unknown>
      } catch {
        req.body = {}
      }
    }
    next()
  },
  vapiWebhookRoute
)

// Stripe webhook — raw body required for signature verification
app.use(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  stripeWebhookRoute
)

// ── JSON body for everything else ─────────────────────────────────────────────
app.use(express.json())

app.use('/api/voice-preview', voicePreviewRoute)
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`))
createWsServer(WS_PORT)