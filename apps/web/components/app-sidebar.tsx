'use client'

/**
 * apps/web/components/app-sidebar.tsx  (Updated)
 *
 * Changes:
 * - Usage, Team, and Billing moved to their own business nav group
 * - Settings remains in Account for general settings only
 */

import * as React from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail, SidebarMenuBadge,
} from "@workspace/ui/components/sidebar"
import {
  LayoutDashboardIcon, InboxIcon, BookOpenIcon, BarChart2Icon,
  SettingsIcon, CodeIcon, PhoneCallIcon, UsersIcon, CreditCardIcon, ZapIcon, MicIcon, Link2Icon,
} from 'lucide-react'
import { UserMenu } from '@/components/nav/UserMenu'
import { OrgSwitcher } from '@/components/org/OrgSwitcher'
import { PlanBadge } from '@/components/billing/PlanGuard'
import { usePlan } from '@/hooks/usePlan'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  badge?: string
  adminOnly?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: 'Dashboard',  href: '/dashboard', icon: LayoutDashboardIcon, exact: true },
      { label: 'Inbox',      href: '/inbox',     icon: InboxIcon, badge: '3' },
      { label: 'Calls',      href: '/calls',     icon: PhoneCallIcon },
    ]
  },
  {
    label: "Management",
    items: [
      { label: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
      { label: 'Widget',         href: '/widget',    icon: CodeIcon, adminOnly: true },
      { label: 'Embedding',      href: '/embedding', icon: Link2Icon, adminOnly: true },
      { label: 'Voice Assistant', href: '/voice-assistant', icon: MicIcon, adminOnly: true },
      { label: 'Analytics',      href: '/analytics', icon: BarChart2Icon },
    ]
  },
  {
    label: "Business",
    items: [
      { label: 'Usage',    href: '/usage',   icon: ZapIcon },
      { label: 'Team',     href: '/team',    icon: UsersIcon,      adminOnly: true },
      { label: 'Billing',  href: '/billing', icon: CreditCardIcon, adminOnly: true },
    ]
  },
  {
    label: "Account",
    items: [
      { label: 'Settings', href: '/settings',           icon: SettingsIcon },
    ]
  }
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: { email?: string } | null
  activeOrg: { id: string; name: string; plan: string; role: 'admin' | 'agent' }
}

export function AppSidebar({ user, activeOrg, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const isAdmin = activeOrg.role === 'admin'
  const { planId } = usePlan()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'TF'

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-2 py-2">
        <OrgSwitcher initialOrg={activeOrg} />
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin)
          if (visibleItems.length === 0) return null
          return (
            <SidebarGroup key={group.label} className="py-2">
              <SidebarGroupLabel className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href, item.exact)}
                        tooltip={item.label}
                        className="h-9 gap-3 px-3 rounded-lg font-medium"
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4 shrink-0" />
                          <span className="flex-1 truncate text-[13px]">{item.label}</span>
                          {item.badge && (
                            <SidebarMenuBadge className="min-w-[18px] h-[18px] text-[10px] font-bold tabular-nums">
                              {item.badge}
                            </SidebarMenuBadge>
                          )}
                          {/* Show plan badge next to Usage item */}
                          {item.href === '/usage' && (
                            <PlanBadge planId={planId} size="xs" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <UserMenu email={user?.email ?? ''} initials={initials} />
      <SidebarRail />
    </Sidebar>
  )
}