import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from '@workspace/ui/components/tooltip'
import { ThemeToggle } from '@/components/nav/ThemeToggle'
import { OrgProvider } from '@/components/org/OrgContext'
import { getEffectiveTeamPermissions } from '@workspace/types'

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes(column.toLowerCase())
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id, name, email')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/login')

  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  const { data: activeOrg } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('id', activeOrgId)
    .single()

  if (!activeOrg) redirect('/login')

  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('org_id', activeOrg.id)
    .maybeSingle()

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

  if (membershipResult.error || !membershipResult.data) {
    const { data: fallbackMembership } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!fallbackMembership?.org_id) {
      redirect('/login')
    }

    await supabase
      .from('users')
      .update({ active_org_id: fallbackMembership.org_id })
      .eq('id', user.id)

    redirect('/dashboard')
  }

  const userRole = (membershipResult.data?.role === 'admin' ? 'admin' : 'agent') as 'admin' | 'agent'
  const userPermissions = getEffectiveTeamPermissions(
    userRole,
    membershipResult.data?.permissions ?? null
  )

  const activeOrgWithRole = {
    id: activeOrg.id,
    name: activeOrg.name,
    plan: (activeSub?.plan as string | null) ?? activeOrg.plan,
    role: userRole,
    permissions: userPermissions,
  }

  const sidebarUser = {
    email: userRecord?.email ?? user.email ?? '',
    name: userRecord?.name ?? (user.user_metadata?.name as string | undefined) ?? null,
  }

  return (
    <TooltipProvider delayDuration={0}>
      <OrgProvider org={activeOrgWithRole}>
        <SidebarProvider>
          <AppSidebar user={sidebarUser} activeOrg={activeOrgWithRole} />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeOrg.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OrgProvider>
    </TooltipProvider>
  )
}

