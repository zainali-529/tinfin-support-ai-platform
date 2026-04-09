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

const app = express()
const PORT = Number(process.env.PORT || 3001)
const WS_PORT = Number(process.env.WS_PORT || 3003)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// Dashboard/web app CORS (credentialed)
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }))

// ── Raw body capture for Vapi webhook signature verification ──────────────────
// MUST come before express.json() so we get the raw bytes.
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

app.use(express.json())

// Public widget config — wildcard CORS, no credentials
app.use('/api/widget-config', widgetConfigRoute)

// Voice preview — authenticated, generates TTS audio
app.use('/api/voice-preview', voicePreviewRoute)

// tRPC — all dashboard/web queries and mutations
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`))
createWsServer(WS_PORT)