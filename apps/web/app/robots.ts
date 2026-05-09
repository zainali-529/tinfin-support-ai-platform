import type { MetadataRoute } from 'next'

import { absoluteUrl, getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs'],
        disallow: [
          '/api/',
          '/auth/',
          '/invite/',
          '/login',
          '/signup',
          '/dashboard',
          '/inbox',
          '/analytics',
          '/ai-actions',
          '/billing',
          '/calls',
          '/contacts',
          '/email',
          '/email-settings',
          '/embedding',
          '/knowledge',
          '/organizations',
          '/settings',
          '/team',
          '/usage',
          '/voice-assistant',
          '/widget',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl(),
  }
}
