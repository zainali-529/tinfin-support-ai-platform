# Launch QA and Error Handling Checklist

Use this checklist before every production launch or major deploy. The goal is simple: every important failure should show a calm message, a useful next step, a retry path, and a docs link when setup guidance is needed.

## Global UX Rules

- Errors should never expose stack traces or raw provider payloads to users.
- Mutations should show a toast on failure through the global Sonner handler.
- Long-running checkout/provider actions should show a loading toast or loading button state.
- Query failures on major pages should show an inline error state with Retry and Docs.
- Empty states should explain what the user can do next.
- Plan-blocked pages should stay readable in preview mode where useful.

## Major Page Coverage

| Area | Expected Error UX | Retry | Docs |
| --- | --- | --- | --- |
| Dashboard | Friendly dashboard unavailable state | Refresh dashboard data | Troubleshooting |
| Inbox | Inline list error and deep-link conversation error | Refetch conversations / conversation | Inbox docs |
| Analytics | Analytics unavailable state | Refetch analytics queries | Analytics docs |
| Knowledge Base | KB/source load error, source reindex/delete toasts | Reload/refetch source list | KB docs |
| AI Actions | Load error, mutation toasts, action test toasts | Refetch actions | Actions docs |
| Billing | Plan, usage, add-on, invoice errors | Refetch relevant query | Billing docs |
| Usage | Usage load error | Refetch plan + usage | Billing docs |
| Email Channel | Email settings load error and success toasts | Refetch account | Email docs |
| WhatsApp Channel | WhatsApp settings load error and success toasts | Refetch account | WhatsApp docs |
| Voice Assistant | Vapi settings/key/KB load errors and success toasts | Refetch relevant query | Voice docs |
| Contacts | Contact list load error and create toast | Refetch contacts | Inbox docs |
| Widget Customization | Widget config load error and save toast | Refetch widget config | Widget docs |

## Failure Scenarios To Test

### No Organization Selected

- Temporarily remove or invalidate `active_org_id` for a test user.
- Expected: user should be redirected or shown an organization access message, not a broken page.

### Plan Blocked

- Test Free and Starter plans.
- Email and WhatsApp should be preview/read-only where intended.
- AI Actions should remain preview-only on Free/Starter.
- Restricted actions should show upgrade messaging, not silent failure.

### Channel Disconnected

- Email: remove provider key or sender configuration.
- WhatsApp: use an invalid/expired Meta access token.
- Expected: channel-specific message with docs link and retry/test action.

### API Key Missing

- Temporarily remove AI provider key, Vapi key, Resend key, or provider-specific env.
- Expected: friendly setup/configuration error. No stack trace in UI.

### Realtime Disconnected

- Stop the websocket server or set an invalid `NEXT_PUBLIC_WS_URL`.
- Expected: top dashboard realtime banner appears after a short delay.
- Expected: messages are still saved through API paths where applicable, but the UI warns live updates may lag.

### AI Provider Failure

- Use an invalid OpenAI key or block the AI provider temporarily.
- Expected: AI request should fail gracefully and show provider/configuration guidance.

### Email Webhook Failure

- Send a malformed Postmark/Mailgun payload.
- Expected: API logs should capture details; UI should continue to show channel setup guidance.

### WhatsApp Token Expired

- Save an invalid token and run Test Connection.
- Expected: WhatsApp token/reconnect message appears.

### Vapi Failure

- Remove Vapi key or use an invalid key.
- Try creating/updating the voice assistant.
- Expected: voice provider error message with Voice docs link.

### Action Timeout/Failure

- Create an action pointing to a slow or failing endpoint.
- Run test.
- Expected: timeout/failure toast, action test result panel, and logs should show the failure without breaking the page.

## Final Manual Smoke Test

1. Open Dashboard and refresh data.
2. Open Inbox, switch saved views, open a deep-linked conversation.
3. Send widget message and agent reply.
4. Open Knowledge Base, add a text note, re-index it, delete it.
5. Open AI Actions, preview/create/test a safe read action.
6. Open Email and WhatsApp channel pages and run test connection.
7. Open Voice Assistant and save a draft assistant.
8. Open Billing, start plan checkout, cancel, then verify cancellation alert.
9. Open Usage and verify limits/add-ons.
10. Stop websocket server and confirm realtime warning appears.

## Launch Pass Criteria

- No page shows raw stack traces.
- No destructive action fails silently.
- Every major query failure has Retry.
- Every setup-heavy failure has a docs link.
- Every mutation failure has a toast.
- Realtime disconnect is visible to agents.
- Typecheck passes for `web` and `@workspace/ui`.
