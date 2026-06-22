// Vercel serverless function — Gemini proxy for the Signal beta.
// Holds the Gemini API key server-side (GEMINI_API_KEY env var) so beta
// testers never see or enter a key. Enforces the email allowlist from the
// tracker sheet's "Allowlist" tab as defense-in-depth behind the UI gate.

const SHEET_ID = "1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF";
const MODEL = "gemini-2.5-flash";

// Pull approved emails from the sheet's "Allowlist" tab (column A).
// Returns null if it can't be read (treated as "no list configured").
async function fetchAllowlist() {
  try {
    const r = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Allowlist`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const txt = await r.text();
    const emails = txt
      .split(/\r?\n/)
      .map((line) => (line.split(",")[0] || "").replace(/^"|"$/g, "").trim().toLowerCase())
      .filter((e) => e.includes("@"));
    return emails;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured — GEMINI_API_KEY is missing." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = body && body.prompt;
  const email = ((body && body.email) || "").toLowerCase().trim();
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });

  // Allowlist enforcement — only if a list exists and has entries.
  const allow = await fetchAllowlist();
  if (allow && allow.length) {
    if (!email || !allow.includes(email)) {
      return res.status(403).json({ error: "not_allowed: This account isn't on the Signal beta list yet." });
    }
  }

  try {
    const gr = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          tools: [{ google_search: {} }],
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      }
    );
    const data = await gr.json().catch(() => ({}));
    if (!gr.ok) {
      const msg = (data && data.error && data.error.message) || `Gemini error ${gr.status}`;
      return res.status(gr.status).json({ error: gr.status === 429 ? "quota_exceeded: " + msg : msg });
    }
    const cand = data.candidates && data.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || [])
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (!text) {
      const reason = (data.promptFeedback && data.promptFeedback.blockReason) || "no text returned";
      return res.status(502).json({ error: "Gemini blocked: " + reason });
    }
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "Proxy request failed: " + (e.message || "unknown") });
  }
}
