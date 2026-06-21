# Signal — Beta Setup

How to open Signal to a small group of invited testers. The code is done;
these are the one-time infrastructure + secret steps only you can do.

## How it works
- **Serverless proxy** (`api/analyze.js`) holds the Gemini key server-side, so testers
  never see or enter an API key. Requires hosting that runs server code — **Vercel**,
  not GitHub Pages.
- **Email allowlist** — only Google accounts whose email is in the sheet's `Allowlist`
  tab get in. Everyone else gets a "you're on the waitlist" screen. Enforced both at
  sign-in and at the proxy.
- **Graceful fallback** — demo mode (`?demo=1`), local dev, and GitHub Pages still work
  unchanged; the proxy is only used when it's actually deployed.

## Go-live checklist

### 1. Deploy to Vercel
- vercel.com → **New Project** → import the `HeresJohnJoseph/signal` repo.
- Vercel auto-detects the `api/` folder as serverless functions. No build config needed.
- You'll get a URL like `https://signal-xxxx.vercel.app` — this is the beta URL.

### 2. Add the Gemini key as a Vercel env var
- Vercel project → **Settings → Environment Variables**.
- Add `GEMINI_API_KEY` = a fresh working `AIzaSy…` key (get one at aistudio.google.com/apikey).
- **Redeploy** after adding (Deployments → ⋯ → Redeploy) so the variable takes effect.
- Verify: open `https://<your-vercel-url>/api/health` — it should return
  `{"ok":true,"keyConfigured":true}`.

### 3. Create the Allowlist tab
- In the tracker Google Sheet, add a tab named exactly **`Allowlist`**.
- Put one approved tester email per row in **column A**.
- Add an email → that person is in. Remove it → they're out. No redeploy needed.
- ⚠️ Until this tab has at least one email, the gate is effectively **open** — create it
  and add your testers before sharing the link.

### 4. Push the code
- `git push` from a terminal where your GitHub login works.
- Vercel auto-deploys on every push once the project is connected.

## Invite testers
- Send them the **Vercel URL** (not the github.io one — that has no proxy).
- They click → sign in with Google → if their email is on the Allowlist, they're in;
  otherwise they see the waitlist screen.
- Analysis runs through your server-held key. Auto-load Creative works via the shared
  Apify token already in the `Config` tab.

## Things to watch
- **Shared quota:** all testers share the one Gemini key (free tier ≈ 1,500 calls/day,
  10/min). Watch the quota chip in the sidebar. Add per-user limits later if needed.
- **Security level:** the allowlist trusts the signed-in Google email rather than fully
  verifying the token — fine for an invited beta; harden before paid launch.
- **Rotating the key:** if the key ever gets flagged, just change `GEMINI_API_KEY` in
  Vercel and redeploy — no code change, no front-end edit.

## Quick verification (after deploy)
```
# health — should show keyConfigured:true
curl https://<your-vercel-url>/api/health

# a non-allowlisted call should be refused (403 not_allowed)
curl -X POST https://<your-vercel-url>/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","email":"stranger@example.com"}'
```
