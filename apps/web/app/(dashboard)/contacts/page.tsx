import { ContactsPage } from '@/components/contacts/ContactsPage'
import { requireServerOrgPermission } from '@/lib/server-org-access'

export default async function ContactsPageRoute() {
  await requireServerOrgPermission('contacts')

  return <ContactsPage />
}
