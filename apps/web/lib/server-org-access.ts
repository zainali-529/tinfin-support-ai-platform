import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  getEffectiveTeamPermissions,
  type OrgRole,
  type TeamPermissionKey,
  type TeamPermissions,
} from '@workspace/types'

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes(column.toLowerCase())
}

function toRole(value: unknown): OrgRole {
  return value === 'admin' ? 'admin' : 'agent'
}

export interface ServerOrgAccess {
  userId: string
  activeOrgId: string
  role: OrgRole
  permissions: TeamPermissions
}

export async function getServerOrgAccess(): Promise<ServerOrgAccess> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!userRecord?.org_id) redirect('/dashboard')

  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  let membershipResult = await supabase
    .from('user_organizations')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if (membershipResult.error && isMissingColumnError(membershipResult.error, 'permissions')) {
    membershipResult = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgId)
      .maybeSingle()
  }

  if (membershipResult.error || !membershipResult.data) redirect('/dashboard')

  const role = toRole(membershipResult.data.role)
  const permissions = getEffectiveTeamPermissions(role, membershipResult.data.permissions ?? null)

  return {
    userId: user.id,
    activeOrgId,
    role,
    permissions,
  }
}

export async function requireServerOrgPermission(
  permission: TeamPermissionKey,
  redirectTo = '/dashboard'
): Promise<ServerOrgAccess> {
  const access = await getServerOrgAccess()
  if (access.role !== 'admin' && access.permissions[permission] !== true) {
    redirect(redirectTo)
  }
  return access
}

export async function requireServerOrgAdmin(redirectTo = '/dashboard'): Promise<ServerOrgAccess> {
  const access = await getServerOrgAccess()
  if (access.role !== 'admin') {
    redirect(redirectTo)
  }
  return access
}

