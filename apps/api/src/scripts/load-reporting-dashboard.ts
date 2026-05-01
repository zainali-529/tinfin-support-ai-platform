type LoadResult = {
  ok: boolean
  status: number
  durationMs: number
  error?: string
}

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? process.env.TINFIN_LOAD_AUTH_TOKEN
const PERIOD = process.env.LOAD_PERIOD ?? '30d'
const TOTAL_REQUESTS = Number(process.env.LOAD_REQUESTS ?? 80)
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 8)

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

async function hitReportingEndpoint(): Promise<LoadResult> {
  const startedAt = Date.now()

  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/trpc/analytics.getReportingDashboard`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify({ json: { period: PERIOD } }),
    })

    const durationMs = Date.now() - startedAt
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        ok: false,
        status: response.status,
        durationMs,
        error: text.slice(0, 300),
      }
    }

    await response.arrayBuffer()
    return { ok: true, status: response.status, durationMs }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown request error',
    }
  }
}

async function worker(total: number, claimNext: () => number, results: LoadResult[]) {
  while (true) {
    const index = claimNext()
    if (index >= total) return
    results[index] = await hitReportingEndpoint()
  }
}

async function main() {
  if (!TOKEN) {
    console.warn('Warning: SUPABASE_ACCESS_TOKEN/TINFIN_LOAD_AUTH_TOKEN is missing. Protected endpoint should return 401.')
  }

  const results: LoadResult[] = []
  let nextRequest = 0
  const claimNext = () => nextRequest++
  const startedAt = Date.now()
  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, () =>
      worker(Math.max(1, TOTAL_REQUESTS), claimNext, results)
    )
  )

  const durationMs = Date.now() - startedAt
  const completed = results.filter((result) => result.durationMs > 0)
  const ok = completed.filter((result) => result.ok)
  const failed = completed.filter((result) => !result.ok)
  const latencies = completed.map((result) => result.durationMs)
  const errorRate = completed.length > 0 ? (failed.length / completed.length) * 100 : 100

  console.log(JSON.stringify({
    endpoint: `${API_URL.replace(/\/$/, '')}/trpc/analytics.getReportingDashboard`,
    period: PERIOD,
    totalRequests: completed.length,
    concurrency: CONCURRENCY,
    durationMs,
    success: ok.length,
    failed: failed.length,
    errorRate: Number(errorRate.toFixed(2)),
    latency: {
      minMs: Math.min(...latencies),
      avgMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length)),
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99),
      maxMs: Math.max(...latencies),
    },
    firstErrors: failed.slice(0, 5).map((result) => ({
      status: result.status,
      durationMs: result.durationMs,
      error: result.error,
    })),
  }, null, 2))

  if (errorRate > 1 || percentile(latencies, 95) > 1500) {
    process.exitCode = 1
  }
}

void main()
