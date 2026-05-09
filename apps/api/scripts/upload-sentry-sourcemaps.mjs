/* global console, process */

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const requiredEnv = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_RELEASE']
const missing = requiredEnv.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`[sentry] Missing required env: ${missing.join(', ')}`)
  process.exit(1)
}

const distDir = path.resolve(process.cwd(), 'dist')

if (!existsSync(distDir)) {
  console.error('[sentry] dist folder not found. Run pnpm --filter @workspace/api build first.')
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('pnpm', ['exec', 'sentry-cli', 'sourcemaps', 'inject', distDir])
run('pnpm', [
  'exec',
  'sentry-cli',
  'sourcemaps',
  'upload',
  distDir,
  '--org',
  process.env.SENTRY_ORG,
  '--project',
  process.env.SENTRY_PROJECT,
  '--release',
  process.env.SENTRY_RELEASE,
  '--dist',
  'api',
])
