'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Building2Icon, CheckCircle2Icon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useActiveOrg } from '@/components/org/OrgContext'
import { CreateOrgDialog } from '@/components/org/OrgSwitcher'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'

export default function OrganizationsPage() {
  const router = useRouter()
  const activeOrg = useActiveOrg()
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  const { data: orgs = [], isLoading } = trpc.orgMembership.getMyOrgs.useQuery(undefined, {
    staleTime: 30_000,
  })

  const switchOrg = trpc.orgMembership.switchOrg.useMutation({
    onSuccess: () => {
      router.refresh()
    },
  })

  const ownedOrgsCount = orgs.filter((org) => org.isOwner).length

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2Icon className="size-6 text-primary" />
            Organizations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch between workspaces and manage your organization access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="gap-1.5"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateDialogOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            New Organization
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No organizations available.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org) => {
            const isActive = org.id === activeOrg.id
            const initials = org.name.slice(0, 2).toUpperCase()

            return (
              <Card
                key={org.id}
                className={cn(
                  'transition-all',
                  isActive && 'border-primary ring-1 ring-primary/20 bg-primary/5'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{org.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Joined {formatDistanceToNow(new Date(org.joinedAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                    </div>
                    {isActive && (
                      <Badge className="gap-1 text-[10px]">
                        <CheckCircle2Icon className="size-3" />
                        Active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {org.plan}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {org.role}
                    </Badge>
                    {org.isOwner && (
                      <Badge variant="outline" className="text-[10px]">
                        Owner
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">/{org.slug}</p>
                    <Button
                      size="sm"
                      variant={isActive ? 'outline' : 'default'}
                      disabled={isActive || switchOrg.isPending}
                      onClick={() => switchOrg.mutate({ orgId: org.id })}
                    >
                      {isActive ? 'Current' : 'Switch'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        ownedOrgsCount={ownedOrgsCount}
      />
    </div>
  )
}
