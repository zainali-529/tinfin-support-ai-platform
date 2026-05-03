'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'

export type DashboardPeriod = 'today' | '7d' | '30d'

export interface DashboardOverview {
  period: DashboardPeriod
  summary: {
    openConversations: number
    pendingConversations: number
    totalContacts: number
    newContactsInPeriod: number
    resolvedInPeriod: number
    aiHandledRate: number
    aiMessagesInPeriod: number
    agentMessagesInPeriod: number
    resolutionRate: number
    unassignedConversations: number
    assignedConversations: number
    botConversations: number
    slaAtRiskConversations: number
    slaBreachedConversations: number
    activeCalls: number
    callsInPeriod: number
    knowledgeBaseCount: number
    activeAiActions: number
    aiActionExecutionsInPeriod: number
    aiActionSuccessRate: number
  }
  queue: {
    totalActive: number
    bot: number
    pending: number
    open: number
    unassigned: number
    assigned: number
    slaAtRisk: number
    slaBreached: number
  }
  channels: {
    chat: number
    email: number
    whatsapp: number
    voice: number
  }
  trends: {
    newContactsChangePct: number | null
    resolvedChangePct: number | null
    aiHandledRateChangePct: number | null
  }
  updatedAt: string
}

export interface DashboardConversationItem {
  id: string
  channel: string
  status: string
  startedAt: string
  contactName: string
  contactValue: string | null
  previewText: string
  isUnassigned: boolean
  href: string
}

export interface DashboardActivityItem {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  href?: string
}

export interface DashboardOnboardingStep {
  key: string
  title: string
  description: string
  href: string
  completed: boolean
  locked: boolean
}

export interface DashboardOnboarding {
  planId: string
  completionPercent: number
  totalSteps: number
  completedSteps: number
  nextStep: DashboardOnboardingStep | null
  steps: DashboardOnboardingStep[]
  channels: {
    emailConnected: boolean
    whatsappConnected: boolean
  }
  hasAnyConversation: boolean
  handledConversation: boolean
}

const EMPTY_OVERVIEW: DashboardOverview = {
  period: '7d',
  summary: {
    openConversations: 0,
    pendingConversations: 0,
    totalContacts: 0,
    newContactsInPeriod: 0,
    resolvedInPeriod: 0,
    aiHandledRate: 0,
    aiMessagesInPeriod: 0,
    agentMessagesInPeriod: 0,
    resolutionRate: 0,
    unassignedConversations: 0,
    assignedConversations: 0,
    botConversations: 0,
    slaAtRiskConversations: 0,
    slaBreachedConversations: 0,
    activeCalls: 0,
    callsInPeriod: 0,
    knowledgeBaseCount: 0,
    activeAiActions: 0,
    aiActionExecutionsInPeriod: 0,
    aiActionSuccessRate: 0,
  },
  queue: {
    totalActive: 0,
    bot: 0,
    pending: 0,
    open: 0,
    unassigned: 0,
    assigned: 0,
    slaAtRisk: 0,
    slaBreached: 0,
  },
  channels: {
    chat: 0,
    email: 0,
    whatsapp: 0,
    voice: 0,
  },
  trends: {
    newContactsChangePct: null,
    resolvedChangePct: null,
    aiHandledRateChangePct: null,
  },
  updatedAt: '',
}

const EMPTY_ONBOARDING: DashboardOnboarding = {
  planId: 'free',
  completionPercent: 0,
  totalSteps: 0,
  completedSteps: 0,
  nextStep: null,
  steps: [],
  channels: {
    emailConnected: false,
    whatsappConnected: false,
  },
  hasAnyConversation: false,
  handledConversation: false,
}

export function useDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('7d')

  const commonOpts = {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  }

  const overviewQuery = trpc.dashboard.getHomeOverview.useQuery(
    { period },
    commonOpts
  )
  const recentConversationsQuery = trpc.dashboard.getRecentConversations.useQuery(
    { limit: 6 },
    { staleTime: 30_000, refetchOnWindowFocus: false }
  )
  const activityFeedQuery = trpc.dashboard.getActivityFeed.useQuery(
    { limit: 12 },
    { staleTime: 30_000, refetchOnWindowFocus: false }
  )
  const onboardingQuery = trpc.dashboard.getOnboardingStatus.useQuery(
    undefined,
    commonOpts
  )

  const isLoading =
    overviewQuery.isLoading ||
    recentConversationsQuery.isLoading ||
    activityFeedQuery.isLoading ||
    onboardingQuery.isLoading

  const isFetching =
    overviewQuery.isFetching ||
    recentConversationsQuery.isFetching ||
    activityFeedQuery.isFetching ||
    onboardingQuery.isFetching

  const errorMessage = useMemo(() => {
    return (
      overviewQuery.error?.message ||
      recentConversationsQuery.error?.message ||
      activityFeedQuery.error?.message ||
      onboardingQuery.error?.message ||
      null
    )
  }, [
    activityFeedQuery.error?.message,
    onboardingQuery.error?.message,
    overviewQuery.error?.message,
    recentConversationsQuery.error?.message,
  ])

  function refetchAll() {
    void overviewQuery.refetch()
    void recentConversationsQuery.refetch()
    void activityFeedQuery.refetch()
    void onboardingQuery.refetch()
  }

  return {
    period,
    setPeriod,
    overview: (overviewQuery.data ?? EMPTY_OVERVIEW) as DashboardOverview,
    recentConversations:
      (recentConversationsQuery.data ?? []) as DashboardConversationItem[],
    activityFeed: (activityFeedQuery.data ?? []) as DashboardActivityItem[],
    onboarding: (onboardingQuery.data ?? EMPTY_ONBOARDING) as DashboardOnboarding,
    isLoading,
    isFetching,
    errorMessage,
    refetchAll,
  }
}
