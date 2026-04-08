'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Spinner } from '@workspace/ui/components/spinner'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@workspace/ui/components/sidebar'
import {
  ChevronsUpDownIcon,
  PlusIcon,
  BuildingIcon,
  CheckIcon,
  OctagonXIcon,
} from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgSwitcherProps {
  /** The org name + id passed from the server layout for the initial render */
  initialOrg: {
    id: string
    name: string
    plan: string
  }
}

// ─── Create Org Dialog ────────────────────────────────────────────────────────

function CreateOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')

  const createOrg = trpc.orgMembership.createOrg.useMutation({
    onSuccess: async () => {
      // Invalidate all cached queries so every component gets fresh org-scoped data
      await utils.invalidate()
      onOpenChange(false)
      setName('')
      setError('')
      router.refresh()
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    createOrg.mutate({ name: name.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 mb-1">
            <BuildingIcon className="size-4 text-primary" />
          </div>
          <DialogTitle className="text-base">New Organization</DialogTitle>
          <DialogDescription className="text-sm">
            Create a new workspace. You'll be switched to it automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </Label>
            <Input
              id="org-name"
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={createOrg.isPending}
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <OctagonXIcon className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createOrg.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createOrg.isPending || !name.trim()}
            >
              {createOrg.isPending && <Spinner className="mr-1.5 size-3.5" />}
              {createOrg.isPending ? 'Creating…' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── OrgSwitcher ─────────────────────────────────────────────────────────────

export function OrgSwitcher({ initialOrg }: OrgSwitcherProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  // Fetch all orgs the user belongs to
  const { data: orgs = [], isLoading } = trpc.orgMembership.getMyOrgs.useQuery(undefined, {
    staleTime: 30_000,
  })

  const switchOrg = trpc.orgMembership.switchOrg.useMutation({
    onSuccess: () => {
      router.refresh()
    },
  })

  // Active org is the one matching initialOrg.id (server-rendered), or the first in the list
  const activeOrg = orgs.find((o) => o.id === initialOrg.id) ?? initialOrg

  function handleSwitch(orgId: string) {
    if (orgId === activeOrg.id) return
    switchOrg.mutate({ orgId })
  }

  const planBadgeColor: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-primary/10 text-primary',
    scale: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                disabled={switchOrg.isPending}
              >
                {/* Org Avatar */}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                  {activeOrg.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Org Info */}
                <div className="grid flex-1 text-left leading-tight min-w-0">
                  <span className="truncate text-sm font-semibold">
                    {activeOrg.name}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground capitalize">
                    {switchOrg.isPending ? 'Switching…' : (activeOrg.plan ?? 'free')}
                  </span>
                </div>

                <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-xl"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={6}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1.5">
                Your Organizations
              </DropdownMenuLabel>

              {isLoading ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <Spinner className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading…</span>
                </div>
              ) : (
                orgs.map((org) => {
                  const isActive = org.id === activeOrg.id
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleSwitch(org.id)}
                      className={cn(
                        'gap-2.5 p-2 cursor-pointer',
                        isActive && 'bg-accent'
                      )}
                    >
                      {/* Mini avatar */}
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium leading-none">
                          {org.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                          {org.role} · {org.plan}
                        </p>
                      </div>

                      {isActive && (
                        <CheckIcon className="size-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  )
                })
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2.5 p-2 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setCreateDialogOpen(true)}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40">
                  <PlusIcon className="size-3.5" />
                </div>
                <span className="text-sm font-medium">New Organization</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  )
}