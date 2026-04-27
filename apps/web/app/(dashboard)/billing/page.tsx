/**
 * apps/web/app/(dashboard)/billing/page.tsx
 */

import { BillingPage } from '@/components/settings/BillingPage'
import { requireServerOrgAdmin } from '@/lib/server-org-access'

export default async function BillingPageRoute() {
  await requireServerOrgAdmin()

  return <BillingPage />
}
