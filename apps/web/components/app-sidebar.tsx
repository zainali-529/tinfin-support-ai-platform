'use client'

/**
 * apps/web/components/app-sidebar.tsx
 * Dashboard sidebar navigation with permission-aware route groups.
 */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import {
  BarChart2Icon,
  BookOpenIcon,
  BrainCircuitIcon,
  Building2Icon,
  CodeIcon,
  CreditCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  Link2Icon,
  MessageSquareQuoteIcon,
  MicIcon,
  PhoneCallIcon,
  SearchCheckIcon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
  ZapIcon,
} from 'lucide-react'
import { UserMenu } from '@/components/nav/UserMenu'
import { OrgSwitcher } from '@/components/org/OrgSwitcher'
import { PlanBadge } from '@/components/billing/PlanGuard'
import { usePlan } from '@/hooks/usePlan'
import { createClient } from '@/lib/supabase'
import type { TeamPermissionKey } from '@workspace/types'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  activePrefixes?: string[]
  badge?: string
  adminOnly?: boolean
  permission?: TeamPermissionKey
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, exact: true, permission: 'dashboard' },
      { label: 'Inbox', href: '/inbox', icon: InboxIcon, permission: 'inbox' },
      { label: 'Contacts', href: '/contacts', icon: UsersIcon, permission: 'contacts' },
      { label: 'Calls', href: '/calls', icon: PhoneCallIcon, permission: 'calls' },
    ],
  },
  {
    label: 'AI Studio',
    items: [
      { label: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon, permission: 'knowledge' },
      { label: 'Quality Center', href: '/knowledge-quality', icon: SearchCheckIcon, permission: 'knowledge' },
      { label: 'AI Profile', href: '/ai-profile', icon: BrainCircuitIcon, permission: 'knowledge' },
      { label: 'Canned Replies', href: '/canned-responses', icon: MessageSquareQuoteIcon, permission: 'cannedResponses' },
      { label: 'Widget', href: '/widget', icon: CodeIcon, permission: 'widget' },
      { label: 'Embedding', href: '/embedding', icon: Link2Icon, permission: 'embedding' },
      { label: 'Voice Assistant', href: '/voice-assistant', icon: MicIcon, permission: 'voiceAssistant' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'AI Actions', href: '/ai-actions', icon: WorkflowIcon, adminOnly: true },
    ],
  },
  {
    label: 'Performance',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart2Icon, permission: 'analytics' },
      { label: 'Usage', href: '/usage', icon: ZapIcon },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Team', href: '/team', icon: UsersIcon, adminOnly: true },
      { label: 'Billing', href: '/billing', icon: CreditCardIcon, adminOnly: true },
      { label: 'Organizations', href: '/organizations', icon: Building2Icon },
      { label: 'Settings', href: '/settings', icon: SettingsIcon, activePrefixes: ['/settings'] },
    ],
  },
]

function useUnreadCount(orgId: string): number {
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!orgId) return

    const supabase = createClient()

    const fetchCount = async () => {
      const { count: unreadCount, error } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['bot', 'pending'])

      if (!error) setCount(unreadCount ?? 0)
    }

    void fetchCount()

    const channel = supabase
      .channel(`sidebar:unread:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void fetchCount()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId])

  return count
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: { email?: string | null; name?: string | null } | null
  activeOrg: {
    id: string
    name: string
    plan: string
    role: 'admin' | 'agent'
    permissions: Record<TeamPermissionKey, boolean>
  }
}

export function AppSidebar({ user, activeOrg, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const isAdmin = activeOrg.role === 'admin'
  const { planId } = usePlan()
  const unreadCount = useUnreadCount(activeOrg.id)

  const identityLabel = user?.name?.trim() || user?.email?.trim() || 'Tinfin User'
  const initials = identityLabel
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    const prefixes = item.activePrefixes ?? [item.href]
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-2 py-2">
        <OrgSwitcher initialOrg={activeOrg} />
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false
            if (!item.permission) return true
            return isAdmin || activeOrg.permissions[item.permission] === true
          })
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
                        isActive={isItemActive(item)}
                        tooltip={item.label}
                        className="h-9 gap-3 rounded-lg px-3 font-medium"
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4 shrink-0" />
                          <span className="flex-1 truncate text-[13px]">{item.label}</span>
                          {(item.badge || (item.href === '/inbox' && unreadCount > 0)) && (
                            <SidebarMenuBadge className="h-[18px] min-w-[18px] text-[10px] font-bold tabular-nums">
                              {item.badge ?? (unreadCount > 99 ? '99+' : unreadCount)}
                            </SidebarMenuBadge>
                          )}
                          {item.href === '/usage' && <PlanBadge planId={planId} size="xs" />}
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

      <UserMenu
        email={user?.email ?? ''}
        name={user?.name ?? null}
        initials={initials}
        role={activeOrg.role}
        orgName={activeOrg.name}
      />
      <SidebarRail />
    </Sidebar>
  )
}

