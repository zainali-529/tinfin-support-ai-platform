import { TRPCError } from '@trpc/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getEffectiveTeamPermissions,
  hasTeamPermission,
  type OrgRole,
  type TeamPermissionKey,
  type TeamPermissions,
} from '@workspace/types'

type AnySupabase = SupabaseClient<any, 'public', any>

export interface OrgMembershipAccess {
  role: OrgRole
  permissions: TeamPermissions
  isOwner: boolean
}

interface PermissionContextLike {
  userRole: string
  userPermissions: TeamPermissions
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const message = (error?.message ?? '').toLowerCase()
  return message.includes('column') && message.includes(column.toLowerCase())
}

export function toOrgRole(value: unknown): OrgRole {
  return value === 'admin' ? 'admin' : 'agent'
}

export function resolveMembershipAccess(
  roleValue: unknown,
  rawPermissions: unknown,
  isOwnerValue: unknown = false
): OrgMembershipAccess {
  const role = toOrgRole(roleValue)
  return {
    role,
    permissions: getEffectiveTeamPermissions(role, rawPermissions),
    isOwner: isOwnerValue === true,
  }
}

export async function getOrgMembershipAccess(
  supabase: AnySupabase,
  userId: string,
  orgId: string
): Promise<OrgMembershipAccess | null> {
  const withPermissions = await supabase
    .from('user_organizations')
    .select('role, permissions, is_owner')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!withPermissions.error) {
    if (!withPermissions.data) return null
    return resolveMembershipAccess(
      withPermissions.data.role,
      (withPermissions.data as { permissions?: unknown }).permissions ?? null,
      (withPermissions.data as { is_owner?: unknown }).is_owner ?? false
    )
  }

  if (isMissingColumnError(withPermissions.error, 'permissions')) {
    const fallback = await supabase
      .from('user_organizations')
      .select('role, is_owner')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (fallback.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to verify membership: ${fallback.error.message}`,
      })
    }
    if (!fallback.data) return null

    return resolveMembershipAccess(
      fallback.data.role,
      null,
      (fallback.data as { is_owner?: unknown }).is_owner ?? false
    )
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Failed to verify membership: ${withPermissions.error.message}`,
  })
}

export async function assertOrgAdmin(
  supabase: AnySupabase,
  userId: string,
  orgId: string,
  message = 'Admin access required.'
): Promise<OrgMembershipAccess> {
  const membership = await getOrgMembershipAccess(supabase, userId, orgId)
  if (!membership || membership.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message })
  }
  return membership
}

export function requirePermissionFromContext(
  ctx: PermissionContextLike,
  key: TeamPermissionKey,
  message = 'You do not have access to this module.'
): void {
  const role = toOrgRole(ctx.userRole)
  if (hasTeamPermission(role, ctx.userPermissions, key)) return
  throw new TRPCError({ code: 'FORBIDDEN', message })
}

export function requireAdminFromContext(
  ctx: PermissionContextLike,
  message = 'Admin access required.'
): void {
  if (toOrgRole(ctx.userRole) === 'admin') return
  throw new TRPCError({ code: 'FORBIDDEN', message })
}

