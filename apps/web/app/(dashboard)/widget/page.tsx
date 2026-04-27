/**
 * apps/web/app/(dashboard)/widget/page.tsx
 */
import { WidgetCustomizationPage } from '@/components/widget/WidgetCustomizationPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function WidgetPage() {
  const access = await requireServerOrgPermission('widget')

  return <WidgetCustomizationPage orgId={access.activeOrgId} />
}
