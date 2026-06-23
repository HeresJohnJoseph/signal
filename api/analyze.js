// Vercel serverless function — Gemini proxy for the Signal beta.
// Holds the Gemini API key server-side (GEMINI_API_KEY env var) so beta
// testers never see or enter a key. Enforces the email allowlist from the
// tracker sheet's "Allowlist" tab as defense-in-depth behind the UI gate.

const SHEET_ID = "1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF";
const MODEL = "gemini-2.5-flash";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MARKET_LABEL = { sa: "South Africa", us: "United States", uk: "United Kingdom" };

// Platform set per category (alcohol excludes TikTok for regulatory reasons).
function platsForCategory(category) {
  return category === "alcohol"
    ? ["Facebook", "Instagram", "X", "Website"]
    : ["Facebook", "Instagram", "X", "TikTok", "Website"];
}

// ── The Signal analysis methodology. Lives server-side ONLY — never shipped
//    to the browser, so the playbook can't be lifted from client source. ──
function buildAnalyzePrompt(p) {
  const mkt = MARKET_LABEL[p.market] || "South Africa";
  const monthName = MONTHS[p.month] || "";
  const plats = platsForCategory(p.category);
  const socialPlats = plats.filter((x) => x !== "Website");
  const hasTikTok = plats.includes("TikTok");
  const clientLabel = p.clientLabel || p.category || "";

  const handles = [
    p.ig     && `Instagram: ${p.ig}`,
    p.fb     && `Facebook: ${p.fb}`,
    p.x      && `X/Twitter: ${p.x}`,
    p.tiktok && hasTikTok && `TikTok: ${p.tiktok}`,
    p.web    && `Website: ${p.web}`,
  ].filter(Boolean).join("\n");

  const signalInstruction = p.signalKeyword
    ? `\n10. SIGNAL DETECTION — Search specifically for any content by ${p.name} related to the keyword/theme "${p.signalKeyword}" during ${monthName} ${p.year} (e.g. new product launch, flavour, campaign, collab). Set signalMatch:true if found, signalNote to a 1-2 sentence description, and signalLink to the URL of the specific post or article where it was found. If not found, signalMatch:false, signalNote:"No matching content found.", signalLink:"".`
    : "";

  const snapshotRows = plats.map((pl) =>
    `    {"platform":"${pl}","role":"Primary|Light|Inactive","comment":"<=4 words"}`).join(",\n");
  const freqRow = socialPlats.map((pl) => `"${pl}":<est. posts/month>`).join(",");

  return `You are a senior brand strategist at John Joseph building a monthly competitor intelligence report for the ${mkt} market (category: ${clientLabel}).

Use Google Search to research the competitor brand "${p.name}" in the ${mkt} market.
${handles ? `Search these channels for recent activity:\n${handles}` : ""}
Reporting period: ${monthName} ${p.year}.

Search for:
1. Platform activity and posting patterns on ${plats.join(", ")}${hasTikTok ? ". If the brand has no TikTok presence, set its TikTok role to Inactive with comment \"No TikTok presence\"" : ""}
2. Recent campaigns, promotions, or product launches in ${mkt}
3. Content themes and creative direction
4. Audience sentiment and engagement signals
5. A 2-sentence executive summary of their overall ${monthName} ${p.year} strategy
6. 2-3 key active campaigns (name + one-sentence description each)
7. One representative content example: date, platform, format, short caption excerpt, estimated engagement, visual description
8. Multi-dimensional creative effectiveness scores 1-10: platformNative, culturalRelevance, visualDistinctiveness, strategicClarity, engagementPotential
9. One sentence on their biggest whitespace/missed opportunity this period, and one sentence strategic recommendation${signalInstruction}

Begin with a 2-3 sentence strategic insight (plain text paragraph, no headers).
IMPORTANT: In the strategic insight AND the executiveSummary, wrap every key activity — campaign names, event names, sponsorships, product launches, collabs (e.g. **Surprisingly Good Sets**, **LIV Golf**, **FIFA World Cup**) — in **double asterisks** so they can be highlighted. Use them on the 2-5 most important named activities only.

Then output EXACTLY this block:

<chart_data>
{
  "snapshot":[
${snapshotRows}
  ],
  "themes":{"Promotions":<0-100>,"Product":<0-100>,"Serves":<0-100>,"Seasonal":<0-100>,"Lifestyle":<0-100>},
  "sentiment":{"positive":<0-100>,"neutral":<0-100>,"negative":<0-100>},
  "postFrequency":{${freqRow}},
  "effectivenessScore":<1.0-10.0>,
  "executiveSummary":"2-3 sentence paragraph on their overall strategy this period",
  "keyCampaigns":[{"title":"Campaign name","description":"One sentence description"}],
  "contentSnapshot":{"date":"DD Month YYYY","platform":"Instagram|Facebook|X","format":"Reel|Video|Static|Text","caption":"Short caption excerpt...","engagement":"e.g. 8.5K likes, 320 comments","visual":"Brief description of the visual"},
  "creativeScores":{"platformNative":<1-10>,"culturalRelevance":<1-10>,"visualDistinctiveness":<1-10>,"strategicClarity":<1-10>,"engagementPotential":<1-10>},
  "whitespace":"One sentence on their biggest missed opportunity",
  "recommendations":"One sentence action recommendation for ${clientLabel} to exploit",
  "signalMatch":<true|false>,
  "signalNote":"Description of signal match OR No matching content found.",
  "signalLink":"URL of the post/article where the signal was found, or empty string"
}
</chart_data>

RULES:
- role = how central that platform is to their brand strategy (Primary/Light/Inactive)
- comment = terse 1-4 word descriptor
- theme values = relative content pillar weight, highest ~85; use real data
- sentiment positive+neutral+negative must sum to exactly 100
- effectivenessScore = overall creative effectiveness 1.0–10.0
- creativeScores = integer 1-10 each dimension
- Base all values on real search results; use informed estimates where search data is incomplete`;
}

// Human category phrasing for the suggest prompt.
const CAT_WORD = {
  alcohol: "alcohol / beverage", qsr: "quick-service restaurant", retail: "retail",
  telecoms: "telecommunications", beauty: "beauty & cosmetics", skincare: "skincare", haircare: "haircare",
};

// Competitor-discovery prompt — market- and category-aware (server-side only).
function buildSuggestPrompt(p) {
  const mkt = MARKET_LABEL[p.market] || "South Africa";
  const cat = CAT_WORD[p.category] || p.category || "consumer";
  const named = p.name && p.name.toLowerCase() !== cat.toLowerCase();
  return `Use Google Search to find the 4 most important, currently-active ${cat} brands competing in the ${mkt} market${named ? ` — direct competitors to "${p.name}"` : ""}.
Return STRICT JSON only — no prose, no markdown:
{"competitors":[{"name":"Brand","note":"3-5 word positioning","ig":"https://instagram.com/handle"}]}
Exactly 4 real ${cat} brands active in ${mkt}. Include each brand's real Instagram URL if findable.`;
}

// Period-over-period social audit prompt (server-side only).
function buildAuditPrompt(p) {
  const mkt = MARKET_LABEL[p.market] || "South Africa";
  const fromLbl = `${MONTHS[p.fromMonth] || ""} ${p.fromYear}`;
  const toLbl   = `${MONTHS[p.toMonth] || ""} ${p.toYear}`;
  return `You are a senior brand strategist building a period-over-period social media audit for the ${mkt} market.

Use Google Search to research the brand "${p.name}" in ${mkt} across the period ${fromLbl} to ${toLbl} (inclusive).

For EACH month in the range, find: the dominant campaign or activity, key content themes, and any notable launches, sponsorships or events.
In every summary, wrap key activity names (campaigns, events, launches, collabs) in **double asterisks**.

Output EXACTLY this block (one entry per month, in chronological order):

<chart_data>
{
  "timeline":[
    {"month":"Month YYYY","headline":"<=8 word headline of the month's focus","summary":"2 sentence summary with **key activities** marked","activityLevel":<1-10>}
  ],
  "trend":"2-3 sentence overall trend analysis across the period, with **key activities** marked"
}
</chart_data>

RULES:
- activityLevel = posting/campaign intensity that month, 1-10
- Base on real search results; use informed estimates where data is incomplete`;
}

// Pull emails from a sheet tab's column A (lowercased, only rows with "@").
// Returns null if it can't be read (treated as "no list configured").
async function fetchEmailTab(tab) {
  try {
    const r = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const txt = await r.text();
    return txt
      .split(/\r?\n/)
      .map((line) => (line.split(",")[0] || "").replace(/^"|"$/g, "").trim().toLowerCase())
      .filter((e) => e.includes("@"));
  } catch {
    return null;
  }
}
const fetchAllowlist = () => fetchEmailTab("Allowlist");  // free invite-only beta
const fetchProList  = () => fetchEmailTab("Pro");          // paying customers

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured — GEMINI_API_KEY is missing." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = ((body && body.email) || "").toLowerCase().trim();
  /* Preferred paths build the prompt server-side from structured params, so the
     methodology never leaves the server. Legacy path: a raw prompt (suggest). */
  const prompt =
    (body && body.params)  ? buildAnalyzePrompt(body.params) :
    (body && body.audit)   ? buildAuditPrompt(body.audit) :
    (body && body.suggest) ? buildSuggestPrompt(body.suggest) :
    (body && body.prompt);
  if (!prompt) return res.status(400).json({ error: "Missing params or prompt." });

  // Access gate: paying Pro customers bypass the invite-only beta allowlist.
  // Enforced only if an allowlist exists and has entries (else "open").
  const [allow, pro] = await Promise.all([fetchAllowlist(), fetchProList()]);
  const isPro = !!(pro && email && pro.includes(email));
  if (!isPro && allow && allow.length) {
    if (!email || !allow.includes(email)) {
      return res.status(403).json({ error: "not_allowed: This account isn't on the Signal beta list yet. Upgrade to Pro for instant access." });
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
