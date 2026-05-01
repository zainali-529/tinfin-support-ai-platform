'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

export type AnalyticsPeriod = '7d' | '30d' | '90d'

export function useAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

  const reportingQuery = trpc.analytics.getReportingDashboard.useQuery(
    { period },
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    }
  )

  return {
    period,
    setPeriod,
    report: reportingQuery.data,
    isLoading: reportingQuery.isLoading,
    isFetching: reportingQuery.isFetching,
    isError: reportingQuery.isError,
    error: reportingQuery.error,
    refetchAll: () => {
      void reportingQuery.refetch()
    },
  }
}
