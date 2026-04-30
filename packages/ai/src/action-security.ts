import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { isIP } from 'node:net'

const ENCRYPTED_SECRET_PREFIX = 'enc:v1'
const ENCRYPTION_KEY_ENV_NAMES = [
  'ACTION_SECRET_ENCRYPTION_KEY',
  'AI_ACTION_SECRET_ENCRYPTION_KEY',
  'ENCRYPTION_KEY',
]
const OUTBOUND_ALLOWLIST_ENV_NAMES = [
  'AI_ACTION_OUTBOUND_ALLOWLIST',
  'ACTION_OUTBOUND_ALLOWLIST',
]

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function getEncryptionSeed(): string | null {
  for (const key of ENCRYPTION_KEY_ENV_NAMES) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return null
}

function getEncryptionKey(): Buffer {
  const seed = getEncryptionSeed()
  if (!seed) {
    throw new Error(
      `Missing action secret encryption key. Set one of: ${ENCRYPTION_KEY_ENV_NAMES.join(
        ', '
      )}.`
    )
  }

  return createHash('sha256').update(seed).digest()
}

function normalizeHostLike(input: string): string | null {
  let value = input.trim().toLowerCase()
  if (!value) return null

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      value = new URL(value).hostname
    } catch {
      return null
    }
  } else {
    const slash = value.indexOf('/')
    if (slash >= 0) {
      value = value.slice(0, slash)
    }

    const at = value.lastIndexOf('@')
    if (at >= 0) {
      value = value.slice(at + 1)
    }

    if (!value.startsWith('*.')) {
      const colon = value.lastIndexOf(':')
      if (colon > 0 && value.indexOf(':') === colon) {
        value = value.slice(0, colon)
      }
    }
  }

  value = value.replace(/\.+$/, '')
  if (!value) return null

  if (value.startsWith('*.')) {
    const suffix = value.slice(2).replace(/\.+$/, '')
    return suffix ? `*.${suffix}` : null
  }

  return value
}

function parseAllowlistFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    const entries = value
      .flatMap((item) =>
        typeof item === 'string' ? item.split(/[,\s]+/g) : []
      )
      .map((item) => normalizeHostLike(item))
      .filter((item): item is string => Boolean(item))

    return Array.from(new Set(entries))
  }

  if (typeof value === 'string') {
    const entries = value
      .split(/[,\s]+/g)
      .map((item) => normalizeHostLike(item))
      .filter((item): item is string => Boolean(item))

    return Array.from(new Set(entries))
  }

  return []
}

function getGlobalAllowlistFromEnv(): string[] {
  const values: string[] = []

  for (const key of OUTBOUND_ALLOWLIST_ENV_NAMES) {
    const raw = process.env[key]
    if (!raw) continue
    values.push(...parseAllowlistFromUnknown(raw))
  }

  return Array.from(new Set(values))
}

function getOrgAllowlistFromSettings(settings: unknown): string[] {
  const source = asRecord(settings)
  const security = asRecord(source.security)

  const entries = [
    ...parseAllowlistFromUnknown(source.aiActionOutboundAllowlist),
    ...parseAllowlistFromUnknown(source.ai_action_outbound_allowlist),
    ...parseAllowlistFromUnknown(security.aiActionOutboundAllowlist),
    ...parseAllowlistFromUnknown(security.ai_action_outbound_allowlist),
  ]

  return Array.from(new Set(entries))
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false

  const a = parts[0] ?? -1
  const b = parts[1] ?? -1

  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase().split('%')[0] ?? ''

  if (normalized === '::1' || normalized === '::') return true

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true
  }

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    if (isPrivateIpv4(mapped)) return true
  }

  return false
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '')
  if (!host) return true

  if (host === 'localhost' || host.endsWith('.localhost')) return true

  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIpv4(host)
  if (ipVersion === 6) return isPrivateIpv6(host)

  return false
}

function matchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/\.+$/, '')

  return allowlist.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2)
      return (
        normalizedHost === suffix ||
        normalizedHost.endsWith(`.${suffix}`)
      )
    }

    return normalizedHost === pattern
  })
}

export function resolveActionOutboundAllowlist(orgSettings: unknown): string[] {
  const globalAllowlist = getGlobalAllowlistFromEnv()
  const orgAllowlist = getOrgAllowlistFromSettings(orgSettings)
  return Array.from(new Set([...globalAllowlist, ...orgAllowlist]))
}

export function assertActionOutboundUrlAllowed(
  urlValue: string,
  allowlist: string[]
): void {
  let parsed: URL

  try {
    parsed = new URL(urlValue)
  } catch {
    throw new Error('Invalid action URL.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URL templates are allowed.')
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credentials in action URL are not allowed.')
  }

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '')
  if (!host) {
    throw new Error('Action URL hostname is required.')
  }

  const allowlisted = matchesAllowlist(host, allowlist)
  if (allowlisted) return

  if (isLocalOrPrivateHost(host)) {
    throw new Error(
      `Blocked outbound target host "${host}". Local/private hosts require explicit allowlist entry.`
    )
  }

  if (allowlist.length > 0) {
    throw new Error(
      `Host "${host}" is not in outbound allowlist. Allowed: ${allowlist.join(', ')}`
    )
  }
}

export function validateActionUrlTemplate(
  urlTemplate: string,
  allowlist: string[]
): void {
  const originMatch = urlTemplate.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/]+)/)
  const authority = originMatch?.[1] ?? null

  if (!authority) {
    throw new Error('Invalid URL template.')
  }

  if (authority.includes('{') || authority.includes('}')) {
    throw new Error('URL template host cannot contain placeholders.')
  }

  const rendered = urlTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, 'example')
  assertActionOutboundUrlAllowed(rendered, allowlist)
}

export function encryptActionSecret(secretValue: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(secretValue, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    ENCRYPTED_SECRET_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function decryptActionSecret(storedValue: string): string {
  if (!storedValue.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`)) {
    return storedValue
  }

  const key = getEncryptionKey()
  const parts = storedValue.split(':')
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted action secret format.')
  }

  const version = parts[1] ?? ''
  const ivRaw = parts[2] ?? ''
  const authTagRaw = parts[3] ?? ''
  const ciphertextRaw = parts[4] ?? ''
  if (version !== 'v1') {
    throw new Error(`Unsupported encrypted action secret version "${version}".`)
  }

  const iv = Buffer.from(ivRaw, 'base64url')
  const authTag = Buffer.from(authTagRaw, 'base64url')
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
