import { KnowledgeQualityCenterPage } from '@/components/knowledge-quality/KnowledgeQualityCenterPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function KnowledgeQualityPage() {
  await requireServerOrgPermission('knowledge')

  return <KnowledgeQualityCenterPage />
}

