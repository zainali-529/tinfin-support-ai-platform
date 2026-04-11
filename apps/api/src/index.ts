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

const app = express()
const PORT = Number(process.env.PORT || 3001)
const WS_PORT = Number(process.env.WS_PORT || 3003)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }))

// ── Raw body routes (BEFORE express.json) ─────────────────────────────────────

// Vapi webhook
app.use(
  '/api/vapi-webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  (req: Request & { rawBody?: string }, _res: Response, next: NextFunction) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8')
      try { req.body = JSON.parse(req.rawBody) as Record<string, unknown> } catch { req.body = {} }
    }
    next()
  },
  vapiWebhookRoute
)

// Stripe webhook — raw body required for signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json', limit: '2mb' }), stripeWebhookRoute)

// ── JSON body for everything else ─────────────────────────────────────────────
app.use(express.json())

app.use('/api/widget-config', widgetConfigRoute)
app.use('/api/voice-preview', voicePreviewRoute)
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`))
createWsServer(WS_PORT)