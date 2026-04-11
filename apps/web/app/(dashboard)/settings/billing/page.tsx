/**
 * apps/web/app/(dashboard)/settings/billing/page.tsx
 */

import { redirect } from 'next/navigation'

export default function BillingSettingsRedirectPage() {
  redirect('/billing')
}