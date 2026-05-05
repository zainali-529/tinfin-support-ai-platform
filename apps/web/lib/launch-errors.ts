'use client'

export type LaunchErrorKind =
  | 'auth'
  | 'billing'
  | 'channel'
  | 'configuration'
  | 'network'
  | 'permission'
  | 'provider'
  | 'realtime'
  | 'timeout'
  | 'unknown'

export interface LaunchErrorInfo {
  kind: LaunchErrorKind
  title: string
  message: string
  docsHref?: string
}

function readErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

export function normalizeLaunchError(error: unknown, fallback = 'Something went wrong. Please try again.'): LaunchErrorInfo {
  const rawMessage = readErrorMessage(error) || fallback
  const message = rawMessage.trim()
  const normalized = message.toLowerCase()

  if (normalized.includes('no organization') || normalized.includes('membership') || normalized.includes('org access')) {
    return {
      kind: 'permission',
      title: 'Organization access needs attention',
      message: 'We could not confirm access to this workspace. Switch organization, refresh, or ask an admin to invite you again.',
      docsHref: '/docs/getting-started/overview',
    }
  }

  if (normalized.includes('permission') || normalized.includes('forbidden') || normalized.includes('unauthorized')) {
    return {
      kind: 'permission',
      title: 'You do not have access to this area',
      message: 'Your current role does not include this permission. Ask an organization admin to update your team access.',
      docsHref: '/docs/admin/team-permissions',
    }
  }

  if (normalized.includes('plan') || normalized.includes('billing') || normalized.includes('subscription') || normalized.includes('upgrade')) {
    return {
      kind: 'billing',
      title: 'Plan or billing access is blocking this',
      message: 'Your current plan or billing status does not allow this action. Review your plan, usage, or payment status.',
      docsHref: '/docs/admin/billing-usage-addons',
    }
  }

  if (normalized.includes('vapi') || normalized.includes('voice')) {
    return {
      kind: 'provider',
      title: 'Voice provider could not complete the request',
      message: 'Voice setup needs a valid Vapi configuration and reachable webhook URL. Check the assistant settings, key, and webhook configuration.',
      docsHref: '/docs/channels/voice',
    }
  }

  if (normalized.includes('whatsapp') || normalized.includes('meta access token') || normalized.includes('access token')) {
    return {
      kind: 'channel',
      title: 'WhatsApp channel needs reconnection',
      message: 'The WhatsApp account may be disconnected, disabled, or using an expired Meta token. Reconnect the channel and run a test message.',
      docsHref: '/docs/channels/whatsapp',
    }
  }

  if (normalized.includes('email') || normalized.includes('resend') || normalized.includes('postmark') || normalized.includes('mailgun') || normalized.includes('webhook')) {
    return {
      kind: 'channel',
      title: 'Email channel setup needs attention',
      message: 'Check the outbound email key, inbound webhook, provider signature, and sender address before trying again.',
      docsHref: '/docs/channels/email',
    }
  }

  if (normalized.includes('openai') || normalized.includes('ai provider') || normalized.includes('api key') || normalized.includes('embedding')) {
    return {
      kind: 'configuration',
      title: 'AI provider configuration is missing or failing',
      message: 'The AI provider could not respond. Verify provider keys, model access, and retry the request.',
      docsHref: '/docs/ai/knowledge-base',
    }
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return {
      kind: 'timeout',
      title: 'Request timed out',
      message: 'The operation took too long. Retry once; if it repeats, reduce payload size or check the external provider.',
      docsHref: '/docs/troubleshooting/common-issues',
    }
  }

  if (
    normalized.includes('fetch failed') ||
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('load failed') ||
    normalized.includes('connection')
  ) {
    return {
      kind: 'network',
      title: 'Connection issue',
      message: 'We could not reach the API right now. Check your network, API URL, and server health, then retry.',
      docsHref: '/docs/troubleshooting/common-issues',
    }
  }

  return {
    kind: 'unknown',
    title: 'Something did not load correctly',
    message,
    docsHref: '/docs/troubleshooting/common-issues',
  }
}

export function launchToastMessage(error: unknown): string {
  const info = normalizeLaunchError(error)
  return info.message
}
