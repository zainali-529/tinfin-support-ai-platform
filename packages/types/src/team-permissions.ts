export type OrgRole = 'admin' | 'agent'

export const TEAM_PERMISSION_KEYS = [
  'dashboard',
  'inbox',
  'contacts',
  'calls',
  'knowledge',
  'analytics',
  'widget',
  'embedding',
  'voiceAssistant',
  'cannedResponses',
  'channels',
] as const

export type TeamPermissionKey = (typeof TEAM_PERMISSION_KEYS)[number]
export type TeamPermissions = Record<TeamPermissionKey, boolean>

export interface TeamPermissionMeta {
  key: TeamPermissionKey
  label: string
  description: string
  defaultAgent: boolean
}

export const TEAM_PERMISSION_META: TeamPermissionMeta[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'View home metrics and activity widgets.',
    defaultAgent: true,
  },
  {
    key: 'inbox',
    label: 'Inbox',
    description: 'Open conversations and send support replies.',
    defaultAgent: true,
  },
  {
    key: 'contacts',
    label: 'Contacts',
    description: 'View, edit, import, and manage contact records.',
    defaultAgent: true,
  },
  {
    key: 'calls',
    label: 'Calls',
    description: 'Access call logs and call analytics views.',
    defaultAgent: true,
  },
  {
    key: 'knowledge',
    label: 'Knowledge Base',
    description: 'Manage knowledge bases and ingestion sources.',
    defaultAgent: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'View advanced reporting and trends.',
    defaultAgent: false,
  },
  {
    key: 'widget',
    label: 'Widget',
    description: 'Edit widget appearance and behavior.',
    defaultAgent: false,
  },
  {
    key: 'embedding',
    label: 'Embedding',
    description: 'Access installation snippets and embed settings.',
    defaultAgent: false,
  },
  {
    key: 'voiceAssistant',
    label: 'Voice Assistant',
    description: 'Configure AI voice assistant settings.',
    defaultAgent: false,
  },
  {
    key: 'cannedResponses',
    label: 'Canned Replies',
    description: 'Create and manage reusable support replies.',
    defaultAgent: false,
  },
  {
    key: 'channels',
    label: 'Channels',
    description: 'Manage channel integrations like Email and WhatsApp.',
    defaultAgent: false,
  },
]

export const ALL_TEAM_PERMISSIONS: TeamPermissions = TEAM_PERMISSION_KEYS.reduce(
  (acc, key) => {
    acc[key] = true
    return acc
  },
  {} as TeamPermissions
)

export const DEFAULT_AGENT_TEAM_PERMISSIONS: TeamPermissions = TEAM_PERMISSION_META.reduce(
  (acc, entry) => {
    acc[entry.key] = entry.defaultAgent
    return acc
  },
  {} as TeamPermissions
)

function normalizeBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return null
}

export function normalizeTeamPermissions(
  raw: unknown
): Partial<TeamPermissions> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const source = raw as Record<string, unknown>
  const normalized: Partial<TeamPermissions> = {}
  for (const key of TEAM_PERMISSION_KEYS) {
    const value = normalizeBool(source[key])
    if (value !== null) normalized[key] = value
  }

  return normalized
}

export function getEffectiveTeamPermissions(
  role: OrgRole,
  raw: unknown
): TeamPermissions {
  if (role === 'admin') {
    return { ...ALL_TEAM_PERMISSIONS }
  }

  return {
    ...DEFAULT_AGENT_TEAM_PERMISSIONS,
    ...normalizeTeamPermissions(raw),
  }
}

export function hasTeamPermission(
  role: OrgRole,
  permissions: TeamPermissions,
  key: TeamPermissionKey
): boolean {
  if (role === 'admin') return true
  return permissions[key] === true
}

