import { router } from './trpc'
import { healthRouter } from '../routers/health.router'
import { chatRouter } from '../routers/chat.router'
import { knowledgeRouter } from '../routers/knowledge.router'
import { orgRouter } from '../routers/org.router'
import { ingestRouter } from '../routers/ingest.router'
import { orgMembershipRouter } from '../routers/org-membership.router'

export const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
  knowledge: knowledgeRouter,
  org: orgRouter,
  ingest: ingestRouter,
  orgMembership: orgMembershipRouter,
})

export type AppRouter = typeof appRouter