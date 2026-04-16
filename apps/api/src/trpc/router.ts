import { router } from './trpc'
import { healthRouter } from '../routers/health.router'
import { chatRouter } from '../routers/chat.router'
import { knowledgeRouter } from '../routers/knowledge.router'
import { orgRouter } from '../routers/org.router'
import { ingestRouter } from '../routers/ingest.router'
import { orgMembershipRouter } from '../routers/org-membership.router'
import { vapiRouter } from '../routers/vapi.router'
import { teamRouter } from '../routers/team.router'
import { billingRouter } from '../routers/billing.router'
import { usageRouter } from '../routers/usage.router'
import { analyticsRouter } from '../routers/analytics.router'
import { emailRouter } from '../routers/email.router'

export const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
  knowledge: knowledgeRouter,
  org: orgRouter,
  ingest: ingestRouter,
  orgMembership: orgMembershipRouter,
  vapi: vapiRouter,
  team: teamRouter,
  billing: billingRouter,
  usage: usageRouter,
  analytics: analyticsRouter,
  email: emailRouter,
})

export type AppRouter = typeof appRouter;