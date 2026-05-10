# Tinfiz User Issue Reporting Setup

The dashboard includes a global **Report issue** button. It attaches user, organization, page, browser, release, and server metadata so vague user reports become actionable.

## Where It Appears

- Dashboard top bar.
- Available to signed-in dashboard users.
- The API verifies the current Supabase session and attaches trusted user/org metadata server-side.

## Delivery Options

Configure at least one delivery channel in production.

### Webhook

```bash
ISSUE_REPORT_WEBHOOK_URL=https://your-webhook-endpoint.example.com/tinfiz-issues
ISSUE_REPORT_WEBHOOK_SECRET=your-shared-secret
```

The request is sent as JSON with:

```http
x-tinfiz-issue-secret: your-shared-secret
content-type: application/json
```

### Email

```bash
ISSUE_REPORT_EMAIL_TO=support@tinfiz.ai
ISSUE_REPORT_EMAIL_FROM=notifications@tinfiz.ai
ISSUE_REPORT_EMAIL_FROM_NAME=Tinfiz Issue Reports
ISSUE_REPORT_EMAIL_REPLY_TO=support@tinfiz.ai
ISSUE_REPORT_RESEND_API_KEY=re_...
```

Fallbacks:

- `ISSUE_REPORT_RESEND_API_KEY` falls back to `NOTIFICATION_RESEND_API_KEY` or `RESEND_API_KEY`.
- `ISSUE_REPORT_EMAIL_FROM` falls back to `NOTIFICATION_EMAIL_FROM`.
- `ISSUE_REPORT_EMAIL_REPLY_TO` falls back to `NOTIFICATION_EMAIL_REPLY_TO`.

## Metadata Captured

The report includes:

- Issue type and severity.
- Summary, description, steps, expected result, actual result.
- Trusted signed-in user ID/email/name.
- Trusted active organization ID/name/plan/role.
- Current page URL, route, title, and referrer.
- Browser user agent, language, timezone, viewport, screen size, and device pixel ratio.
- Server environment, release, IP, user agent, and referrer.
- Sentry event capture for monitoring correlation.

Secret values are not collected.

## Testing

1. Set a webhook URL or email destination.
2. Open any dashboard page.
3. Click **Report issue** in the top bar.
4. Submit a test issue.
5. Confirm:
   - Toast says the report was sent.
   - Webhook/email receives the report.
   - Sentry receives a `User issue reported` message with `surface=user_issue_report`.

## Validation

Run:

```bash
pnpm env:check:production
```

Production will fail if neither `ISSUE_REPORT_WEBHOOK_URL` nor `ISSUE_REPORT_EMAIL_TO` is configured.
