import { WidgetEmbeddingPage } from '@/components/widget/WidgetEmbeddingPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function EmbeddingPage() {
  const access = await requireServerOrgPermission('embedding')

  return <WidgetEmbeddingPage orgId={access.activeOrgId} />
}
