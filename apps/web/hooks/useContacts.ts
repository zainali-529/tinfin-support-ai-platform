'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'

interface UseContactsOptions {
  search?: string
  limit?: number
}

interface ContactRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  createdAt: string
  conversationCount: number
  lastConversationAt: string | null
  channel: string | null
  callCount: number
}

export function useContacts(options?: UseContactsOptions) {
  const search = options?.search?.trim() ?? ''
  const limit = options?.limit ?? 20

  const [page, setPage] = useState(1)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const query = trpc.contacts.getContacts.useQuery(
    { search: search || undefined, page, limit },
    { staleTime: 30_000 }
  )

  useEffect(() => {
    setPage(1)
    setContacts([])
    setTotalCount(0)
  }, [search, limit])

  useEffect(() => {
    const payload = query.data
    if (!payload) return
    if (payload.page !== page) return

    const pageItems = (payload.contacts ?? []) as ContactRow[]
    setTotalCount(payload.totalCount ?? 0)

    setContacts((previous) => {
      if (page <= 1) {
        return pageItems
      }

      const seen = new Set(previous.map((row) => row.id))
      const appended = pageItems.filter((row) => !seen.has(row.id))
      return [...previous, ...appended]
    })
  }, [page, query.data])

  const hasMore = useMemo(() => {
    if (!query.data) return false
    return query.data.hasMore
  }, [query.data])

  const isLoadingInitial = query.isLoading && page === 1 && contacts.length === 0
  const isFetchingMore = query.isFetching && page > 1

  const loadMore = useCallback(() => {
    if (isLoadingInitial || isFetchingMore || !hasMore) return
    setPage((current) => current + 1)
  }, [hasMore, isFetchingMore, isLoadingInitial])

  const refetch = useCallback(async () => {
    if (page === 1) {
      await query.refetch()
      return
    }
    setPage(1)
  }, [page, query.refetch])

  return {
    contacts,
    totalCount,
    isLoading: isLoadingInitial,
    isFetchingMore,
    hasMore,
    loadMore,
    refetch,
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
