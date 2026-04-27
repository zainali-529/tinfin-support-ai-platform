/**
 * BUG FIX: Previously read `users.org_id` (original primary org).
 * After an org switch, this passed the OLD org ID to KnowledgeBasePage,
 * which then sent it to tRPC. But ctx.userOrgId in the tRPC middleware was
 * already resolved to the NEW active org → requireOrgAccess threw 403.
 *
 * FIX: Read `active_org_id ?? org_id` so we always pass the correct active org.
 */

import { KnowledgeBasePage } from '@/components/knowledge/KnowledgeBasePage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function KnowledgePage() {
  const access = await requireServerOrgPermission('knowledge')

  return <KnowledgeBasePage orgId={access.activeOrgId} />
}
