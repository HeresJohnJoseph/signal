# Signal — Beta Launch

How to open Signal to invited testers. The build is done and verified; what
remains is operational (adding testers, one Apps Script redeploy). The live
beta URL is **https://signal-eight-opal.vercel.app**.

## How it works
- **Serverless proxy** (`api/analyze.js`) holds the Gemini key server-side, so testers
  never see or enter an API key, and the analysis methodology never ships to the browser.
  Requires server hosting — **Vercel**, not GitHub Pages.
- **Access gate** — only Google accounts whose email is in the sheet's `Allowlist` tab
  (free beta) **or** `Pro` tab (paid) get in. Everyone else sees a waitlist + "Go Pro"
  paywall. Enforced both at sign-in and at the proxy.
- **Graceful fallback** — demo mode (`?demo=1`) bypasses the gate and loads pre-analyzed
  data instantly, so a client demo can never fail on quota.

## ✅ Already done (verified live)
- Deployed to Vercel; `GEMINI_API_KEY` set (`/api/health` → `{"ok":true,"keyConfigured":true}`).
- Root `/` redirects to signup; unregistered visitors are gated to the signup flow.
- Live analysis works (SA / US / UK) through the server proxy.
- Exports: Slides PDF, Intelligence Report, PowerPoint — all on the dark Signal CI.
- Lead capture emails arrive on signup; PostHog analytics are live.
- Mobile layout verified; no console errors on the core path.

## 🔲 To launch the beta (operational — only you can do these)

### 1. Add tester emails to the `Allowlist` tab
- In the tracker Google Sheet, the tab named exactly **`Allowlist`**, column **A**.
- One approved tester email per row. Add → they're in; remove → they're out. No redeploy.
- ⚠️ Until this tab has ≥1 email, the gate is effectively **open** — add your testers first.

### 2. Redeploy the Apps Script (one time)
- Tracker sheet → **Extensions → Apps Script** → paste the current [`sheet-sync.gs`](sheet-sync.gs).
- **Deploy → Manage deployments → Edit → New version → Deploy** (keeps the same URL).
- This makes signups land in the **`Signups`** tab and enables the **`Pro`** tab writes
  used by the payment path.

### 3. Share the link
- Send testers **https://signal-eight-opal.vercel.app** (add `?ref=source` to attribute a
  channel). They sign in with Google → if allowlisted, straight in.

## 💳 Optional — turn on paid Pro (to take money)
See the payment path (commit `acb422f`). Steps: create a Stripe Product + Payment Link
(success URL → `…/signup.html?pro=success`); add a webhook to `…/api/stripe-webhook`
(event `checkout.session.completed`) and set `STRIPE_WEBHOOK_SECRET` in Vercel; add a
`stripe_pro_url` row to the `Config` tab. Not-invited users then see a "Go Pro — Instant
Access" paywall instead of a dead-end waitlist. Test in Stripe **Test mode** first.

## Things to watch
- **Shared quota:** all testers share one Gemini key (free tier ≈ 1,500 calls/day, 10/min).
  Watch the quota chip in the sidebar. **Move to a paid Gemini plan before real volume** —
  a growing paid base will exhaust the shared free cap.
- **Access trust:** the gate trusts the signed-in Google email rather than fully verifying
  the token — fine for an invited beta; harden before scaling paid.
- **Rotating the key:** change `GEMINI_API_KEY` in Vercel and redeploy — no code change.

## Quick verification (after any deploy)
```
# health — keyConfigured:true
curl https://signal-eight-opal.vercel.app/api/health

# a non-allowlisted analysis call is refused (403 not_allowed) — proves the gate works
curl -X POST https://signal-eight-opal.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"params":{"name":"Test","category":"qsr","market":"us","month":3,"year":2026},"email":"stranger@example.com"}'
```
