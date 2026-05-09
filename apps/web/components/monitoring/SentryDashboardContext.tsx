'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import type { ActiveOrg } from '@/components/org/OrgContext'

type SentryDashboardContextProps = {
  org: ActiveOrg
  user: {
    id: string
    email?: string | null
    name?: string | null
  }
}

export function SentryDashboardContext({ org, user }: SentryDashboardContextProps) {
  useEffect(() => {
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      username: user.name ?? undefined,
    })
    Sentry.setTag('org.id', org.id)
    Sentry.setTag('org.plan', org.plan)
    Sentry.setTag('org.role', org.role)
    Sentry.setContext('organization', {
      id: org.id,
      name: org.name,
      plan: org.plan,
      role: org.role,
      permissions: org.permissions,
    })
  }, [org.id, org.name, org.permissions, org.plan, org.role, user.email, user.id, user.name])

  return null
}
