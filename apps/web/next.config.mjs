/* global process */

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { withSentryConfig } from '@sentry/nextjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
}

const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_APP_VERSION

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: process.env.SENTRY_DEBUG_BUILD !== 'true',
  debug: process.env.SENTRY_DEBUG_BUILD === 'true',
  tunnelRoute: process.env.SENTRY_TUNNEL_ROUTE || '/monitoring',
  sourcemaps: {
    disable: process.env.SENTRY_UPLOAD_SOURCE_MAPS === 'false',
    deleteSourcemapsAfterUpload: true,
  },
  release: sentryRelease
    ? {
        name: sentryRelease,
      }
    : undefined,
  treeshake: {
    removeDebugLogging: true,
  },
})
