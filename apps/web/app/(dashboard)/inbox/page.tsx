'use client'

import { UnifiedInbox } from '@/components/inbox/UnifiedInbox'
import { useHasOrgPermission } from '@/components/org/OrgContext'
import { Card, CardContent } from '@workspace/ui/components/card'

export default function InboxPage() {
  const canAccessInbox = useHasOrgPermission('inbox')

  if (!canAccessInbox) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to access inbox conversations in this organization.
          </CardContent>
        </Card>
      </div>
    )
  }

  return <UnifiedInbox />
}
