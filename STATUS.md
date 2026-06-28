# Signal — Build Status & Handover

**For:** John's EA · **Last updated:** 27 June 2026 · **Owner:** John Joseph
**Live app:** https://signal-eight-opal.vercel.app
**Code repo:** `git@github.com:HeresJohnJoseph/signal.git` (this folder)

> Read this top-to-bottom and you'll know exactly what Signal is, what's live,
> what's been built since day 1, and what's still outstanding. No prior context needed.

---

## 1. TL;DR (30-second version)

**Signal is a web app that produces competitor social-media intelligence decks
in minutes** — point it at a brand + category + market, and it pulls live data
(via Google's Gemini AI + Google Search), scores each competitor, and exports a
polished PowerPoint / PDF report. It's the productised version of the kind of
competitor review John used to build by hand over days.

**Status: LIVE and in beta.** The app is deployed, working, and John has opened
it to a first wave of testers via his WhatsApp group ("Half Full Circle", 10
founding-tester cap). Payment (Stripe "Pro") is built but not yet switched on.

**What needs John (not code):** 3 small operational steps to fully open the beta
(below), and a decision to push the latest 3 commits live.

---

## 2. What Signal does (the product)

1. Pick a **market** (South Africa / US / UK), a **brand or category**, and a
   **reporting month**.
2. Hit **Run** — Signal fetches that brand's competitors and runs an AI analysis
   of each one's social presence, content themes, sentiment, campaigns, and a
   creative-effectiveness score.
3. **Export** the result as a PowerPoint deck, a slides PDF, or an intelligence
   report — all on Signal's dark brand design.
4. **NEW:** Pick from a dropdown of all tracked brands, and if a brand isn't
   there yet, **request it** — a zero-cost way for us to measure which brands
   agencies/freelancers actually want (the demand framework).

**Who it's for:** freelancers and small agencies who need a polished competitor
review fast. The business model is closest to "productised consulting" delivered
through software — the deck is the product.

---

## 3. Where we are RIGHT NOW (live & verified)

✅ Deployed on Vercel; AI key held securely server-side (testers never touch keys)
✅ Sign-in gate + invite allowlist working
✅ Live analysis works across SA / US / UK
✅ Exports: PowerPoint, Slides PDF, Intelligence Report — all polished
✅ Demo mode (`?demo=1`) loads instantly with no AI, for safe client demos
✅ Mobile layout works; analytics (PostHog) live; lead capture on signup working
✅ Stripe "Pro" payment path built (not yet switched on)
✅ Beta launched to WhatsApp group; access granted per-tester on request

---

## 4. What's been built — Day 1 to now

The build ran from **9 June 2026** to today across ~60 commits. Grouped by phase:

### Phase 1 — Core engine (9–11 June)
- Initial competitor-analysis engine published.
- AI reliability fixes (retries, error surfacing, rate-limit handling).
- **Rebranded the product to "Signal."**
- Auto-detect dead/invalid AI keys; key-activity highlighting; a period-by-period
  "Social Audit" view.

### Phase 2 — Breadth & polish (12–14 June)
- **Multi-category support** (Alcohol, QSR, Retail, Telecoms, Beauty, Skincare,
  Haircare) with a grouped sidebar.
- Added TikTok + Website as platforms (TikTok excluded for alcohol, by regulation).
- Auto-load real Instagram creative into the decks (via Apify).
- Shared config so no per-user key prompts.
- **Google sign-up gate** wired to a tracker Google Sheet.
- Design-system reference page; PostHog analytics; AI quota monitor.

### Phase 3 — Demo mode & mobile (18–19 June)
- **`?demo=1` mode**: pre-analysed data for every category that bypasses the
  gate and AI — so a client demo can never fail on quota.
- Responsive mobile layout; real Google sign-in wired in.

### Phase 4 — Beta infrastructure (21–22 June)
- **Serverless proxy** holds the AI key server-side (so the method/playbook and
  key never ship to the browser).
- **Email allowlist gate** (only invited testers get in), enforced in two places.
- **US/UK markets** added.
- Reliability: larger AI response budget + retries to stop truncated reports.
- Richer signup form (20 industries) → leads land in a dedicated sheet tab.

### Phase 5 — IP protection, monetisation, exports (22–24 June)
- **Moved the analysis methodology fully server-side** (can't be lifted from the
  browser) — protects the IP.
- Genericised the "how it works" panel so the playbook isn't exposed.
- **PDF/report exports re-skinned** to Signal's dark brand.
- **Stripe "Pro" payment path** built (upgrade from free beta → paid access).
- Fixed a dead export button and the competitor-suggestion feature.
- Beta UX: distinguish "daily quota used up" from a short per-minute spike.

### Phase 6 — Deck quality, growth loop, demand capture (27 June — today)
- **Rebuilt the PowerPoint export** on the formula of John's flagship VML
  "Bernini" competitor deck — editorial headlines, a competitor leaderboard with
  a score heatmap, and a head-to-head comparison table.
- **Added a "Made with Signal" watermark + referral link** to every exported
  deck/PDF — every forwarded file is now a growth hook back to the app.
- **Brand dropdown + "Request a brand"**: a token-light dropdown of all tracked
  brands, plus a zero-cost request box for brands we don't have yet. Requests are
  logged (with the requester's segment) so we can measure latent demand — which
  brands agencies/social-media managers/freelancers most want — and decide what
  to add next. (Briefly trialled a live AI brand-search; replaced with the
  dropdown + request model to control AI token cost.)

---

## 5. What's OUTSTANDING (needs action)

### A. Latest code is pushed & live ✅
All build work through 27 June is pushed to `main` and auto-deployed to the live
site (verified serving `cs-data.jsx?v=20260627f`; `/api/health` returns
`keyConfigured:true`). Nothing to do here.

### ⭐ B. EA TASK — Republish the Apps Script (one-time, ~5 min, do with John)

**Why:** a small Google Apps Script writes a row whenever someone signs up or
**requests a brand**. The updated code (now in [`sheet-sync.gs`](sheet-sync.gs))
adds brand-request capture, but Google only runs the *last published version*,
so it must be republished. Until then brand requests are still safely recorded
in **PostHog** — so this is a convenience, not urgent. **No data is lost by
waiting.**

**⚠️ Gotchas we discovered (read first — easy to get wrong):**
- The tracker is an **uploaded .xlsx**, so it has **no Extensions → Apps Script
  menu**. The code lives in a **separate** project.
- There are **two** web-app deployments. The app only calls the one whose URL
  starts **`AKfycbxFSOZ7…`** — you must update *that* one, or nothing changes.
- The live code uses `getActiveSpreadsheet()` (bound to a native Google Sheet,
  not the .xlsx). `sheet-sync.gs` already matches this — paste it as-is; do not
  "fix" it to open the .xlsx by ID.

**Steps:**
1. Go to **https://script.google.com/home** (signed in as John) → open
   **"Signal Signups Backend"**.
2. In `Code.gs`: select all (⌘A) → delete → paste the entire contents of
   **[`sheet-sync.gs`](sheet-sync.gs)** → save (⌘S).
3. Top-right → **Deploy → Manage deployments**.
4. In the **Active** list, click the deployment whose Deployment ID / Web-app
   URL starts **`AKfycbxFSOZ7…`** (click each to check — there are two).
5. Click the **pencil (Edit)** icon → **Version: New version** → **Deploy**.
6. Approve any Google authorisation prompt with John's account.

**How to check it worked:** in the live app, request a made-up brand. Within a
few seconds a new **"Brand Requests"** tab row should appear in the Google Sheet
that the script is bound to (Timestamp · Brand · Market · Requested by · Segment
· Industry · Team Size). Also confirmable in PostHog under `brand_requested`.

### C. Operational steps to fully open the beta (John)
1. **Add tester emails** to the `Allowlist` tab of the tracker Google Sheet
   (one per row, column A). Listed = they're in; removed = they're out.
2. Share the link with testers (they sign in with Google; if allowlisted, in).
3. Full runbook with verification commands: **[BETA-SETUP.md](BETA-SETUP.md)**.

### D. Optional — switch on paid Pro (to take money)
Stripe is built but dormant. To go live: create a Stripe payment link + webhook
and add one environment variable. Steps are in BETA-SETUP.md. Test in Stripe's
test mode first.

### E. Watch-items (not urgent, but real)
- **Shared AI quota:** all testers share one free Google AI allowance
  (~1,500 calls/day). Fine for the beta; **move to a paid AI plan before any
  big push** (e.g. LinkedIn).
- **Product name:** "Signal" is strong but very crowded (clashes with the Signal
  messenger app and many martech tools). Worth a naming review before scaling
  paid — flagged, not urgent.

---

## 6. Key facts & access (reference)

| Thing | Value |
|---|---|
| Live app | https://signal-eight-opal.vercel.app |
| Demo (no login) | https://signal-eight-opal.vercel.app/competitor-snapshot.html?demo=1 |
| Code repo | `git@github.com:HeresJohnJoseph/signal.git` |
| Hosting | Vercel (auto-deploys on every push to `main`) |
| AI | Google Gemini + Google Search (key stored in Vercel, server-side) |
| Tracker | Google Sheet (competitor links, `Allowlist`, `Pro`, `Signups`, `Brand Requests` tabs) |
| Analytics | PostHog |
| Payments | Stripe (built, not yet switched on) |

**Note:** API keys live only in Vercel's settings — never in the code or in
chat. Testers never see or manage keys.

---

## 7. How to confirm it's live (anyone can run)

Open https://signal-eight-opal.vercel.app — it should redirect to a sign-up page.
Open the demo link in the table above — it should load a populated dashboard with
no login. Both working = the app is up.

---

*This file is a living handover. The deeper operational runbook (allowlist, Apps
Script redeploy, Stripe, verification commands) is in **BETA-SETUP.md** in the
same folder.*
