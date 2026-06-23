// Vercel serverless function — Stripe webhook for Signal Pro.
// On a completed checkout, records the paying customer's email as "Pro" by
// POSTing it to the tracker's Apps Script web app (which appends to the "Pro"
// sheet tab). api/analyze.js then lets Pro emails bypass the beta allowlist.
//
// Verifies the Stripe-Signature header with HMAC-SHA256 (no `stripe` npm dep).
// Reads the RAW request body — required for signature verification — so the
// built-in body parser is disabled and we never touch req.body.
//
// Env:  STRIPE_WEBHOOK_SECRET  (from Stripe → Developers → Webhooks → signing secret)
//       APPS_SCRIPT_URL        (optional override; defaults to the known web app)

import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// Same Apps Script web app the signup form already posts to (not secret).
const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbxFSOZ7VSoTWRLdSzfxe9rrImyEGell3VS42JX839bxLyEUF-NEKTrXkQJeZ6rSVXQWrw/exec";

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

// Verify Stripe's t=…,v1=… signature against the raw body (5-min replay window).
function verifySignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(",").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Server not configured — STRIPE_WEBHOOK_SECRET missing." });

  const raw = await readRawBody(req);
  const sig = req.headers["stripe-signature"];
  if (!verifySignature(raw.toString("utf8"), sig, secret)) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ error: "Bad JSON" }); }

  // A successful checkout (Payment Link or Checkout Session) → grant Pro.
  if (event.type === "checkout.session.completed") {
    const s = (event.data && event.data.object) || {};
    const email = (
      (s.customer_details && s.customer_details.email) ||
      s.customer_email ||
      s.client_reference_id ||
      ""
    ).toLowerCase().trim();

    if (email) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          // text/plain avoids a CORS preflight Apps Script can't answer
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ type: "pro", email, source: "stripe" }),
        });
      } catch (e) {
        // Ack to Stripe anyway; if the write failed the email can be added by hand.
        console.error("[stripe-webhook] Pro write failed:", e && e.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}
