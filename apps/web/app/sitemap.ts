import type { MetadataRoute } from 'next'

import { docsPages, getDocsHref } from '@/lib/docs'
import { absoluteUrl } from '@/lib/site-url'

const PUBLIC_ROUTES: Array<{
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
}> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/demo', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.75, changeFrequency: 'monthly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.55, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.55, changeFrequency: 'yearly' },
]

const marketingLastModified = new Date('2026-05-10T00:00:00.000Z')
const docsLastModified = new Date('2026-05-05T00:00:00.000Z')

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingRoutes = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: marketingLastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const docsRoutes = docsPages
    .filter((page) => getDocsHref(page.slug) !== '/docs')
    .map((page) => ({
      url: absoluteUrl(getDocsHref(page.slug)),
      lastModified: docsLastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.65,
    }))

  return [...marketingRoutes, ...docsRoutes]
}
