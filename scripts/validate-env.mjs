#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const VALID_MODES = new Set(["staging", "production"])
const PROJECT_ROOT = process.cwd()

const args = parseArgs(process.argv.slice(2))
const mode = String(args.mode ?? process.env.APP_ENV ?? process.env.SENTRY_ENVIRONMENT ?? "staging").toLowerCase()

if (args.help) {
  printHelp()
  process.exit(0)
}

if (!VALID_MODES.has(mode)) {
  console.error(`Invalid --mode value "${mode}". Expected one of: staging, production.`)
  process.exit(1)
}

const envFile = resolveEnvFile(args.file ?? args["env-file"], mode)
const fileEnv = loadDotEnvFile(envFile)
const env = { ...fileEnv, ...process.env }
const allowLocal = args["allow-local"] === true
const strictOptional = args["strict-optional"] === true
const jsonOutput = args.json === true

const checks = []
const errors = []
const warnings = []

function runValidation() {
  section("Runtime", () => {
    requireEnv("NODE_ENV", "Next.js and API must run with production optimizations.")
    oneOf("NODE_ENV", ["production"], "NODE_ENV must be production for staging and production deployments.")
    recommendedEnv("NEXT_PUBLIC_APP_ENV", "Use staging/production to make client-side diagnostics explicit.")
    if (has("NEXT_PUBLIC_APP_ENV")) {
      oneOf("NEXT_PUBLIC_APP_ENV", ["staging", "production"], "NEXT_PUBLIC_APP_ENV must be staging or production.")
      equals("NEXT_PUBLIC_APP_ENV", mode, `NEXT_PUBLIC_APP_ENV should match --mode=${mode}.`, "warn")
    }
  })

  section("Public URLs", () => {
    requireEnv("NEXT_PUBLIC_APP_URL", "Used by web links, notifications, and metadata.")
    requireEnv("WEB_URL", "Used by API redirects and CORS.")
    requireEnv("NEXT_PUBLIC_API_URL", "Used by dashboard and widget API calls.")
    requireEnv("NEXT_PUBLIC_WS_URL", "Used by dashboard realtime WebSocket connections.")
    requireEnv("VITE_API_URL", "Used by the standalone widget bundle.")
    requireEnv("VITE_API_WS_URL", "Used by the standalone widget realtime client.")

    url("NEXT_PUBLIC_APP_URL")
    url("WEB_URL")
    url("NEXT_PUBLIC_API_URL")
    websocketUrl("NEXT_PUBLIC_WS_URL")
    url("VITE_API_URL")
    websocketUrl("VITE_API_WS_URL")

    recommendedEnv("API_BASE_URL", "Recommended for public webhooks such as WhatsApp and Vapi.")
    if (has("API_BASE_URL")) url("API_BASE_URL")
    if (mode === "staging") {
      containsHint("NEXT_PUBLIC_APP_URL", "staging", "Staging URLs should usually include staging in the hostname.")
    }
  })

  section("Database and Supabase", () => {
    requireEnv("DATABASE_URL", "Required by Drizzle migrations and server-side database access.")
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", "Required by web, API, widget config, and AI services.")
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Required by client auth flows.")
    requireEnv("SUPABASE_SERVICE_KEY", "Required by API server-side operations.")

    postgresUrl("DATABASE_URL")
    url("NEXT_PUBLIC_SUPABASE_URL")
    minLength("NEXT_PUBLIC_SUPABASE_ANON_KEY", 32)
    minLength("SUPABASE_SERVICE_KEY", 32)
  })

  section("AI and RAG", () => {
    requireEnv("OPENAI_API_KEY", "Required for AI answers, embeddings, Copilot, and voice previews.")
    startsWith("OPENAI_API_KEY", ["sk-"], "OPENAI_API_KEY should look like an OpenAI API key.", "warn")
    recommendedEnv("AGENT_COPILOT_MODEL", "Recommended so Copilot model changes are explicit.")
    recommendedEnv("ANALYTICS_TIME_ZONE", "Recommended so analytics windows match your business timezone.")
  })

  section("Security keys", () => {
    requireEnv("ENCRYPTION_KEY", "Required for app-level encryption.")
    requireEnv("ACTION_SECRET_ENCRYPTION_KEY", "Required for AI action secret encryption.")
    requireEnv("AI_ACTION_OUTBOUND_ALLOWLIST", "Required to restrict AI action outbound domains.")

    minLength("ENCRYPTION_KEY", 32)
    minLength("ACTION_SECRET_ENCRYPTION_KEY", 32)
    allowlist("AI_ACTION_OUTBOUND_ALLOWLIST")
  })

  section("Billing", () => {
    requireEnv("STRIPE_SECRET_KEY", "Required for subscriptions, checkout, add-ons, and billing portal.")
    requireEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "Required by client-side Stripe flows.")
    requireEnv("STRIPE_WEBHOOK_SECRET", "Required to verify Stripe billing webhooks.")
    requireEnv("STRIPE_PRICE_STARTER", "Required to map Starter subscription purchases.")
    requireEnv("STRIPE_PRICE_PRO", "Required to map Pro subscription purchases.")
    requireEnv("STRIPE_PRICE_SCALE", "Required to map Scale subscription purchases.")

    stripeKey("STRIPE_SECRET_KEY", mode === "production" ? "sk_live_" : "sk_test_")
    stripeKey("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", mode === "production" ? "pk_live_" : "pk_test_")
    startsWith("STRIPE_WEBHOOK_SECRET", ["whsec_"], "STRIPE_WEBHOOK_SECRET should start with whsec_.")
    startsWith("STRIPE_PRICE_STARTER", ["price_"], "STRIPE_PRICE_STARTER should be a Stripe price id.")
    startsWith("STRIPE_PRICE_PRO", ["price_"], "STRIPE_PRICE_PRO should be a Stripe price id.")
    startsWith("STRIPE_PRICE_SCALE", ["price_"], "STRIPE_PRICE_SCALE should be a Stripe price id.")

    optionalPositiveInteger("STRIPE_TRIAL_DAYS")
    optionalBoolean("STRIPE_ENABLE_CUSTOMER_PROMO_CODES")
    optionalWarnAny(
      [
        "STRIPE_PLAN_COUPON_ID",
        "STRIPE_DEFAULT_COUPON_ID",
        "STRIPE_PROMOTION_CODE_ID",
        "STRIPE_DEFAULT_PROMOTION_CODE_ID",
      ],
      "Billing discounts are optional, but add one if marketing shows discounted pricing.",
    )
  })

  section("Channels", () => {
    requireEnv("VAPI_PRIVATE_KEY", "Required for voice assistant creation and calls.")
    requireEnv("VAPI_PUBLIC_KEY", "Required by widget voice calling.")
    requireEnv("VAPI_WEBHOOK_SECRET", "Required to verify voice call webhooks.")
    recommendedEnv("DEEPGRAM_API_KEY", "Recommended for high quality voice previews; OpenAI fallback exists.")
    requiredInProduction("WHATSAPP_APP_SECRET", "Required to verify WhatsApp webhook signatures in production.")
    requiredInProduction("MAILGUN_WEBHOOK_SIGNING_KEY", "Required to verify email inbound webhooks in production.")

    minLength("VAPI_PRIVATE_KEY", 20)
    minLength("VAPI_PUBLIC_KEY", 10)
    minLength("VAPI_WEBHOOK_SECRET", 20)
    if (has("WHATSAPP_APP_SECRET")) minLength("WHATSAPP_APP_SECRET", 20)
    if (has("MAILGUN_WEBHOOK_SIGNING_KEY")) minLength("MAILGUN_WEBHOOK_SIGNING_KEY", 20)
  })

  section("Notifications and lead forms", () => {
    optionalBoolean("NOTIFICATION_EMAIL_ENABLED")
    optionalBoolean("NOTIFICATION_EMAIL_INCLUDE_NEW_CONVERSATIONS")

    if (env.NOTIFICATION_EMAIL_ENABLED === "true") {
      requireEnv("NOTIFICATION_RESEND_API_KEY", "Required because NOTIFICATION_EMAIL_ENABLED=true.")
      requireEnv("NOTIFICATION_EMAIL_FROM", "Required because NOTIFICATION_EMAIL_ENABLED=true.")
      requireEnv("NOTIFICATION_EMAIL_REPLY_TO", "Required because NOTIFICATION_EMAIL_ENABLED=true.")
      startsWith("NOTIFICATION_RESEND_API_KEY", ["re_"], "NOTIFICATION_RESEND_API_KEY should look like a Resend API key.", "warn")
      email("NOTIFICATION_EMAIL_FROM")
      email("NOTIFICATION_EMAIL_REPLY_TO")
    } else {
      recommendedEnv("NOTIFICATION_RESEND_API_KEY", "Recommended before enabling email notifications.")
      recommendedEnv("NOTIFICATION_EMAIL_FROM", "Recommended before enabling email notifications.")
      recommendedEnv("NOTIFICATION_EMAIL_REPLY_TO", "Recommended before enabling email notifications.")
    }

    requiredInProduction("DEMO_REQUEST_WEBHOOK_URL", "Required so /demo form submissions are delivered.")
    requiredInProduction("CONTACT_REQUEST_WEBHOOK_URL", "Required so /contact form submissions are delivered.")
    recommendedEnv("DEMO_REQUEST_WEBHOOK_SECRET", "Recommended to authenticate demo form webhooks.")
    recommendedEnv("CONTACT_REQUEST_WEBHOOK_SECRET", "Recommended to authenticate contact form webhooks.")
    if (has("DEMO_REQUEST_WEBHOOK_URL")) url("DEMO_REQUEST_WEBHOOK_URL")
    if (has("CONTACT_REQUEST_WEBHOOK_URL")) url("CONTACT_REQUEST_WEBHOOK_URL")

    if (mode === "production") {
      requireOneOf(
        ["ISSUE_REPORT_WEBHOOK_URL", "ISSUE_REPORT_EMAIL_TO"],
        "Configure at least one issue report delivery channel before launch.",
      )
    } else {
      optionalWarnAny(
        ["ISSUE_REPORT_WEBHOOK_URL", "ISSUE_REPORT_EMAIL_TO"],
        "Issue reporting can still be captured in Sentry, but webhook or email delivery is recommended.",
      )
    }
    if (has("ISSUE_REPORT_WEBHOOK_URL")) {
      url("ISSUE_REPORT_WEBHOOK_URL")
      recommendedEnv("ISSUE_REPORT_WEBHOOK_SECRET", "Recommended to authenticate issue report webhooks.")
    }
    if (has("ISSUE_REPORT_EMAIL_TO")) {
      emailList("ISSUE_REPORT_EMAIL_TO")
      recommendedEnv("ISSUE_REPORT_EMAIL_FROM", "Recommended for issue report emails; falls back to notification sender.")
      recommendedEnv("ISSUE_REPORT_EMAIL_REPLY_TO", "Recommended for issue report replies; falls back to notification reply-to.")
      recommendedEnv("ISSUE_REPORT_RESEND_API_KEY", "Recommended for issue report emails; falls back to notification Resend key.")
    }
  })

  section("Realtime and queues", () => {
    requireEnv("WS_PORT", "Required for the standalone realtime WebSocket server.")
    integer("WS_PORT", 1, 65535)

    if (mode === "production") {
      requireEnv("REDIS_URL", "Required for production queue/realtime scaling readiness.")
    } else {
      recommendedEnv("REDIS_URL", "Recommended for staging parity with production queues.")
    }
    if (has("REDIS_URL")) redisUrl("REDIS_URL")
  })

  section("Sentry monitoring", () => {
    requireEnv("SENTRY_ENABLED", "Required so monitoring can be intentionally enabled or disabled.")
    optionalBoolean("SENTRY_ENABLED")
    requireEnv("SENTRY_ENVIRONMENT", "Required to separate staging and production events.")
    requireEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "Required to tag browser events with the right environment.")
    requireEnv("SENTRY_RELEASE", "Required to group errors by release.")
    requireEnv("NEXT_PUBLIC_APP_VERSION", "Required by web Sentry release metadata.")
    requireEnv("API_VERSION", "Required by API Sentry release metadata.")
    requireEnv("SENTRY_TEST_TOKEN", "Required for protected Sentry smoke test endpoints.")
    requireEnv("NEXT_PUBLIC_SENTRY_DSN", "Required for browser error tracking.")
    requireEnv("WEB_SENTRY_DSN", "Required for web server error tracking.")
    requireEnv("API_SENTRY_DSN", "Required for API error tracking.")
    recommendedEnv("NEXT_PUBLIC_SENTRY_ENABLED", "Recommended so browser monitoring is explicit.")

    if (mode === "production") {
      requireEnv("SENTRY_UPLOAD_SOURCE_MAPS", "Required so production source map upload is intentional.")
      equals("SENTRY_UPLOAD_SOURCE_MAPS", "true", "Production source map upload should be enabled.")
    } else {
      optionalBoolean("SENTRY_UPLOAD_SOURCE_MAPS")
    }

    equals("SENTRY_ENVIRONMENT", mode, `SENTRY_ENVIRONMENT should match --mode=${mode}.`, "warn")
    equals("NEXT_PUBLIC_SENTRY_ENVIRONMENT", mode, `NEXT_PUBLIC_SENTRY_ENVIRONMENT should match --mode=${mode}.`, "warn")
    optionalBoolean("NEXT_PUBLIC_SENTRY_ENABLED")
    sentryDsn("NEXT_PUBLIC_SENTRY_DSN")
    sentryDsn("WEB_SENTRY_DSN")
    sentryDsn("API_SENTRY_DSN")
    minLength("SENTRY_TEST_TOKEN", 24)
    optionalSampleRate("SENTRY_TRACES_SAMPLE_RATE")
    optionalSampleRate("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE")
    optionalSampleRate("SENTRY_PROFILES_SAMPLE_RATE")

    if (mode === "production" || env.SENTRY_UPLOAD_SOURCE_MAPS === "true") {
      requireEnv("SENTRY_AUTH_TOKEN", "Required to upload source maps.")
      requireEnv("SENTRY_ORG", "Required to upload source maps.")
      requireEnv("SENTRY_PROJECT", "Required to upload source maps.")
    } else {
      recommendedEnv("SENTRY_AUTH_TOKEN", "Recommended if staging source maps are uploaded.")
      recommendedEnv("SENTRY_ORG", "Recommended if staging source maps are uploaded.")
      recommendedEnv("SENTRY_PROJECT", "Recommended if staging source maps are uploaded.")
    }
  })

  section("Local/demo utilities", () => {
    optionalEnv("SCREENSHOT_DEMO_ORG_ID")
    optionalEnv("SCREENSHOT_DEMO_SEED_ID")
    optionalEnv("TINFIZ_LOAD_AUTH_TOKEN")
    optionalEnv("LOAD_PERIOD")
    optionalEnv("LOAD_REQUESTS")
    optionalEnv("LOAD_CONCURRENCY")
  })
}

function parseArgs(argv) {
  const parsed = {}
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true
      continue
    }
    if (arg.startsWith("--")) {
      const [key, rawValue] = arg.slice(2).split("=", 2)
      parsed[key] = rawValue === undefined ? true : rawValue
    }
  }
  return parsed
}

function resolveEnvFile(rawPath, currentMode) {
  if (rawPath) return path.resolve(PROJECT_ROOT, String(rawPath))

  const modeFile = path.join(PROJECT_ROOT, `.env.${currentMode}`)
  if (fs.existsSync(modeFile)) return modeFile

  return path.join(PROJECT_ROOT, ".env")
}

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const content = fs.readFileSync(filePath, "utf8")
  const envMap = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line
    const equalsIndex = normalized.indexOf("=")
    if (equalsIndex === -1) continue

    const key = normalized.slice(0, equalsIndex).trim()
    let value = normalized.slice(equalsIndex + 1).trim()

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    value = stripInlineComment(value)
    value = stripQuotes(value)
    envMap[key] = value
  }

  return envMap
}

function stripInlineComment(value) {
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (char === "'" && !inDouble) inSingle = !inSingle
    if (char === '"' && !inSingle) inDouble = !inDouble
    if (char === "#" && !inSingle && !inDouble && /\s/.test(value[i - 1] ?? " ")) {
      return value.slice(0, i).trim()
    }
  }

  return value.trim()
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const unquoted = value.slice(1, -1)
    return value.startsWith('"') ? unquoted.replace(/\\n/g, "\n").replace(/\\"/g, '"') : unquoted
  }
  return value
}

let activeSection = "General"

function section(name, callback) {
  const previousSection = activeSection
  activeSection = name
  const before = checks.length
  callback()
  if (checks.length === before) {
    addCheck(name, "-", "pass", "No checks configured.")
  }
  activeSection = previousSection
}

function has(name) {
  return typeof env[name] === "string" && env[name].trim().length > 0
}

function get(name) {
  return has(name) ? env[name].trim() : ""
}

function addCheck(sectionName, name, status, message) {
  checks.push({ section: sectionName, name, status, message })
  if (status === "fail") errors.push({ section: sectionName, name, message })
  if (status === "warn") warnings.push({ section: sectionName, name, message })
}

function requireEnv(name, reason) {
  if (!has(name)) {
    addCheck(activeSection, name, "fail", `Missing required env. ${reason}`)
    return false
  }
  addCheck(activeSection, name, "pass", "Set.")
  return true
}

function requiredInProduction(name, reason) {
  if (mode === "production") return requireEnv(name, reason)
  return recommendedEnv(name, reason)
}

function recommendedEnv(name, reason) {
  if (!has(name)) {
    addCheck(activeSection, name, strictOptional ? "fail" : "warn", `Recommended env is missing. ${reason}`)
    return false
  }
  addCheck(activeSection, name, "pass", "Set.")
  return true
}

function optionalEnv(name) {
  addCheck(activeSection, name, has(name) ? "pass" : "skip", has(name) ? "Set." : "Optional.")
}

function optionalWarnAny(names, reason) {
  if (names.some(has)) {
    addCheck(activeSection, names.join(" | "), "pass", "At least one optional discount env is set.")
    return
  }
  addCheck(activeSection, names.join(" | "), strictOptional ? "fail" : "warn", reason)
}

function requireOneOf(names, reason) {
  if (names.some(has)) {
    addCheck(activeSection, names.join(" | "), "pass", "At least one required option is set.")
    return true
  }

  addCheck(activeSection, names.join(" | "), "fail", reason)
  return false
}

function url(name) {
  if (!has(name)) return
  const value = get(name)
  try {
    const parsed = new URL(value)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      addCheck(activeSection, name, "fail", "Must be an http(s) URL.")
      return
    }
    if (!allowLocal && isLocalHost(parsed.hostname)) {
      addCheck(activeSection, name, "fail", "Must not point to localhost for staging/production.")
      return
    }
    addCheck(activeSection, name, "pass", "Valid URL.")
  } catch {
    addCheck(activeSection, name, "fail", "Must be a valid URL.")
  }
}

function websocketUrl(name) {
  if (!has(name)) return
  const value = get(name)
  try {
    const parsed = new URL(value)
    if (!["ws:", "wss:"].includes(parsed.protocol)) {
      addCheck(activeSection, name, "fail", "Must be a ws(s) URL.")
      return
    }
    if (mode === "production" && parsed.protocol !== "wss:") {
      addCheck(activeSection, name, "fail", "Production WebSocket URLs must use wss://.")
      return
    }
    if (!allowLocal && isLocalHost(parsed.hostname)) {
      addCheck(activeSection, name, "fail", "Must not point to localhost for staging/production.")
      return
    }
    addCheck(activeSection, name, "pass", "Valid WebSocket URL.")
  } catch {
    addCheck(activeSection, name, "fail", "Must be a valid WebSocket URL.")
  }
}

function postgresUrl(name) {
  if (!has(name)) return
  const value = get(name)
  if (!/^postgres(ql)?:\/\//i.test(value)) {
    addCheck(activeSection, name, "fail", "Must start with postgres:// or postgresql://.")
    return
  }
  if (!allowLocal && /localhost|127\.0\.0\.1/i.test(value)) {
    addCheck(activeSection, name, "fail", "Must not point to a local database for staging/production.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid Postgres URL shape.")
}

function redisUrl(name) {
  if (!has(name)) return
  const value = get(name)
  if (!/^rediss?:\/\//i.test(value)) {
    addCheck(activeSection, name, "fail", "Must start with redis:// or rediss://.")
    return
  }
  if (mode === "production" && value.startsWith("redis://") && !allowLocal) {
    addCheck(activeSection, name, "warn", "Use rediss:// in production if your Redis provider supports TLS.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid Redis URL shape.")
}

function minLength(name, length) {
  if (!has(name)) return
  if (get(name).length < length) {
    addCheck(activeSection, name, "fail", `Must be at least ${length} characters.`)
    return
  }
  addCheck(activeSection, name, "pass", `Length is at least ${length} characters.`)
}

function startsWith(name, prefixes, message, severity = "fail") {
  if (!has(name)) return
  const value = get(name)
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    addCheck(activeSection, name, severity, message)
    return
  }
  addCheck(activeSection, name, "pass", "Expected prefix found.")
}

function stripeKey(name, expectedPrefix) {
  if (!has(name)) return
  const value = get(name)
  if (!value.startsWith(expectedPrefix)) {
    const severity = mode === "production" ? "fail" : "warn"
    addCheck(activeSection, name, severity, `${name} should start with ${expectedPrefix} for ${mode}.`)
    return
  }
  addCheck(activeSection, name, "pass", `Matches ${mode} Stripe key mode.`)
}

function sentryDsn(name) {
  if (!has(name)) return
  const value = get(name)
  if (!/^https:\/\/.+@.+\.ingest\./i.test(value) && !/^https:\/\/.+@o\d+\.ingest\./i.test(value)) {
    addCheck(activeSection, name, "warn", "Sentry DSN does not match the usual ingest URL shape.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid Sentry DSN shape.")
}

function allowlist(name) {
  if (!has(name)) return
  const value = get(name)
  const entries = value.split(",").map((item) => item.trim()).filter(Boolean)
  if (entries.length === 0) {
    addCheck(activeSection, name, "fail", "Must contain at least one allowed hostname.")
    return
  }
  if (entries.some((entry) => entry === "*" || entry.includes("*"))) {
    addCheck(activeSection, name, "fail", "Wildcard domains are not allowed.")
    return
  }
  addCheck(activeSection, name, "pass", `${entries.length} allowed domain(s) configured.`)
}

function oneOf(name, allowed, message) {
  if (!has(name)) return
  if (!allowed.includes(get(name))) {
    addCheck(activeSection, name, "fail", message)
    return
  }
  addCheck(activeSection, name, "pass", "Expected value.")
}

function equals(name, expected, message, severity = "fail") {
  if (!has(name)) return
  if (get(name) !== expected) {
    addCheck(activeSection, name, severity, message)
    return
  }
  addCheck(activeSection, name, "pass", "Matches expected value.")
}

function containsHint(name, expectedText, message) {
  if (!has(name) || allowLocal) return
  if (!get(name).toLowerCase().includes(expectedText.toLowerCase())) {
    addCheck(activeSection, name, "warn", message)
    return
  }
  addCheck(activeSection, name, "pass", "Contains staging hint.")
}

function integer(name, min, max) {
  if (!has(name)) return
  const number = Number(get(name))
  if (!Number.isInteger(number) || number < min || number > max) {
    addCheck(activeSection, name, "fail", `Must be an integer between ${min} and ${max}.`)
    return
  }
  addCheck(activeSection, name, "pass", "Valid integer.")
}

function optionalPositiveInteger(name) {
  if (!has(name)) {
    optionalEnv(name)
    return
  }
  const number = Number(get(name))
  if (!Number.isInteger(number) || number < 0) {
    addCheck(activeSection, name, "fail", "Must be a non-negative integer.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid non-negative integer.")
}

function optionalBoolean(name) {
  if (!has(name)) {
    optionalEnv(name)
    return
  }
  if (!["true", "false"].includes(get(name))) {
    addCheck(activeSection, name, "fail", "Must be true or false.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid boolean.")
}

function optionalSampleRate(name) {
  if (!has(name)) {
    optionalEnv(name)
    return
  }
  const number = Number(get(name))
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    addCheck(activeSection, name, "fail", "Must be a number between 0 and 1.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid sample rate.")
}

function email(name) {
  if (!has(name)) return
  const value = get(name)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    addCheck(activeSection, name, "fail", "Must be a valid email address.")
    return
  }
  addCheck(activeSection, name, "pass", "Valid email shape.")
}

function emailList(name) {
  if (!has(name)) return
  const emails = get(name).split(",").map((item) => item.trim()).filter(Boolean)
  if (emails.length === 0) {
    addCheck(activeSection, name, "fail", "Must include at least one email address.")
    return
  }
  if (emails.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) {
    addCheck(activeSection, name, "fail", "Must be a comma-separated list of valid email addresses.")
    return
  }
  addCheck(activeSection, name, "pass", `${emails.length} recipient email(s) configured.`)
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)
}

function printResult() {
  const summary = {
    mode,
    envFile: path.relative(PROJECT_ROOT, envFile),
    allowLocal,
    totalChecks: checks.length,
    failureCount: errors.length,
    warningCount: warnings.length,
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ ...summary, checks, errors, warnings }, null, 2))
    return
  }

  console.log("")
  console.log("Tinfiz environment validation")
  console.log("--------------------------------")
  console.log(`Mode: ${mode}`)
  console.log(`Env file: ${summary.envFile}${fs.existsSync(envFile) ? "" : " (not found, process env only)"}`)
  console.log(`Checks: ${summary.totalChecks}, failures: ${summary.failureCount}, warnings: ${summary.warningCount}`)
  console.log("")

  const grouped = groupBy(checks, "section")
  for (const [sectionName, sectionChecks] of Object.entries(grouped)) {
    console.log(sectionName)
    for (const check of sectionChecks) {
      const marker = check.status === "pass" ? "[PASS]" : check.status === "warn" ? "[WARN]" : check.status === "fail" ? "[FAIL]" : "[SKIP]"
      console.log(`  ${marker} ${check.name} - ${check.message}`)
    }
    console.log("")
  }

  if (errors.length > 0) {
    console.log("Result: failed. Fix the [FAIL] checks before deploying.")
    return
  }

  if (warnings.length > 0) {
    console.log("Result: passed with warnings. Review [WARN] checks before launch.")
    return
  }

  console.log("Result: passed. Environment looks ready.")
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key]
    acc[value] ??= []
    acc[value].push(item)
    return acc
  }, {})
}

function printHelp() {
  console.log(`
Tinfiz env validator

Usage:
  node scripts/validate-env.mjs --mode=staging
  node scripts/validate-env.mjs --mode=production --file=.env.production

Options:
  --mode=staging|production   Select deployment mode. Defaults to staging.
  --file=<path>               Load a specific env file. Defaults to .env.<mode>, then .env.
  --allow-local               Allows localhost URLs for local smoke testing only.
  --strict-optional           Treat recommended env warnings as failures.
  --json                      Print machine-readable JSON output.
  --help                      Show this help.
`)
}

runValidation()
printResult()
process.exit(errors.length > 0 ? 1 : 0)
