'use client'

/**
 * apps/web/components/app-sidebar.tsx
 * Dashboard sidebar navigation with permission-aware route groups.
 */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@workspace/ui/components/sidebar'
import {
  BarChart2Icon,
  BookOpenIcon,
  Building2Icon,
  ChevronRightIcon,
  CodeIcon,
  CreditCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  Link2Icon,
  MailIcon,
  MessageCircleIcon,
  MicIcon,
  PhoneCallIcon,
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
  children?: NavItem[]
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
      {
        label: 'Channels',
        href: '/settings/channels',
        icon: MessageCircleIcon,
        permission: 'channels',
        activePrefixes: ['/settings/channels', '/email-settings'],
        children: [
          { label: 'Email', href: '/email-settings', icon: MailIcon, permission: 'channels' },
          {
            label: 'WhatsApp',
            href: '/settings/channels/whatsapp',
            icon: MessageCircleIcon,
            permission: 'channels',
          },
        ],
      },
      { label: 'Contacts', href: '/contacts', icon: UsersIcon, permission: 'contacts' },
      { label: 'Calls', href: '/calls', icon: PhoneCallIcon, permission: 'calls' },
    ],
  },
  {
    label: 'AI Studio',
    items: [
      { label: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon, permission: 'knowledge' },
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
  const { state: sidebarState } = useSidebar()
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

  const canSeeItem = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return false
    if (!item.permission) return true
    return isAdmin || activeOrg.permissions[item.permission] === true
  }

  const renderNavItem = (item: NavItem) => {
    const visibleChildren = item.children?.filter(canSeeItem) ?? []
    const hasChildren = visibleChildren.length > 0

    if (hasChildren) {
      if (sidebarState === 'collapsed') {
        return (
          <SidebarMenuItem key={item.href}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  type="button"
                  isActive={isItemActive(item)}
                  className="h-9 gap-3 rounded-lg px-3 font-medium"
                  aria-label={item.label}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate text-[13px]">{item.label}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-44">
                {visibleChildren.map((child) => (
                  <DropdownMenuItem key={child.href} asChild className="gap-2 text-xs">
                    <Link href={child.href}>
                      <child.icon className="size-3.5 shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        )
      }

      return (
        <Collapsible
          key={item.href}
          asChild
          defaultOpen={isItemActive(item)}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={isItemActive(item)}
                tooltip={item.label}
                className="h-9 gap-3 rounded-lg px-3 font-medium"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-[13px]">{item.label}</span>
                <ChevronRightIcon className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="my-1 gap-0.5">
                {visibleChildren.map((child) => (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isItemActive(child)}
                      className="h-7 text-[12px]"
                    >
                      <Link href={child.href}>
                        <child.icon className="size-3.5 shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      )
    }

    return (
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
    )
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-2 py-2">
        <OrgSwitcher initialOrg={activeOrg} />
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canSeeItem(item))
          if (visibleItems.length === 0) return null
          return (
            <SidebarGroup key={group.label} className="py-2">
              <SidebarGroupLabel className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map(renderNavItem)}
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

