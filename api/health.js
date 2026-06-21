// Vercel serverless function — proxy health probe.
// The client hits this once to decide whether a server-side key proxy
// is available (hosted on Vercel) vs. falling back to local/direct calls.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, keyConfigured: !!process.env.GEMINI_API_KEY });
}
