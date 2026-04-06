import { router } from './trpc'
import { healthRouter } from '../routers/health.router'
import { chatRouter } from '../routers/chat.router'
import { knowledgeRouter } from '../routers/knowledge.router'
import { orgRouter } from '../routers/org.router'
import { ingestRouter } from '../routers/ingest.router'

export const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
  knowledge: knowledgeRouter,
  org: orgRouter,
  ingest: ingestRouter,
})

export type AppRouter = typeof appRouter