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

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Fetch user record including active_org_id ───────────────────────────────
  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/login')

  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  // ── Fetch active org details ─────────────────────────────────────────────────
  const { data: activeOrg } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('id', activeOrgId)
    .single()

  if (!activeOrg) redirect('/login')

  // ── Fetch user's role in the active org ───────────────────────────────────
  const { data: membership } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', activeOrgId)
    .maybeSingle()

  const userRole = (membership?.role ?? 'agent') as 'admin' | 'agent'

  // Combine org + role into one object for the context
  const activeOrgWithRole = {
    id: activeOrg.id,
    name: activeOrg.name,
    plan: activeOrg.plan,
    role: userRole,
  }

  return (
    <TooltipProvider delayDuration={0}>
      <OrgProvider org={activeOrgWithRole}>
        <SidebarProvider>
          <AppSidebar user={user} activeOrg={activeOrgWithRole} />
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