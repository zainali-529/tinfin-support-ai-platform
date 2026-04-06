'use client'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@workspace/ui/components/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  UserIcon,
  SettingsIcon,
} from 'lucide-react'

interface UserMenuProps {
  email: string
  initials: string
}

export function UserMenu({ email, initials }: UserMenuProps) {
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
                <Avatar className="size-7 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg text-xs font-semibold bg-primary/15 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-medium text-sm">{email}</span>
                  <span className="truncate text-[11px] text-muted-foreground">Agent</span>
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
                    <AvatarFallback className="rounded-xl text-sm font-semibold bg-primary/15 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{email}</span>
                    <span className="truncate text-xs text-muted-foreground">Agent</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <UserIcon className="size-4 opacity-60" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <SettingsIcon className="size-4 opacity-60" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <LogOutIcon className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}