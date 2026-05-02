# Widget Installation Phase 3 Guide

Ye guide Phase 3 installation work ka practical reference hai. Is phase ka goal ye tha ke widget sirf simple script copy/paste na rahe, balkay competitor-style installation workflow ban jaye: smart wizard, platform detection, install verification, JS command API, logged-in user identity support, aur developer handoff snippets.

## 1. Ab Installation Wizard Kya Karta Hai

Dashboard ke `Embedding` page par ab ye cheezen available hain:

1. Website URL scan
2. Platform detection
3. Recommended installation path
4. Multi-platform snippets
5. Live install verification
6. Developer handoff brief
7. Browser console QA commands

User website URL enter karta hai, wizard backend se site HTML fetch karta hai, common platform markers detect karta hai, phir recommended snippet aur steps show karta hai.

## 2. Supported Install Paths

Wizard ab in platforms ke liye guidance/snippets deta hai:

- Universal HTML website
- JavaScript API loader
- Next.js app router/root layout
- React SPA
- Google Tag Manager Custom HTML
- WordPress footer/custom-code plugin
- Shopify theme.liquid/app embed style flow
- Webflow footer custom code
- Wix custom code
- Squarespace code injection
- Logged-in identity handoff
- Local development widget

## 3. Widget JS API

Widget runtime ab global `Tinfin` API expose karta hai.

Available commands:

```js
Tinfin('boot', { orgId: 'ORG_ID' })
Tinfin('update', { user: { id: 'u_1', email: 'user@example.com', name: 'User' } })
Tinfin('show')
Tinfin('hide')
Tinfin('openNewMessage', 'I need help')
Tinfin('newChat')
Tinfin('shutdown')
```

Direct helper methods bhi supported hain:

```js
Tinfin.show()
Tinfin.hide()
Tinfin.openNewMessage('I need help')
Tinfin.shutdown()
Tinfin.boot({ orgId: 'ORG_ID' })
```

## 4. Logged-In User Identity

Agar customer ka app logged-in users rakhta hai, wo widget ko identity pass kar sakta hai:

```js
Tinfin('boot', {
  orgId: 'ORG_ID',
  user: {
    id: 'user_123',
    email: 'customer@example.com',
    name: 'Customer Name',
    userHash: 'optional_backend_hmac',
    traits: { plan: 'pro' },
  },
  company: {
    id: 'company_123',
    name: 'Acme Inc',
    plan: 'business',
  },
  customAttributes: { source: 'app_dashboard' },
})
```

Iska benefit:

- Pre-chat form skip ho sakta hai.
- Contact record mein name/email ke sath external user id, phone, company, traits, page context aur custom attributes save hotay hain.
- Inbox agents ko better context milta hai.
- SPA apps route change par `Tinfin('update')` call kar sakti hain.

## 5. Install Verification Kaise Work Karta Hai

Backend router `widgetInstall.verifyInstall` ye checks karta hai:

1. Website reachable hai ya nahi.
2. HTML mein Tinfin script visible hai ya nahi.
3. `data-org-id` current organization se match karta hai ya nahi.
4. Script async load ho raha hai ya nahi.
5. Agar GTM detect ho aur direct script HTML mein visible na ho to warning deta hai, because unpublished/custom GTM tags raw HTML mein visible nahi hotay.

Possible statuses:

- `installed`: script found aur org id match.
- `wrong_org`: Tinfin script found lekin org id different.
- `missing`: script nahi mila ya org id visible nahi.
- `unreachable`: website scan nahi ho saki.

## 6. Security Notes

Backend scanner SSRF-safe banaya gaya hai:

- `localhost`, `.local`, private IPs block hain.
- DNS resolve karke private addresses reject hotay hain.
- Redirects limited aur re-validated hain.
- Fetch timeout 8 seconds hai.
- HTML response size capped hai.

## 7. Testing Checklist

### Typecheck

```bash
pnpm --filter @workspace/widget check-types
pnpm --filter @workspace/api check-types
pnpm --filter web typecheck
```

### Local Widget Test

1. Widget app run karein:

```bash
pnpm --filter @workspace/widget dev
```

2. API/WebSocket run karein:

```bash
pnpm --filter @workspace/api dev
```

3. Web dashboard run karein:

```bash
pnpm --filter web dev
```

4. Embedding page open karein aur Local Dev snippet copy karein.

### Browser Console QA

Live site par console mein run karein:

```js
Tinfin('show')
Tinfin('hide')
Tinfin('openNewMessage', 'I need help with pricing')
Tinfin('update', { user: { id: 'test_1', email: 'test@example.com', name: 'Test User' } })
Tinfin('newChat')
Tinfin('shutdown')
Tinfin('boot', { orgId: 'ORG_ID' })
```

### Verification Test

1. Snippet publish karein.
2. Dashboard > Embedding par website URL paste karein.
3. `Verify` click karein.
4. Expected: `Installed` status, org match pass, async pass.

## 8. Known Limitations

- GTM ke unpublished tags raw HTML scan mein visible nahi hotay. GTM Preview mode use karna hoga.
- Kisi third-party customer website mein bina access ke automatically script paste karna possible nahi hota. Is ke liye ya to platform plugin/app chahiye, ya OAuth/app marketplace integration, ya customer ko CMS access dena hoga.
- Future mein WordPress plugin, Shopify app embed, Webflow app, aur GTM template bana kar one-click/no-code install aur strong ho sakta hai.

## 9. Recommended Next Improvements

1. WordPress plugin package generate karein.
2. Shopify app embed block banayein.
3. GTM community template banayein.
4. Identity verification secret UI add karein.
5. Widget install status ko database mein store karke dashboard health badge show karein.
