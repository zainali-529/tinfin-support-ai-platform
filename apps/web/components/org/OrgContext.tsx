'use client'

/**
 * OrgContext — single source of truth for the active organization on the client side.
 *
 * The layout server component resolves `active_org_id` from the DB and passes it
 * to <OrgProvider>. Every client component reads from here instead of querying
 * Supabase directly, which was causing stale-org bugs after switching.
 *
 * After an org switch:
 *   1. switchOrg mutation updates users.active_org_id in the DB
 *   2. utils.invalidate() clears all React Query / tRPC caches
 *   3. router.refresh() causes Next.js to re-render server components
 *   4. layout.tsx re-reads active_org_id → passes new org to OrgProvider
 *   5. All consumers of useActiveOrg() automatically get the new org
 */

import * as React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveOrg {
  id: string
  name: string
  plan: string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OrgContext = React.createContext<ActiveOrg | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface OrgProviderProps {
  org: ActiveOrg
  children: React.ReactNode
}

/**
 * Wrap your dashboard layout with this provider.
 * Receives the server-resolved active org and makes it available to all
 * client components without any additional DB queries.
 */
export function OrgProvider({ org, children }: OrgProviderProps) {
  return (
    <OrgContext.Provider value={org}>
      {children}
    </OrgContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the currently active organization.
 * Must be used inside <OrgProvider>.
 *
 * @example
 * const { id: orgId, name, plan } = useActiveOrg()
 */
export function useActiveOrg(): ActiveOrg {
  const ctx = React.useContext(OrgContext)
  if (!ctx) {
    throw new Error('useActiveOrg must be used inside <OrgProvider>.')
  }
  return ctx
}

/**
 * Returns the active orgId string directly — convenience shorthand.
 *
 * @example
 * const orgId = useActiveOrgId()
 * trpc.chat.getConversations.useQuery({ orgId })
 */
export function useActiveOrgId(): string {
  return useActiveOrg().id
}