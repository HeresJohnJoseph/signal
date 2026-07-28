// Vercel serverless function — Paystack webhook for Signal Pro.
// On a successful charge / new subscription, records the paying customer's
// email as "Pro" by POSTing it to the tracker's Apps Script web app (which
// appends to the "Pro" sheet tab). api/analyze.js then lets Pro emails bypass
// the beta allowlist.
//
// Signature: Paystack signs the RAW body with HMAC-SHA512 using your SECRET
// key — not a separate webhook secret, and not SHA256 (that was Paddle).
// The digest arrives in the `x-paystack-signature` header. The raw body is
// required byte-for-byte, so the built-in parser is disabled.
//
// Env:  PAYSTACK_SECRET_KEY   (Paystack → Settings → API Keys & Webhooks →
//                              Secret Key, sk_live_… / sk_test_…)
//       APPS_SCRIPT_URL       (optional override; defaults to the known web app)
//
// Paystack retries a webhook until it gets a 2xx, so this always acks once the
// signature is valid — a failed sheet write is logged, never re-driven forever.

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

// Constant-time compare of our HMAC against the header Paystack sent.
function verifySignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(String(sigHeader), "hex")
    );
  } catch {
    // Length mismatch or non-hex header — timingSafeEqual throws rather than
    // returning false, so treat any throw as a failed verification.
    return false;
  }
}

// Pull the buyer's email from the event. Preferred source is metadata.email,
// which openPaystackCheckout attaches (see cs-data.jsx) so it is always
// present for checkouts we opened. Falls back to the customer object, which
// is what renewal events carry.
function resolveEmail(data) {
  const d = data || {};
  const direct =
    (d.metadata && d.metadata.email) ||
    (d.customer && d.customer.email) ||
    d.email ||
    "";
  return String(direct).toLowerCase().trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: "Server not configured — PAYSTACK_SECRET_KEY missing." });

  const raw = await readRawBody(req);
  if (!verifySignature(raw, req.headers["x-paystack-signature"], secret)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ error: "Bad JSON" }); }

  // Grant Pro on a successful charge or when a subscription is created.
  // charge.success covers both the first payment and every renewal.
  const type = event.event || "";
  if (type === "charge.success" || type === "subscription.create") {
    const data = event.data || {};

    // A charge can succeed and still not be money in the bank; only a
    // "success" status should unlock paid access.
    const status = String(data.status || "").toLowerCase();
    if (type === "charge.success" && status && status !== "success") {
      return res.status(200).json({ received: true, ignored: `status=${status}` });
    }

    const email = resolveEmail(data);
    if (email) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          // text/plain avoids a CORS preflight Apps Script can't answer
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ type: "pro", email, source: "paystack" }),
        });
      } catch (e) {
        // Ack to Paystack anyway; if the write failed the email can be added
        // by hand. Retrying forever would not fix an Apps Script outage.
        console.error("[paystack-webhook] Pro write failed:", e && e.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}
