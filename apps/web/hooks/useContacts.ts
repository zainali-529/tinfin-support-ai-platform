'use client'

/**
 * apps/web/hooks/useContacts.ts
 *
 * tRPC hooks for the contacts management feature.
 */

import { trpc } from '@/lib/trpc'

export function useContacts(search?: string) {
  const { data, isLoading } = trpc.contacts.getContacts.useQuery(
    { search: search || undefined, page: 1, limit: 50 },
    { staleTime: 30_000 }
  )

  return {
    contacts: data?.contacts ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
  }
}

export function useContact(id: string | null) {
  const { data: contact, isLoading } = trpc.contacts.getContact.useQuery(
    { id: id ?? '' },
    { enabled: !!id, staleTime: 30_000 }
  )

  return { contact, isLoading }
}

export function useUpdateContact() {
  const utils = trpc.useUtils()

  return trpc.contacts.updateContact.useMutation({
    onSuccess: (_, variables) => {
      void utils.contacts.getContact.invalidate({ id: variables.id })
      void utils.contacts.getContacts.invalidate()
    },
  })
}

export function useDeleteContact() {
  const utils = trpc.useUtils()

  return trpc.contacts.deleteContact.useMutation({
    onSuccess: () => {
      void utils.contacts.getContacts.invalidate()
    },
  })
}

export function useCreateContact() {
  const utils = trpc.useUtils()

  return trpc.contacts.createContact.useMutation({
    onSuccess: () => {
      void utils.contacts.getContacts.invalidate()
    },
  })
}

export function useImportContacts() {
  const utils = trpc.useUtils()

  return trpc.contacts.importContacts.useMutation({
    onSuccess: () => {
      void utils.contacts.getContacts.invalidate()
    },
  })
}