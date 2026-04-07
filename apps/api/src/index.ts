import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from './trpc/router'
import { createContext } from './trpc/context'
import { createWsServer } from './ws/wsServer'
import { widgetConfigRoute } from './routes/widget-config.route'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const WS_PORT = Number(process.env.WS_PORT || 3003)

app.use(helmet({
  // Allow widget scripts to be embedded cross-origin
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// Dashboard/web app cors (credentialed)
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json())

// Public widget config — must come before credentialed cors middleware takes effect on /trpc
// Its own CORS (wildcard, no credentials) is applied per-route in widgetConfigRoute
app.use('/api/widget-config', widgetConfigRoute)

app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`))
createWsServer(WS_PORT)