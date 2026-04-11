'use client'

/**
 * apps/web/hooks/useAnalytics.ts
 *
 * Single hook that fetches all analytics data for the dashboard.
 * Uses tRPC with React Query for caching + background refresh.
 */

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

export type AnalyticsPeriod = '7d' | '30d' | '90d'

export function useAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

  const opts = { staleTime: 60_000, refetchOnWindowFocus: false }

  const overview         = trpc.analytics.getOverview.useQuery({ period }, opts)
  const convTrend        = trpc.analytics.getConversationTrend.useQuery({ period }, opts)
  const statusBreakdown  = trpc.analytics.getStatusBreakdown.useQuery({ period }, opts)
  const messageVolume    = trpc.analytics.getMessageVolume.useQuery({ period }, opts)
  const contactGrowth    = trpc.analytics.getContactGrowth.useQuery({ period }, opts)
  const resolutionTrend  = trpc.analytics.getResolutionTrend.useQuery({ period }, opts)
  const callAnalytics    = trpc.analytics.getCallAnalytics.useQuery({ period }, opts)
  const handlingBreakdown = trpc.analytics.getHandlingBreakdown.useQuery({ period }, opts)

  const isLoading = overview.isLoading || convTrend.isLoading

  function refetchAll() {
    overview.refetch()
    convTrend.refetch()
    statusBreakdown.refetch()
    messageVolume.refetch()
    contactGrowth.refetch()
    resolutionTrend.refetch()
    callAnalytics.refetch()
    handlingBreakdown.refetch()
  }

  return {
    period,
    setPeriod,
    overview: overview.data,
    convTrend: convTrend.data ?? [],
    statusBreakdown: statusBreakdown.data ?? [],
    messageVolume: messageVolume.data ?? [],
    contactGrowth: contactGrowth.data ?? [],
    resolutionTrend: resolutionTrend.data ?? [],
    callAnalytics: callAnalytics.data ?? [],
    handlingBreakdown: handlingBreakdown.data ?? [],
    isLoading,
    refetchAll,
  }
}