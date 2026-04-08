'use client'

import { trpc } from '@/lib/trpc'

/**
 * Returns the full list of organizations the current user belongs to,
 * plus helpers for switching and creating orgs.
 *
 * All mutations invalidate the full tRPC cache and trigger a router.refresh()
 * so server components (layout, breadcrumbs, etc.) re-render with fresh data.
 */
export function useOrganizations() {
  const utils = trpc.useUtils()

  const {
    data: orgs = [],
    isLoading,
    error,
  } = trpc.orgMembership.getMyOrgs.useQuery(undefined, {
    staleTime: 30_000,
  })

  const {
    data: activeOrg,
    isLoading: activeOrgLoading,
  } = trpc.orgMembership.getActiveOrg.useQuery(undefined, {
    staleTime: 30_000,
  })

  const switchOrg = trpc.orgMembership.switchOrg.useMutation({
    onSuccess: () => utils.invalidate(),
  })

  const createOrg = trpc.orgMembership.createOrg.useMutation({
    onSuccess: () => utils.invalidate(),
  })

  const leaveOrg = trpc.orgMembership.leaveOrg.useMutation({
    onSuccess: () => utils.invalidate(),
  })

  return {
    orgs,
    activeOrg,
    isLoading: isLoading || activeOrgLoading,
    error,
    switchOrg,
    createOrg,
    leaveOrg,
  }
}