Add documentation screenshots in this folder using the exact filenames referenced by `apps/web/lib/docs.ts`.

Theme-aware folder structure:
- `light/FILENAME.png`
- `dark/FILENAME.png`

Public URL patterns:
- `/docs-assets/screenshots/light/FILENAME.png`
- `/docs-assets/screenshots/dark/FILENAME.png`

The docs renderer automatically switches between `light` and `dark` based on the current app theme. Keep the filename exactly the same in both folders.

Optional fallback:
- `/docs-assets/screenshots/FILENAME.png`

If a theme-specific image is missing, the docs page tries the optional fallback path before showing the placeholder.

Best practice:
- Use PNG for product screenshots.
- Use 1902x941 for docs screenshots. This matches the docs screenshot frame and avoids cropping.
- Keep browser zoom at 100%.
- Capture the same page state in both light and dark mode when possible.
- Keep both theme variants aligned: same page, same data, same viewport, same filename.
- Avoid secrets, API keys, real customer names, real emails, and payment details.
- Capture a populated workspace state when possible so the screenshots show real product context instead of empty states.

Recommended screenshot filenames:
- dashboard-overview.png
- organization-switcher.png
- widget-embed-settings.png
- widget-no-code-wizard.png
- widget-customization.png
- widget-live-test.png
- unified-inbox.png
- inbox-sla-backlog.png
- inbox-notes-timeline.png
- notification-bell.png
- knowledge-base.png
- ai-improvements.png
- ai-channel-behavior.png
- ai-actions-v1.png
- agent-copilot.png
- email-channel-settings.png
- whatsapp-channel.png
- voice-call-ui.png
- team-settings.png
- billing-usage-addons.png
- customer-profile.png
- csat-feedback.png
- analytics-reporting.png
