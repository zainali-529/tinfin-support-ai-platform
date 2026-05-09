export const DEFAULT_SITE_URL = 'https://tinfiz.com'

export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.WEB_APP_URL ??
    process.env.APP_URL ??
    process.env.VERCEL_URL ??
    DEFAULT_SITE_URL

  const withProtocol = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
  return withProtocol.replace(/\/+$/, '')
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getSiteUrl()}${path}`
}
