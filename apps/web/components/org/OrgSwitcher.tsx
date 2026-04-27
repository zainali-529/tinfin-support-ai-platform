'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Spinner } from '@workspace/ui/components/spinner'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar'
import {
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  LayoutGridIcon,
  OctagonXIcon,
  PlusIcon,
} from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'

interface OrgSwitcherProps {
  initialOrg: {
    id: string
    name: string
    plan: string
  }
}

type PlanId = 'free' | 'starter' | 'pro' | 'scale'

function PlanOptionCard(props: {
  id: PlanId
  name: string
  description: string
  price: number
  selected: boolean
  disabled?: boolean
  onSelect: (id: PlanId) => void
}) {
  const isPaid = props.price > 0
  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.id)}
      disabled={props.disabled}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition',
        props.selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30',
        props.disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{props.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{props.description}</p>
        </div>
        <Badge variant={isPaid ? 'default' : 'outline'} className="shrink-0">
          {isPaid ? `$${props.price}/mo` : 'Free'}
        </Badge>
      </div>
      {props.disabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Free is only available for your first owned organization.
        </p>
      )}
    </button>
  )
}

export function CreateOrgDialog({
  open,
  onOpenChange,
  ownedOrgsCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ownedOrgsCount: number
}) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [name, setName] = React.useState('')
  const [planId, setPlanId] = React.useState<PlanId>('starter')
  const [error, setError] = React.useState('')

  const { data: plans = [] } = trpc.billing.getPlans.useQuery(undefined, {
    staleTime: 60_000,
  })

  const firstOwnedOrg = ownedOrgsCount === 0
  const freeAllowed = firstOwnedOrg

  React.useEffect(() => {
    if (!open) return
    setName('')
    setError('')
    setPlanId(freeAllowed ? 'free' : 'starter')
  }, [open, freeAllowed])

  const createOrg = trpc.orgMembership.createOrg.useMutation({
    onSuccess: async (data) => {
      if (data.requiresCheckout && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      await utils.invalidate()
      onOpenChange(false)
      router.refresh()
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!freeAllowed && planId === 'free') {
      setError('Additional organizations require a paid plan.')
      return
    }

    setError('')
    createOrg.mutate({
      name: name.trim(),
      planId,
      successUrl: `${window.location.origin}/dashboard?orgCreated=true`,
      cancelUrl: `${window.location.origin}/dashboard?orgCreateCancelled=true`,
    })
  }

  const planOrder: PlanId[] = ['free', 'starter', 'pro', 'scale']
  const resolvedPlans = planOrder
    .map((id) => plans.find((plan) => plan.id === id))
    .filter(Boolean) as Array<{
    id: string
    name: string
    description: string
    price: number
  }>
  const displayPlans = resolvedPlans.length > 0
    ? resolvedPlans
    : [
      { id: 'free', name: 'Free', description: 'Get started with one free organization', price: 0 },
      { id: 'starter', name: 'Starter', description: 'For solo operators and early teams', price: 19 },
      { id: 'pro', name: 'Pro', description: 'For growing support teams', price: 29 },
      { id: 'scale', name: 'Scale', description: 'For larger support operations', price: 79 },
    ]

  const submitLabel = planId === 'free' ? 'Create Organization' : 'Continue to Payment'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <BuildingIcon className="size-4 text-primary" />
          </div>
          <DialogTitle className="text-base">Create Organization</DialogTitle>
          <DialogDescription className="text-sm">
            First owned organization can be Free. Every additional organization requires a paid plan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </Label>
            <Input
              id="org-name"
              placeholder="e.g. Acme Support"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={createOrg.isPending}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Select plan</Label>
            <div className="space-y-2">
              {displayPlans.map((plan) => (
                <PlanOptionCard
                  key={plan.id}
                  id={plan.id as PlanId}
                  name={plan.name}
                  description={plan.description}
                  price={plan.price}
                  selected={planId === plan.id}
                  disabled={plan.id === 'free' && !freeAllowed}
                  onSelect={(id) => {
                    if (id === 'free' && !freeAllowed) return
                    setPlanId(id)
                  }}
                />
              ))}
            </div>
          </div>

          {planId !== 'free' && (
            <Alert>
              <CreditCardIcon className="size-4" />
              <AlertDescription className="text-xs">
                You will be redirected to secure Stripe checkout. Organization is activated after successful payment.
              </AlertDescription>
            </Alert>
          )}

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
            <Button type="submit" size="sm" disabled={createOrg.isPending || !name.trim()}>
              {createOrg.isPending && <Spinner className="mr-1.5 size-3.5" />}
              {createOrg.isPending ? 'Processing...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function OrgSwitcher({ initialOrg }: OrgSwitcherProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  const { data: orgs = [], isLoading } = trpc.orgMembership.getMyOrgs.useQuery(undefined, {
    staleTime: 30_000,
  })

  const switchOrg = trpc.orgMembership.switchOrg.useMutation({
    onSuccess: () => {
      router.refresh()
    },
  })

  const activeOrg = orgs.find((o) => o.id === initialOrg.id) ?? initialOrg
  const ownedOrgsCount = orgs.filter((org) => org.isOwner).length
  const orderedOrgs = React.useMemo(() => {
    if (orgs.length === 0) return []
    const activeFirst = orgs.filter((org) => org.id === activeOrg.id)
    const rest = orgs.filter((org) => org.id !== activeOrg.id)
    return [...activeFirst, ...rest]
  }, [orgs, activeOrg.id])
  const quickOrgs = orderedOrgs.slice(0, 3)
  const hiddenOrgCount = Math.max(0, orderedOrgs.length - quickOrgs.length)

  function handleSwitch(orgId: string) {
    if (orgId === activeOrg.id) return
    switchOrg.mutate({ orgId })
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
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                  {activeOrg.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{activeOrg.name}</span>
                  <span className="truncate text-[11px] capitalize text-muted-foreground">
                    {switchOrg.isPending ? 'Switching...' : (activeOrg.plan ?? 'free')}
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
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Your Organizations
              </DropdownMenuLabel>

              {isLoading ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <Spinner className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : quickOrgs.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">No organizations found.</div>
              ) : (
                quickOrgs.map((org) => {
                  const isActive = org.id === activeOrg.id
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleSwitch(org.id)}
                      className={cn('cursor-pointer gap-2.5 p-2', isActive && 'bg-accent')}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-none">{org.name}</p>
                        <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                          {org.role} - {org.plan}
                        </p>
                      </div>

                      {isActive && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
                    </DropdownMenuItem>
                  )
                })
              )}

              {hiddenOrgCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="p-0">
                    <Link href="/organizations" className="flex w-full items-center gap-2.5 p-2 text-sm">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40">
                        <LayoutGridIcon className="size-3.5" />
                      </div>
                      <span className="flex-1 font-medium">View all organizations</span>
                      <Badge variant="outline" className="text-[10px]">
                        +{hiddenOrgCount}
                      </Badge>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className={cn('gap-2.5 p-2 text-muted-foreground hover:text-foreground cursor-pointer')}
                onClick={() => {
                  setCreateDialogOpen(true)
                }}
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
        ownedOrgsCount={ownedOrgsCount}
      />
    </>
  )
}
