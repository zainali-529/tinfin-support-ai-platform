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
  // IMPORTANT: select BOTH columns. active_org_id may be null for legacy accounts.
  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/login')

  // active_org_id = currently selected org.
  // Fall back to org_id for accounts created before multi-org was added.
  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  // ── Fetch active org details ─────────────────────────────────────────────────
  const { data: activeOrg } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('id', activeOrgId)
    .single()

  // Safety net — should never happen, but protects against corrupt state
  if (!activeOrg) redirect('/login')

  return (
    <TooltipProvider delayDuration={0}>
      {/*
        OrgProvider makes the resolved active org available to ALL client components
        via useActiveOrg() / useActiveOrgId() — no extra DB round-trips needed.
        When the user switches org, router.refresh() re-runs this layout, which
        picks up the new active_org_id and re-provides it here.
      */}
      <OrgProvider org={activeOrg}>
        <SidebarProvider>
          <AppSidebar user={user} activeOrg={activeOrg} />
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
                    {/* Shows active org name in breadcrumb — updates on switch */}
                    <BreadcrumbPage>{activeOrg.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OrgProvider>
    </TooltipProvider>
  )
}