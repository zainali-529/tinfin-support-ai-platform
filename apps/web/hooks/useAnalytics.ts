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
  const contactGrowthQuery = trpc.analytics.getContactGrowth.useQuery(
    { period },
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    }
  )
  const callAnalyticsQuery = trpc.analytics.getCallAnalytics.useQuery(
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
    contactGrowth: contactGrowthQuery.data ?? [],
    callAnalytics: callAnalyticsQuery.data ?? [],
    isLoading: reportingQuery.isLoading || contactGrowthQuery.isLoading || callAnalyticsQuery.isLoading,
    isFetching: reportingQuery.isFetching || contactGrowthQuery.isFetching || callAnalyticsQuery.isFetching,
    isError: reportingQuery.isError || contactGrowthQuery.isError || callAnalyticsQuery.isError,
    error: reportingQuery.error ?? contactGrowthQuery.error ?? callAnalyticsQuery.error,
    refetchAll: () => {
      void reportingQuery.refetch()
      void contactGrowthQuery.refetch()
      void callAnalyticsQuery.refetch()
    },
  }
}
