'use client'

/**
 * OrgContext — single source of truth for the active organization on the client side.
 *
 * The layout server component resolves `active_org_id` and the user's role
 * from the DB and passes them to <OrgProvider>. Every client component reads
 * from here instead of querying Supabase directly.
 *
 * After an org switch:
 *   1. switchOrg mutation updates users.active_org_id in the DB
 *   2. utils.invalidate() clears all React Query / tRPC caches
 *   3. router.refresh() causes Next.js to re-render server components
 *   4. layout.tsx re-reads active_org_id → passes new org to OrgProvider
 *   5. All consumers of useActiveOrg() automatically get the new org + role
 */

import * as React from 'react'
import type { TeamPermissionKey, TeamPermissions } from '@workspace/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveOrg {
  id: string
  name: string
  plan: string
  /** The current user's role in this organization */
  role: 'admin' | 'agent'
  /** Effective module permissions for the current user in this org */
  permissions: TeamPermissions
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OrgContext = React.createContext<ActiveOrg | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface OrgProviderProps {
  org: ActiveOrg
  children: React.ReactNode
}

export function OrgProvider({ org, children }: OrgProviderProps) {
  return (
    <OrgContext.Provider value={org}>
      {children}
    </OrgContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useActiveOrg(): ActiveOrg {
  const ctx = React.useContext(OrgContext)
  if (!ctx) {
    throw new Error('useActiveOrg must be used inside <OrgProvider>.')
  }
  return ctx
}

export function useActiveOrgId(): string {
  return useActiveOrg().id
}

/** Returns true if the current user is an admin in the active org. */
export function useIsAdmin(): boolean {
  return useActiveOrg().role === 'admin'
}

export function useHasOrgPermission(permission: TeamPermissionKey): boolean {
  const org = useActiveOrg()
  if (org.role === 'admin') return true
  return org.permissions[permission] === true
}
