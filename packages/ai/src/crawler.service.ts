import * as cheerio from 'cheerio'

export interface CrawlResult {
  title: string
  content: string
  sourceUrl: string
}

// Noise selectors to strip before extracting text
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'footer',
  'header',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.nav',
  '.footer',
  '.header',
  '.menu',
  '.sidebar',
  '.advertisement',
  '.ad',
  '.cookie',
  '.cookie-banner',
  '.cookie-notice',
  '[aria-hidden="true"]',
  'svg',
].join(', ')

// Preferred content selectors (checked in order)
const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post-content',
  '.article-body',
  '.entry-content',
  '.content',
  '.page-content',
  '#content',
  '#main',
]

/**
 * Crawl a single URL and extract clean text content.
 * Uses Cheerio for static HTML parsing.
 * For dynamic/JS-rendered pages, integrate Playwright as a fallback
 * (see crawlUrlDynamic stub below).
 */
export async function crawlUrl(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TinfinBot/1.0 (+https://tinfin.com/bot)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    throw new Error(`Expected HTML but got ${contentType} for ${url}`)
  }

  const html = await response.text()
  return parseHtml(html, url)
}

/**
 * Parse raw HTML into a structured CrawlResult.
 */
export function parseHtml(html: string, sourceUrl: string): CrawlResult {
  const $ = cheerio.load(html)

  // Strip noise
  $(NOISE_SELECTORS).remove()

  // Extract title
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    'Untitled'

  // Extract body text — prefer semantic content containers
  let rawText = ''

  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first()
    if (el.length && el.text().trim().length > 200) {
      rawText = el.text()
      break
    }
  }

  if (!rawText) {
    rawText = $('body').text()
  }

  const content = cleanText(rawText)

  return { title, content, sourceUrl }
}

/**
 * Normalise whitespace and remove blank lines.
 */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Crawl multiple URLs sequentially, skipping failures.
 */
export async function crawlMultipleUrls(urls: string[]): Promise<CrawlResult[]> {
  const results: CrawlResult[] = []

  for (const url of urls) {
    try {
      const result = await crawlUrl(url)
      results.push(result)
    } catch (err) {
      console.error(`[crawler] Failed to crawl ${url}:`, (err as Error).message)
    }
  }

  return results
}

// ─── Playwright stub (optional dynamic page support) ─────────────────────────
/**
 * Placeholder for Playwright-based dynamic crawling.
 * Install `playwright` and uncomment to enable:
 *
 * import { chromium } from 'playwright'
 *
 * export async function crawlUrlDynamic(url: string): Promise<CrawlResult> {
 *   const browser = await chromium.launch({ headless: true })
 *   const page = await browser.newPage()
 *   await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
 *   const html = await page.content()
 *   await browser.close()
 *   return parseHtml(html, url)
 * }
 */