# Tinfiz Environment Validation Guide

This guide explains how to validate staging and production environment variables before deployment.

## Commands

Run from the repository root:

```bash
pnpm env:check:staging
pnpm env:check:production
```

Use a specific env file:

```bash
node scripts/validate-env.mjs --mode=staging --file=.env.staging
node scripts/validate-env.mjs --mode=production --file=.env.production
```

For local smoke testing only, allow localhost URLs:

```bash
node scripts/validate-env.mjs --mode=staging --file=.env --allow-local
```

For CI output:

```bash
node scripts/validate-env.mjs --mode=production --file=.env.production --json
```

## Behavior

- `[FAIL]` means deployment should stop.
- `[WARN]` means deployment can continue, but the item should be reviewed before launch.
- `[SKIP]` means the variable is optional and not currently required.
- Secret values are never printed. Only variable names and validation status are shown.

## Recommended Flow

1. Create separate env sets for staging and production.
2. Run staging validation before deploying staging.
3. Run production validation before deploying production.
4. Fix all `[FAIL]` results.
5. Review `[WARN]` results before public launch.
6. Add this command to CI before build/deploy:

```bash
pnpm env:check:production
```

## Important Checks

The validator checks:

- Runtime mode and app version.
- Public web/API/WebSocket URLs.
- Supabase and database access.
- OpenAI and AI-related configuration.
- Encryption keys and AI Actions domain allowlist.
- Stripe keys, webhook secret, and plan price IDs.
- Voice, WhatsApp, and email channel secrets.
- Notification email settings when enabled.
- Demo/contact lead form webhook delivery.
- Redis readiness for production queues/realtime scaling.
- Sentry DSNs, release metadata, source map upload configuration, and smoke test token.

## Staging vs Production

Staging should be production-like, but use safe test resources:

- Stripe test keys and test prices.
- Separate Supabase project.
- Separate Sentry environment.
- Separate app/API domains.
- Separate Redis instance if Redis is enabled.

Production should use live resources:

- Stripe live keys and live prices.
- Production Supabase project.
- Production Sentry environment.
- Public `https://` and `wss://` URLs.
- Real webhook secrets for Stripe, Vapi, WhatsApp, email, demo, and contact forms.

## Notes

- `NODE_ENV` must be `production` for both staging and production deployments.
- Production WebSocket URLs must use `wss://`.
- Production Stripe keys must use `sk_live_` and `pk_live_`.
- Staging Stripe keys should use `sk_test_` and `pk_test_`.
- `AI_ACTION_OUTBOUND_ALLOWLIST` must not use wildcards.
- If `NOTIFICATION_EMAIL_ENABLED=true`, Resend and email sender variables become required.
