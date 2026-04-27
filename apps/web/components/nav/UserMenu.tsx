'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface UserMenuProps {
  email: string
  name?: string | null
  initials: string
  role: 'admin' | 'agent'
  orgName: string
}

export function UserMenu({ email, name, initials, role, orgName }: UserMenuProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const identityLabel = name?.trim() || email || 'Signed in user'
  const roleLabel = role === 'admin' ? 'Admin' : 'Agent'

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`)
      }
    } catch (error) {
      console.error('API logout failed, attempting direct sign out fallback.', error)
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

  return (
    <SidebarFooter className="border-t border-sidebar-border p-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-11"
              >
                <Avatar className="size-7 shrink-0 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/15 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate text-sm font-medium">{identityLabel}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {roleLabel} - {orgName}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-3.5 shrink-0 opacity-50" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
              side="top"
              align="end"
              sideOffset={6}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 px-2 py-2">
                  <Avatar className="size-9 rounded-xl">
                    <AvatarFallback className="rounded-xl bg-primary/15 text-sm font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{identityLabel}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer gap-2">
                <Link href="/settings">
                  <SettingsIcon className="size-4 opacity-60" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                disabled={isLoggingOut}
                onSelect={(event) => {
                  event.preventDefault()
                  void handleLogout()
                }}
              >
                <LogOutIcon className="size-4" />
                {isLoggingOut ? 'Logging out...' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}

