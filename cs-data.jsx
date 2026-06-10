/* ============================================================
   DATA + AI + PDF — Brand Window template
   John Joseph · Strategy Intelligence
   Source: Competitor Social Media Tracker (Google Sheet)
   ============================================================ */

const BRANDS = {
  amarula: { key: 'amarula', name: 'Amarula', color: '#C8860A', cat: 'Cream Liqueur' },
  bernini: { key: 'bernini', name: 'Bernini', color: '#4A7FB5', cat: 'Sparkling Grape Beverage' },
  hunters: { key: 'hunters', name: 'Hunters', color: '#2E6B2F', cat: 'Cider' },
};
const BRAND_ORDER = ['hunters', 'amarula', 'bernini'];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const THEME_LABELS = ["Promotions", "Product", "Serves", "Seasonal", "Lifestyle"];
const PLATS = ["Facebook", "Instagram", "X"];

/* ---- Google Sheet tab names ---- */
const SHEET_ID = "1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF";
const SHEET_TABS = {
  hunters: "Hunters Competitor Links",
  amarula: "Amarula Competitor Links",
  bernini: "Bernini Competitor Links",
};

/* parseCSV: handles quoted fields with commas */
function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  for (const line of lines) {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

/* gid known → use export CSV (clean output); no gid → gviz by sheet name */
const SHEET_GIDS = {
  hunters: "1889059569",
  amarula: null,          /* use gviz by name — gid not yet resolved */
  bernini: "2060771197",
};

async function fetchSheetTab(brandSel, filterMonth, filterYear) {
  const tabName = SHEET_TABS[brandSel];
  if (!tabName) throw new Error("Unknown brand: " + brandSel);
  const gid = SHEET_GIDS[brandSel];
  const url = gid
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
  const text = await res.text();
  const rows = parseCSV(text);
  /* Find header row (contains "Brand Name"), skip it and everything before it */
  const hIdx = rows.findIndex(r => (r[0] || "").replace(/^"|"$/g, "").trim().toLowerCase() === "brand name");
  const dataRows = hIdx >= 0 ? rows.slice(hIdx + 1) : rows.slice(1);

  /* Filter by Reporting Month column (index 7) if month/year provided */
  const targetMonth = (filterMonth !== undefined && filterYear !== undefined)
    ? `${MONTHS[filterMonth]} ${filterYear}`.toLowerCase()
    : null;

  return dataRows
    .filter(r => r[0] && r[0].replace(/^"|"$/g, "").trim())
    .filter(r => {
      if (!targetMonth) return true;
      const rm = (r[7] || "").replace(/^"|"$/g, "").trim().toLowerCase();
      return !rm || rm === targetMonth; /* include rows with no month set OR exact match */
    })
    .map(r => ({
      name: r[0].replace(/^"|"$/g, "").trim(),
      fb:   (r[1] || "").replace(/^"|"$/g, "").trim(),
      ig:   (r[2] || "").replace(/^"|"$/g, "").trim(),
      x:    (r[3] || "").replace(/^"|"$/g, "").trim(),
      web:  (r[4] || "").replace(/^"|"$/g, "").trim(),
    }));
}

/* in-memory cache so switching back doesn't re-fetch */
const _sheetCache = {};

async function loadSheetCompetitors(brandSel, colors, month, year) {
  const cacheKey = `${brandSel}-${month}-${year}`;
  if (_sheetCache[cacheKey]) return _sheetCache[cacheKey];
  const raw = await fetchSheetTab(brandSel, month, year);
  const cards = raw.map(c => freshCard(c, colors[brandSel], brandSel, "synced"));
  _sheetCache[cacheKey] = cards;
  return cards;
}

function invalidateSheetCache(brandSel) {
  if (brandSel) delete _sheetCache[brandSel];
  else Object.keys(_sheetCache).forEach(k => delete _sheetCache[k]);
}

function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function deriveHandle(c) {
  const src = c.ig || c.fb || c.x || "";
  const m = src.match(/(?:instagram|facebook|x|twitter)\.com\/([^\/?#]+)/i);
  if (m && m[1]) return "@" + m[1].replace(/^@/, "");
  return "@" + slugify(c.name).replace(/-/g, "");
}

function freshCard(c, color, parent, sourceTag) {
  return {
    name: c.name, fb: c.fb || "", ig: c.ig || "", x: c.x || "", web: c.web || "",
    handle: deriveHandle(c), note: c.note || "",
    color, parent, source: sourceTag || "synced",
    snapshot: PLATS.map((p) => ({ platform: p, role: "", comment: "" })),
    themes: THEME_LABELS.map((l) => ({ label: l, value: 0 })),
    insight: "",
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    postFrequency: { Facebook: 0, Instagram: 0, X: 0 },
    effectivenessScore: null,
    /* --- extended report fields --- */
    executiveSummary: "",
    keyCampaigns: [],
    contentSnapshot: null,
    creativeScores: null,
    whitespace: "",
    recommendations: "",
    signalMatch: false,
    signalNote: "",
    posts: ["", "", "", "", "", ""],
    analyzing: false, analyzed: false,
  };
}

/* role → dot class + active state */
function roleClass(role) {
  const r = (role || "").toLowerCase();
  if (r === "primary") return "primary";
  if (r === "light") return "light";
  return "inactive";
}
function isActive(role) { return (role || "").toLowerCase() === "primary"; }

/* ============================================================
   GEMINI — proxy at localhost:4323 (preferred, Google Search grounded)
             falls back to direct browser call when proxy not running
   ============================================================ */
const PROXY        = "http://localhost:4323";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
/* Shared department key — teammates don't need to enter anything */
const DEFAULT_KEY  = "AIzaSyC6H-NlF4VMYFBhe4pTbohPx4TPOpUo6ZA";

/* Check if the proxy is alive (fast, no throws) */
async function proxyAlive() {
  try {
    const r = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch { return false; }
}

/* Direct browser call to Gemini with auto-retry on 429/503 */
async function callGeminiBrowser(prompt, apiKey, attempt = 0) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tools: [{ google_search: {} }],
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  /* Retry on overload / rate-limit errors */
  if (res.status === 503 && attempt < 3) {
    const wait = (attempt + 1) * 10000; /* 10s, 20s, 30s — transient overload */
    console.info(`[Gemini] 503 overload — retrying in ${wait/1000}s (attempt ${attempt+1}/3)`);
    await new Promise(r => setTimeout(r, wait));
    return callGeminiBrowser(prompt, apiKey, attempt + 1);
  }
  if (res.status === 429 && attempt < 1) {
    /* One retry after 70s — covers per-minute RPM reset. If it fails again the quota is daily-exhausted. */
    const wait = 70000;
    console.info(`[Gemini] 429 — retrying once in ${wait/1000}s`);
    if (window.__onAnalyzeStatus) window.__onAnalyzeStatus("High demand — giving it a moment before retrying…");
    await new Promise(r => setTimeout(r, wait));
    return callGeminiBrowser(prompt, apiKey, attempt + 1);
  }
  if (res.status === 429) {
    /* Second 429 = daily quota exhausted, no point retrying */
    if (window.__onAnalyzeStatus) window.__onAnalyzeStatus("Intelligence engine at capacity — will reset overnight.");
    throw new Error("quota_exceeded: Daily API quota reached. Analysis will resume when the key resets (typically midnight PT). You can still export slide PDFs with the data already loaded.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Gemini error ${res.status}`;
    if (res.status === 429) throw new Error("quota_exceeded: " + msg);
    throw new Error(msg);
  }
  const data = await res.json();
  /* Grounded responses include functionCall/functionResponse parts alongside text — only join text parts */
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason || "No candidate returned";
    throw new Error(`Gemini blocked: ${reason}`);
  }
  const parts = candidate.content?.parts || [];
  const text = parts.filter(p => typeof p.text === "string").map(p => p.text).join("");
  if (!text && attempt < 2) {
    /* Empty text with grounding occasionally happens on first call — retry once */
    console.info("[Gemini] Empty response — retrying");
    await new Promise(r => setTimeout(r, 3000));
    return callGeminiBrowser(prompt, apiKey, attempt + 1);
  }
  return text;
}

/* Primary entry point — proxy when available, direct fallback otherwise */
async function callGemini(prompt, apiKey) {
  const key = apiKey || DEFAULT_KEY;   /* use shared dept key if none entered */
  if (await proxyAlive()) {
    const res = await fetch(`${PROXY}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, apiKey: key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Proxy error ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  }
  /* Proxy not running — call Gemini directly from the browser */
  console.info("[Gemini] Proxy offline — using direct browser call (no full grounding)");
  return callGeminiBrowser(prompt, key);
}

/* Parse the <chart_data>…</chart_data> block from Gemini's dual-format output */
function parseChartData(text) {
  if (!text) return null;
  const m = text.match(/<chart_data>([\s\S]*?)<\/chart_data>/i);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch (e) { return null; }
}

/* Extract the strategic insight paragraph (everything outside the <chart_data> block) */
function parseInsight(text) {
  if (!text) return "";
  return text.replace(/<chart_data>[\s\S]*?<\/chart_data>/gi, "").replace(/```[\s\S]*?```/g, "").trim();
}

/* ---- analyzeWindow: grounded brand window analysis ---- */
async function analyzeWindow(card, clientLabel, month, year, apiKey, signalKeyword) {
  const handles = [
    card.ig  && `Instagram: ${card.ig}`,
    card.fb  && `Facebook: ${card.fb}`,
    card.x   && `X/Twitter: ${card.x}`,
    card.web && `Website: ${card.web}`,
  ].filter(Boolean).join("\n");

  const signalInstruction = signalKeyword
    ? `\n10. SIGNAL DETECTION — Search specifically for any content by ${card.name} related to the keyword/theme "${signalKeyword}" during ${MONTHS[month]} ${year} (e.g. new product launch, flavour, campaign, collab). Set signalMatch:true if found and signalNote to a 1-2 sentence description. If not found, signalMatch:false and signalNote:"No matching content found."`
    : "";

  const prompt =
`You are a senior brand strategist at John Joseph building a monthly competitor intelligence report for the South African alcohol brand "${clientLabel}".

Use Google Search to research the competitor brand "${card.name}" in the South African market.
${handles ? `Search these channels for recent activity:\n${handles}` : ""}
Reporting period: ${MONTHS[month]} ${year}.

Search for:
1. Platform activity and posting patterns on Facebook, Instagram, and X
2. Recent campaigns, promotions, or product launches in South Africa
3. Content themes and creative direction
4. Audience sentiment and engagement signals
5. A 2-sentence executive summary of their overall ${MONTHS[month]} ${year} strategy
6. 2-3 key active campaigns (name + one-sentence description each)
7. One representative content example: date, platform, format, short caption excerpt, estimated engagement, visual description
8. Multi-dimensional creative effectiveness scores 1-10: platformNative, culturalRelevance, visualDistinctiveness, strategicClarity, engagementPotential
9. One sentence on their biggest whitespace/missed opportunity this period, and one sentence strategic recommendation${signalInstruction}

Begin with a 2-3 sentence strategic insight (plain text paragraph, no headers).

Then output EXACTLY this block:

<chart_data>
{
  "snapshot":[
    {"platform":"Facebook","role":"Primary|Light|Inactive","comment":"<=4 words"},
    {"platform":"Instagram","role":"Primary|Light|Inactive","comment":"<=4 words"},
    {"platform":"X","role":"Primary|Light|Inactive","comment":"<=4 words"}
  ],
  "themes":{"Promotions":<0-100>,"Product":<0-100>,"Serves":<0-100>,"Seasonal":<0-100>,"Lifestyle":<0-100>},
  "sentiment":{"positive":<0-100>,"neutral":<0-100>,"negative":<0-100>},
  "postFrequency":{"Facebook":<est. posts/month>,"Instagram":<est. posts/month>,"X":<est. posts/month>},
  "effectivenessScore":<1.0-10.0>,
  "executiveSummary":"2-3 sentence paragraph on their overall strategy this period",
  "keyCampaigns":[{"title":"Campaign name","description":"One sentence description"}],
  "contentSnapshot":{"date":"DD Month YYYY","platform":"Instagram|Facebook|X","format":"Reel|Video|Static|Text","caption":"Short caption excerpt...","engagement":"e.g. 8.5K likes, 320 comments","visual":"Brief description of the visual"},
  "creativeScores":{"platformNative":<1-10>,"culturalRelevance":<1-10>,"visualDistinctiveness":<1-10>,"strategicClarity":<1-10>,"engagementPotential":<1-10>},
  "whitespace":"One sentence on their biggest missed opportunity",
  "recommendations":"One sentence action recommendation for ${clientLabel} to exploit",
  "signalMatch":<true|false>,
  "signalNote":"Description of signal match OR No matching content found."
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

  let raw = await callGemini(prompt, apiKey);
  let cd  = parseChartData(raw);
  if (!cd) {
    /* One automatic retry — grounding sometimes returns partial output on first call */
    console.info("[analyzeWindow] No chart_data — retrying once");
    await new Promise(r => setTimeout(r, 4000));
    raw = await callGemini(prompt, apiKey);
    cd  = parseChartData(raw);
  }
  if (!cd) throw new Error("No <chart_data> block in Gemini response.");

  const byPlat = {};
  (cd.snapshot || []).forEach(s => { if (s?.platform) byPlat[s.platform.toLowerCase()] = s; });
  const snapshot = PLATS.map(p => {
    const s = byPlat[p.toLowerCase()] || {};
    return { platform: p, role: titleRole(s.role), comment: String(s.comment || "").slice(0, 40) };
  });
  const tv = cd.themes || {};
  const themes = THEME_LABELS.map(l => ({ label: l, value: clampPct(tv[l]) }));

  const rawSent = cd.sentiment || {};
  const sentiment = {
    positive: clampPct(rawSent.positive),
    neutral:  clampPct(rawSent.neutral),
    negative: clampPct(rawSent.negative),
  };
  const postFrequency = {
    Facebook:  Math.max(0, Math.round(Number(cd.postFrequency?.Facebook)  || 0)),
    Instagram: Math.max(0, Math.round(Number(cd.postFrequency?.Instagram) || 0)),
    X:         Math.max(0, Math.round(Number(cd.postFrequency?.X)         || 0)),
  };
  const effectivenessScore = cd.effectivenessScore
    ? Math.min(10, Math.max(0, Math.round(Number(cd.effectivenessScore) * 10) / 10))
    : null;
  const insight = parseInsight(raw);

  /* Extended fields */
  const executiveSummary = String(cd.executiveSummary || "").trim();
  const keyCampaigns = Array.isArray(cd.keyCampaigns) ? cd.keyCampaigns.slice(0, 3) : [];
  const contentSnapshot = cd.contentSnapshot && typeof cd.contentSnapshot === "object" ? cd.contentSnapshot : null;
  const rawCS = cd.creativeScores || {};
  const creativeScores = {
    platformNative:        Math.min(10, Math.max(1, Math.round(Number(rawCS.platformNative)        || 5))),
    culturalRelevance:     Math.min(10, Math.max(1, Math.round(Number(rawCS.culturalRelevance)     || 5))),
    visualDistinctiveness: Math.min(10, Math.max(1, Math.round(Number(rawCS.visualDistinctiveness) || 5))),
    strategicClarity:      Math.min(10, Math.max(1, Math.round(Number(rawCS.strategicClarity)      || 5))),
    engagementPotential:   Math.min(10, Math.max(1, Math.round(Number(rawCS.engagementPotential)   || 5))),
  };
  const whitespace = String(cd.whitespace || "").trim();
  const recommendations = String(cd.recommendations || "").trim();
  const signalMatch = cd.signalMatch === true || String(cd.signalMatch).toLowerCase() === "true";
  const signalNote  = String(cd.signalNote || "").trim();

  return {
    snapshot, themes, insight, sentiment, postFrequency, effectivenessScore,
    executiveSummary, keyCampaigns, contentSnapshot, creativeScores,
    whitespace, recommendations, signalMatch, signalNote,
  };
}

function titleRole(r) {
  const v = (r || "").toLowerCase();
  if (v === "primary") return "Primary";
  if (v === "light")   return "Light";
  if (v === "inactive" || v === "none") return "Inactive";
  return "Light";
}
function clampPct(n) { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0; }

/* ---- suggestCompetitors: grounded competitor discovery ---- */
async function suggestCompetitors(clientLabel, category, apiKey) {
  const prompt =
`Search for and list the 4 most important South African market competitors for the alcohol brand "${clientLabel}" (category: ${category}).
Use Google Search to find real, currently active brands competing in this category in South Africa.
Return STRICT JSON only — no prose, no markdown:
{"competitors":[{"name":"Brand","note":"3-5 word positioning","ig":"https://instagram.com/handle"}]}
Exactly 4 real competing brands. Include their actual Instagram URL if findable.`;
  const raw = await callGemini(prompt, apiKey);
  /* suggestCompetitors returns plain JSON, not dual-format */
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
  const out = JSON.parse(s);
  if (!out || !Array.isArray(out.competitors)) throw new Error("Bad AI response");
  return out.competitors.slice(0, 4);
}

/* ---------- PowerPoint handoff prompt ---------- */
function buildPrompt(state) {
  const period = `${MONTHS[state.month]} ${state.year}`;
  const lines = [];
  lines.push(`Build a competitor "brand window" deck for ${state.brandLabel} — ${period}. One landscape page per competitor.`);
  lines.push(``);
  lines.push(`CONTEXT: Monthly social intelligence by John Joseph for the ${state.brandLabel} brand team. Light-blue field, white cards, navy Playfair headings, coral accents. Source: Competitor Social Media Tracker.`);
  lines.push(``);
  state.cards.forEach((c, i) => {
    const pg = String(i + 1).padStart(2, "0");
    lines.push(`PAGE ${pg} — ${c.name} (${c.handle}):`);
    const snaps = c.snapshot.filter((s) => s.role || s.comment);
    if (snaps.length) lines.push(`  Social snapshot — ${snaps.map((s) => `${s.platform}: ${s.role || "—"}${s.comment ? " (" + s.comment + ")" : ""}`).join("; ")}`);
    const th = c.themes.filter((t) => t.value > 0).sort((a, b) => b.value - a.value);
    if (th.length) lines.push(`  Content themes — ${th.map((t) => `${t.label} ${t.value}%`).join(", ")}`);
    lines.push(`  Social creative — 6 reference posts from their feed.`);
  });
  return lines.join("\n");
}

/* ============================================================
   PDF — one landscape page per competitor (vector)
   ============================================================ */
async function generatePDF(state) {
  const { jsPDF } = window.jspdf;
  const PW = 1380, PH = 781;
  const doc = new jsPDF({ unit: "pt", format: [PW, PH], orientation: "landscape" });

  const field = [169, 203, 231], navy = [26, 58, 92], navy2 = [44, 77, 114];
  const coral = [232, 156, 130], muted = [124, 149, 174], track = [220, 231, 242], white = [255, 255, 255];
  const brandRGB = hexToRgb(state.brandColor);
  const PAD = 42;

  state.cards.forEach((card, idx) => {
    if (idx > 0) doc.addPage([PW, PH], "landscape");
    doc.setFillColor(...field); doc.rect(0, 0, PW, PH, "F");

    // eyebrow
    doc.setFont("courier", "bold"); doc.setFontSize(11); doc.setTextColor(111, 147, 184);
    doc.text(`COMPETITOR SNAPSHOT  ·  ${String(idx + 1).padStart(2, "0")} / ${String(state.cards.length).padStart(2, "0")}`, PAD, 50);
    doc.text("ACTIVE ON", PW - PAD, 50, { align: "right" });

    // logo circle
    doc.setFillColor(234, 242, 250); doc.circle(PAD + 44, 112, 40, "F");
    doc.setDrawColor(94, 130, 171); doc.setLineWidth(1.2); doc.circle(PAD + 44, 112, 40, "S");
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text("LOGO", PAD + 44, 114, { align: "center" });

    // name + sub
    doc.setFont("times", "bold"); doc.setFontSize(40); doc.setTextColor(...navy);
    doc.text(card.name, PAD + 104, 122);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(93, 125, 160);
    doc.text("SOCIAL PRESENCE & CREATIVE", PAD + 106, 144);

    // active-on chips
    let ax = PW - PAD - 36;
    [...card.snapshot].reverse().forEach((s) => {
      const active = isActive(s.role);
      doc.setFillColor(...(active ? platBrand(s.platform) : [180, 198, 217]));
      roundRect(doc, ax, 70, 36, 36, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
      doc.text(platGlyph(s.platform), ax + 18, 93, { align: "center" });
      ax -= 47;
    });

    const bodyTop = 180, colL = PAD, colLW = 452, colR = colL + colLW + 30, colRW = PW - PAD - colR;

    // ---- SOCIAL SNAPSHOT card ----
    const snapH = 250;
    card_bg(doc, colL, bodyTop, colLW, snapH, white);
    cardHead(doc, colL + 24, bodyTop + 34, "SOCIAL SNAPSHOT", coral, navy);
    // table header
    const tx = colL + 24, tw = colLW - 48; let ty = bodyTop + 56;
    doc.setFillColor(...navy); roundRect(doc, tx, ty, tw, 30, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(207, 224, 240);
    doc.text("PLATFORM", tx + 14, ty + 19);
    doc.text("ROLE", tx + tw * 0.42, ty + 19);
    doc.text("COMMENT", tx + tw * 0.62, ty + 19);
    ty += 30;
    card.snapshot.forEach((s) => {
      const ry = ty + 30;
      doc.setFillColor(...platBrand(s.platform)); roundRect(doc, tx + 4, ry - 13, 20, 20, 5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      doc.text(platGlyph(s.platform), tx + 14, ry + 1, { align: "center" });
      doc.setFontSize(12); doc.setTextColor(...navy);
      doc.text(s.platform, tx + 32, ry + 1);
      // role
      const rc = roleClass(s.role);
      const rdot = rc === "primary" ? navy : (rc === "light" ? [156, 177, 199] : [203, 216, 229]);
      doc.setFillColor(...rdot); doc.circle(tx + tw * 0.42 + 3, ry - 3, 3.4, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...(rc === "inactive" ? muted : navy2));
      doc.text(s.role || "—", tx + tw * 0.42 + 13, ry + 1);
      // comment
      doc.setTextColor(...muted); doc.setFontSize(11);
      doc.text(s.comment || "—", tx + tw * 0.62, ry + 1);
      doc.setDrawColor(234, 240, 246); doc.setLineWidth(1); doc.line(tx, ty + 44, tx + tw, ty + 44);
      ty += 44;
    });

    // ---- KEY CONTENT THEMES card ----
    const thTop = bodyTop + snapH + 24, thH = PH - thTop - 70;
    card_bg(doc, colL, thTop, colLW, thH, white);
    cardHead(doc, colL + 24, thTop + 34, "KEY CONTENT THEMES", coral, navy);
    let by = thTop + 64; const barX = colL + 130, barW = colLW - 130 - 28;
    const maxV = Math.max(1, ...card.themes.map((t) => t.value));
    card.themes.forEach((t) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...navy2);
      doc.text(t.label.toUpperCase(), barX - 12, by + 4, { align: "right" });
      doc.setFillColor(...track); roundRect(doc, barX, by - 5, barW, 11, 5.5, "F");
      const w = Math.max(6, barW * (t.value / 100));
      const top = t.label === "Promotions";
      doc.setFillColor(...(top ? coral : navy));
      roundRect(doc, barX, by - 5, w, 11, 5.5, "F");
      by += (thH - 76) / card.themes.length;
    });

    // ---- SOCIAL CREATIVE card ----
    const crH = PH - bodyTop - 70;
    card_bg(doc, colR, bodyTop, colRW, crH, white);
    cardHead(doc, colR + 24, bodyTop + 34, "SOCIAL CREATIVE", coral, navy);
    doc.setFillColor(234, 242, 250); doc.circle(colR + 36, bodyTop + 62, 14, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...navy);
    doc.text(card.handle, colR + 60, bodyTop + 60);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...muted);
    doc.text("Drop creative from their feed into the slots below", colR + 60, bodyTop + 74);
    // 3x2 grid
    const gx = colR + 24, gy = bodyTop + 92, gw = colRW - 48, gh = crH - 92 - 22;
    const cols = 3, rows = 2, gap = 16;
    const cw = (gw - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = gx + c * (cw + gap), yy = gy + r * (ch + gap);
      doc.setFillColor(195, 216, 236); roundRect(doc, x, yy, cw, ch, 12, "F");
      doc.setDrawColor(94, 130, 171); doc.setLineWidth(1.4);
      dashedRoundRect(doc, x, yy, cw, ch, 12);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(90, 118, 150);
      doc.text("Post", x + cw / 2, yy + ch / 2 + 4, { align: "center" });
    }

    // footer
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(93, 125, 160);
    doc.text("J O H N   J O S E P H", PW / 2, PH - 34, { align: "center" });
    doc.setFontSize(10); doc.setTextColor(...hexToRgb("#DE8568"));
    doc.text(`${state.brandLabel.toUpperCase()} BRAND`, PW - PAD, PH - 42, { align: "right" });
    doc.text(`WINDOW ${state.year}`, PW - PAD, PH - 30, { align: "right" });
  });

  const fname = `Brand-Window_${state.brandLabel.replace(/[^A-Za-z]+/g, "-")}_${MONTHS[state.month]}-${state.year}.pdf`;
  doc.save(fname);
  return fname;
}

/* pdf helpers */
function card_bg(doc, x, y, w, h, rgb) { doc.setFillColor(...rgb); roundRect(doc, x, y, w, h, 16, "F"); }
function cardHead(doc, x, y, label, coral, navy) {
  doc.setFillColor(...coral); doc.circle(x + 4, y - 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...navy);
  doc.text(label, x + 16, y);
}
function platBrand(p) {
  const v = p.toLowerCase();
  if (v === "facebook") return [24, 119, 242];
  if (v === "instagram") return [43, 58, 83];
  return [21, 23, 26]; // X
}
function platGlyph(p) {
  const v = p.toLowerCase();
  if (v === "facebook") return "f";
  if (v === "instagram") return "@";
  return "X";
}
function hexToRgb(hex) { const h = hex.replace("#", ""); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function roundRect(doc, x, y, w, h, r, style) { if (doc.roundedRect) doc.roundedRect(x, y, w, h, r, r, style); else doc.rect(x, y, w, h, style); }
function dashedRoundRect(doc, x, y, w, h, r) {
  if (doc.setLineDash) { doc.setLineDash([4, 4], 0); roundRect(doc, x, y, w, h, r, "S"); doc.setLineDash([], 0); }
  else roundRect(doc, x, y, w, h, r, "S");
}

/* ============================================================
   INTELLIGENCE REPORT PDF — portrait A4, full written analysis
   ============================================================ */
async function generateReport(state) {
  const { jsPDF } = window.jspdf;
  const PW = 595, PH = 842;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const navy  = [26, 58, 92],  navy2 = [44, 77, 114];
  const coral = [232, 156, 130], fieldBlue = [169, 203, 231];
  const white = [255, 255, 255], muted = [124, 149, 174];
  const track = [220, 231, 242], green = [82, 182, 154];
  const PAD = 40, CW = 515;
  const period = `${MONTHS[state.month]} ${state.year}`;

  /* helpers */
  const rr = (x, y, w, h, r, s) => { if (doc.roundedRect) doc.roundedRect(x, y, w, h, r, r, s); else doc.rect(x, y, w, h, s); };
  const avgScore = () => { const sc = state.cards.filter(c => c.effectivenessScore !== null); return sc.length ? (sc.reduce((a,c)=>a+c.effectivenessScore,0)/sc.length).toFixed(1) : "—"; };

  /* ── PAGE 1: COVER ── */
  doc.setFillColor(...navy); doc.rect(0, 0, PW, PH, "F");
  doc.setFillColor(...coral); doc.rect(PAD, 170, 90, 4, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...coral);
  doc.text("SOCIAL INTELLIGENCE REPORT", PAD, 152);
  doc.setFont("times","bold"); doc.setFontSize(54); doc.setTextColor(...white);
  doc.text(state.brandLabel, PAD, 240);
  doc.setFont("helvetica","normal"); doc.setFontSize(20); doc.setTextColor(169,200,230);
  doc.text("Competitive Intelligence · " + period, PAD, 274);

  /* stat trio */
  [
    { v: state.cards.length,                              l: "COMPETITORS" },
    { v: state.cards.filter(c=>c.analyzed).length,        l: "ANALYZED" },
    { v: avgScore(),                                       l: "AVG SCORE" },
  ].forEach((s, i) => {
    const sx = PAD + i * 172;
    doc.setFillColor(40, 80, 120); rr(sx, 310, 160, 76, 10, "F");
    doc.setFont("times","bold"); doc.setFontSize(36); doc.setTextColor(...white);
    doc.text(String(s.v), sx + 80, 352, { align: "center" });
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(s.l, sx + 80, 370, { align: "center" });
  });

  /* signal chip */
  if (state.signalKeyword) {
    const matches = state.cards.filter(c => c.signalMatch).map(c => c.name);
    doc.setFillColor(...coral); rr(PAD, 408, CW, 52, 10, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...navy);
    doc.text(`◉  SIGNAL: "${state.signalKeyword.toUpperCase()}"`, PAD + 16, 428);
    doc.setFontSize(9.5);
    doc.text(matches.length ? `Detected in: ${matches.join(", ")}` : "No competitor matches detected this period", PAD + 16, 447);
  }

  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(80,110,150);
  doc.text("Prepared by John Joseph  ·  Strategy Intelligence  ·  VML", PAD, PH - 54);
  doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text("CONFIDENTIAL — FOR INTERNAL STRATEGIC USE ONLY", PAD, PH - 37);

  /* ── PAGE 2: CATEGORY OVERVIEW ── */
  doc.addPage();
  doc.setFillColor(...navy); doc.rect(0, 0, PW, 76, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
  doc.text("CATEGORY OVERVIEW", PAD, 28);
  doc.setFont("times","bold"); doc.setFontSize(22); doc.setTextColor(...white);
  doc.text(`${state.brandLabel} · Competitor Landscape · ${period}`, PAD, 56);

  /* table */
  const cols = [158, 54, 62, 80, 72, 56];
  const hdrs = ["COMPETITOR","POSTS","FREQ/DAY","TOP THEME","SENTIMENT","SCORE"];
  let ty = 90;
  doc.setFillColor(...navy); doc.rect(PAD, ty, CW, 26, "F");
  let cx2 = PAD + 8;
  hdrs.forEach((h, i) => {
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(207,224,240);
    doc.text(h, cx2, ty + 17); cx2 += cols[i];
  });
  ty += 26;
  state.cards.forEach((card, i) => {
    doc.setFillColor(...(i%2===0 ? [244,249,255] : [255,255,255])); doc.rect(PAD, ty, CW, 28, "F");
    const tot = (card.postFrequency?.Facebook||0)+(card.postFrequency?.Instagram||0)+(card.postFrequency?.X||0);
    const freq = tot > 0 ? (tot/30).toFixed(1) : "—";
    const topTh = [...card.themes].sort((a,b)=>b.value-a.value)[0]?.label || "—";
    const sent = card.sentiment?.positive > card.sentiment?.negative ? "Positive" : card.sentiment?.negative > 50 ? "Negative" : "Neutral";
    const sc = card.effectivenessScore;
    const row = [card.name, tot||"—", freq, topTh, sent, sc ? sc.toFixed(1) : "—"];
    cx2 = PAD + 8;
    row.forEach((v, j) => {
      doc.setFont("helvetica", j===0?"bold":"normal"); doc.setFontSize(9.5);
      doc.setTextColor(...(j===5 && sc>=8 ? coral : navy2));
      doc.text(String(v), cx2, ty + 18); cx2 += cols[j];
    });
    doc.setDrawColor(...track); doc.setLineWidth(0.4); doc.line(PAD, ty+28, PAD+CW, ty+28);
    ty += 28;
  });

  /* combined insights */
  ty += 16;
  const combinedInsight = state.cards.filter(c=>c.insight).map(c=>c.insight).join(" ").slice(0, 420);
  if (combinedInsight) {
    doc.setFillColor(240,247,255); rr(PAD, ty, CW, 90, 8, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
    doc.text("CATEGORY INTELLIGENCE SUMMARY", PAD+14, ty+17);
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...navy2);
    const wl = doc.splitTextToSize(combinedInsight, CW-28);
    doc.text(wl.slice(0,5), PAD+14, ty+32);
  }

  /* ── PAGES 3-N: PER COMPETITOR ── */
  state.cards.forEach((card, idx) => {
    doc.addPage();

    /* header */
    doc.setFillColor(...navy); doc.rect(0, 0, PW, 76, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
    doc.text(`COMPETITOR  ${String(idx+1).padStart(2,"0")} / ${String(state.cards.length).padStart(2,"0")}`, PAD, 26);
    doc.setFont("times","bold"); doc.setFontSize(26); doc.setTextColor(...white);
    doc.text(card.name, PAD, 56);
    doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.setTextColor(140,175,210);
    doc.text(card.handle, PAD + doc.getTextWidth(card.name) + 12, 56);

    /* score badge */
    if (card.effectivenessScore !== null) {
      doc.setFillColor(...coral); rr(PW-PAD-68, 14, 68, 48, 8, "F");
      doc.setFont("times","bold"); doc.setFontSize(24); doc.setTextColor(...white);
      doc.text(card.effectivenessScore.toFixed(1), PW-PAD-34, 42, { align:"center" });
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,220,210);
      doc.text("/10", PW-PAD-34, 56, { align:"center" });
    }

    /* signal badge */
    if (card.signalMatch && state.signalKeyword) {
      doc.setFillColor(255,210,80); rr(PW-PAD-155, 18, 78, 38, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...navy);
      doc.text("◉ SIGNAL HIT", PW-PAD-116, 33, { align:"center" });
      doc.setFontSize(7);
      doc.text(`"${state.signalKeyword}"`, PW-PAD-116, 47, { align:"center" });
    }

    const BT = 86;                          /* body top */
    const C1W = 318, C2X = PAD+C1W+14, C2W = CW-C1W-14;
    let y1 = BT, y2 = BT;

    /* ---- LEFT COLUMN ---- */
    const textBlock = (title, body, bgColor, textColor, x, y, w) => {
      const lines = doc.splitTextToSize(body, w-24);
      const h = Math.max(50, lines.length * 13 + 30);
      doc.setFillColor(...bgColor); rr(x, y, w, h, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
      doc.text(title, x+12, y+15);
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...textColor);
      doc.text(lines, x+12, y+28);
      return y + h + 10;
    };

    if (card.executiveSummary) y1 = textBlock("EXECUTIVE SUMMARY", card.executiveSummary, [241,247,255], navy2, PAD, y1, C1W);
    if (card.insight) y1 = textBlock("STRATEGIC INSIGHT", card.insight, navy, [200,220,240], PAD, y1, C1W);

    /* campaigns */
    if (card.keyCampaigns?.length) {
      let campH = 22;
      card.keyCampaigns.slice(0,3).forEach(c => {
        campH += 16 + doc.splitTextToSize(c.description||"", C1W-36).length * 11 + 6;
      });
      doc.setFillColor(...white); doc.setDrawColor(...track); doc.setLineWidth(0.8);
      rr(PAD, y1, C1W, campH+8, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
      doc.text("KEY CAMPAIGNS", PAD+12, y1+15);
      let cy = y1+26;
      card.keyCampaigns.slice(0,3).forEach(c => {
        doc.setFillColor(...coral); doc.circle(PAD+17, cy+2, 3, "F");
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(...navy);
        doc.text(c.title||"", PAD+28, cy+5);
        cy += 15;
        if (c.description) {
          const dl = doc.splitTextToSize(c.description, C1W-36);
          doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...muted);
          doc.text(dl, PAD+28, cy); cy += dl.length*11 + 6;
        }
      });
      y1 += campH + 18;
    }

    /* whitespace + rec */
    const remaining1 = PH - 44 - y1;
    if (remaining1 > 70 && (card.whitespace || card.recommendations)) {
      doc.setFillColor(245,250,255); rr(PAD, y1, C1W, remaining1, 8, "F");
      let wy = y1+14;
      if (card.whitespace) {
        doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
        doc.text("WHITESPACE OPPORTUNITY", PAD+12, wy); wy += 14;
        const wl = doc.splitTextToSize(card.whitespace, C1W-24);
        doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...navy2);
        doc.text(wl, PAD+12, wy); wy += wl.length*13+10;
      }
      if (card.recommendations) {
        doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
        doc.text("RECOMMENDATION", PAD+12, wy); wy += 14;
        const rl = doc.splitTextToSize(card.recommendations, C1W-24);
        doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...navy2);
        doc.text(rl, PAD+12, wy);
      }
    }

    /* ---- RIGHT COLUMN ---- */

    /* social snapshot */
    const snapH = 32 + card.snapshot.length * 30 + 20;
    doc.setFillColor(...white); rr(C2X, y2, C2W, snapH, 8, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
    doc.text("SOCIAL SNAPSHOT", C2X+12, y2+15);
    doc.setFillColor(...navy); rr(C2X+8, y2+21, C2W-16, 20, 4, "F");
    doc.setFontSize(7); doc.setTextColor(207,224,240);
    doc.text("PLATFORM", C2X+16, y2+34); doc.text("ROLE", C2X+16+72, y2+34);
    let sy = y2+41;
    card.snapshot.forEach(s => {
      doc.setFillColor(...platBrand(s.platform)); rr(C2X+12, sy+2, 15, 15, 3, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(255,255,255);
      doc.text(platGlyph(s.platform), C2X+19.5, sy+12, { align:"center" });
      doc.setFontSize(9); doc.setTextColor(...navy);
      doc.text(s.platform, C2X+32, sy+12);
      const rc = roleClass(s.role);
      const rdot = rc==="primary"?navy:rc==="light"?[156,177,199]:[203,216,229];
      doc.setFillColor(...rdot); doc.circle(C2X+16+72+3, sy+8, 3, "F");
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...(rc==="inactive"?muted:navy2));
      doc.text(s.role||"—", C2X+16+72+10, sy+12);
      doc.setDrawColor(...track); doc.setLineWidth(0.4); doc.line(C2X+8, sy+20, C2X+C2W-8, sy+20);
      sy += 20;
    });
    y2 += snapH + 10;

    /* sentiment */
    {
      const h = 68;
      doc.setFillColor(...white); rr(C2X, y2, C2W, h, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
      doc.text("SENTIMENT INDEX", C2X+12, y2+15);
      const bx = C2X+12, bw = C2W-24, by3 = y2+22, bh = 11;
      doc.setFillColor(...track); rr(bx, by3, bw, bh, 5, "F");
      let sx3 = bx;
      if (card.sentiment?.positive>0) { const w=bw*card.sentiment.positive/100; doc.setFillColor(...green); doc.rect(sx3,by3,w,bh,"F"); sx3+=w; }
      if (card.sentiment?.neutral>0)  { const w=bw*card.sentiment.neutral/100;  doc.setFillColor(...fieldBlue); doc.rect(sx3,by3,w,bh,"F"); sx3+=w; }
      if (card.sentiment?.negative>0) { const w=bw*card.sentiment.negative/100; doc.setFillColor(...coral); doc.rect(sx3,by3,w,bh,"F"); }
      let lx = bx;
      [
        { label:`${card.sentiment?.positive||0}% Pos`, color:green },
        { label:`${card.sentiment?.neutral||0}% Neu`,  color:fieldBlue },
        { label:`${card.sentiment?.negative||0}% Neg`, color:coral },
      ].forEach(item => {
        doc.setFillColor(...item.color); doc.circle(lx+4, y2+46, 3.5, "F");
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...navy2);
        doc.text(item.label, lx+12, y2+49); lx += 72;
      });
      y2 += h + 10;
    }

    /* creative scores */
    if (card.creativeScores) {
      const dims = [
        ["platformNative","Platform Native"],["culturalRelevance","Cultural Relevance"],
        ["visualDistinctiveness","Visual Distinctiveness"],["strategicClarity","Strategic Clarity"],
        ["engagementPotential","Engagement Potential"],
      ];
      const h = 24 + dims.length * 21 + 10;
      doc.setFillColor(...white); rr(C2X, y2, C2W, h, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
      doc.text("CREATIVE EFFECTIVENESS", C2X+12, y2+15);
      let scY = y2+24;
      dims.forEach(([k, lbl]) => {
        const val = card.creativeScores[k] || 5;
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...navy2);
        doc.text(lbl, C2X+12, scY+9);
        const bx2 = C2X+12+102, bw2 = C2W-24-102-28;
        doc.setFillColor(...track); rr(bx2, scY, bw2, 10, 5, "F");
        doc.setFillColor(...(val>=8?coral:navy)); rr(bx2, scY, Math.max(6, bw2*val/10), 10, 5, "F");
        doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...navy);
        doc.text(`${val}`, C2X+C2W-16, scY+9, { align:"right" });
        scY += 21;
      });
      y2 += h + 10;
    }

    /* content snapshot */
    const rem2 = PH - 44 - y2;
    if (card.contentSnapshot && rem2 > 70) {
      const sn = card.contentSnapshot;
      const h = Math.min(rem2, 110);
      doc.setFillColor(241,247,255); rr(C2X, y2, C2W, h, 8, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
      doc.text("CONTENT SNAPSHOT", C2X+12, y2+15);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text(`${sn.date||""} · ${sn.platform||""} · ${sn.format||""}`, C2X+12, y2+27);
      if (sn.caption) {
        const cl = doc.splitTextToSize(`"${sn.caption}"`, C2W-24);
        doc.setFontSize(9); doc.setTextColor(...navy2);
        doc.text(cl.slice(0,3), C2X+12, y2+40);
      }
      if (sn.engagement) {
        doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...navy);
        doc.text(`↑ ${sn.engagement}`, C2X+12, y2+h-12);
      }
    }

    /* footer */
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...muted);
    doc.text(card.name + " · " + period, PAD, PH-22);
    doc.text(String(idx+3), PW/2, PH-22, { align:"center" });
    doc.text("CONFIDENTIAL", PW-PAD, PH-22, { align:"right" });
  });

  /* ── SIGNAL INTELLIGENCE PAGE (if keyword + matches) ── */
  if (state.signalKeyword && state.cards.some(c => c.signalMatch)) {
    doc.addPage();
    doc.setFillColor(...navy); doc.rect(0,0,PW,76,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...coral);
    doc.text("SIGNAL INTELLIGENCE", PAD, 26);
    doc.setFont("times","bold"); doc.setFontSize(22); doc.setTextColor(...white);
    doc.text(`Keyword Signal: "${state.signalKeyword}"`, PAD, 56);

    let sy2 = 94;
    state.cards.filter(c=>c.signalMatch).forEach(card => {
      const sn = card.signalNote||"Signal match detected.";
      const snl = doc.splitTextToSize(sn, CW-40);
      const h = Math.max(72, snl.length*13+42);
      doc.setFillColor(255,248,228); rr(PAD, sy2, CW, h, 8, "F");
      doc.setFillColor(255,200,60); doc.rect(PAD, sy2, 5, h, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...navy);
      doc.text(card.name, PAD+18, sy2+22);
      if (card.effectivenessScore !== null) {
        doc.setFontSize(9); doc.setTextColor(...coral);
        doc.text(`Score ${card.effectivenessScore.toFixed(1)}/10`, PAD+18+doc.getTextWidth(card.name)+10, sy2+22);
      }
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(...navy2);
      doc.text(snl, PAD+18, sy2+38);
      sy2 += h + 12;
    });

    const noMatch = state.cards.filter(c=>!c.signalMatch);
    if (noMatch.length && sy2 < PH-80) {
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...muted);
      doc.text("NO SIGNAL DETECTED:", PAD, sy2+20);
      doc.setFont("helvetica","normal"); doc.setTextColor(...navy2);
      doc.text(noMatch.map(c=>c.name).join("  ·  "), PAD, sy2+36);
    }
  }

  const fname = `Intelligence-Report_${state.brandLabel.replace(/[^A-Za-z]+/g,"-")}_${MONTHS[state.month]}-${state.year}.pdf`;
  doc.save(fname);
  return fname;
}

/* ============================================================
   POWERPOINT EXPORT  (PptxGenJS)
   ============================================================ */
async function generatePPT(state) {
  const { brandLabel, brandColor, month, year, cards, signalKeyword } = state;
  const monthName = MONTHS[month] || "";
  const pptx = new PptxGenJS();

  /* ── Theme ── */
  const BG      = "0C0F16";
  const SURFACE = "1A1F2E";
  const CARD    = "1C2130";
  const ACCENT  = "FF5500";
  const TEXT1   = "EEF1F8";
  const TEXT2   = "8892A4";
  const TEXT3   = "4C5669";
  const WHITE   = "FFFFFF";

  pptx.layout = "LAYOUT_WIDE"; /* 13.33 × 7.5 in */
  pptx.author  = "John Joseph · Strategy Intelligence";
  pptx.company = "Brand Window";
  pptx.subject = `${brandLabel} Brand Window — ${monthName} ${year}`;
  pptx.title   = `${brandLabel} Competitor Intelligence`;

  const W = 13.33, H = 7.5;

  /* ── Helper: add dark background rect ── */
  const darkBg = (slide) => {
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:W, h:H, fill:{color:BG}, line:{color:BG} });
  };

  /* ── Helper: add a filled rounded rect ── */
  const card = (slide, x, y, w, h, fill=SURFACE, radius=0.12) =>
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill:{color:fill}, line:{color:"1A1F2E"}, rectRadius: radius });

  /* ── Helper: label + value text pair ── */
  const labelVal = (slide, label, val, x, y, w) => {
    slide.addText(label.toUpperCase(), { x, y, w, h:0.18, fontSize:6, bold:true, color:TEXT3, charSpacing:1.5, fontFace:"Courier New" });
    slide.addText(val, { x, y:y+0.2, w, h:0.28, fontSize:13, bold:true, color:TEXT1, fontFace:"Calibri" });
  };

  /* ── Helper: horizontal bar ── */
  const hBar = (slide, x, y, w, pct, fillColor, bgColor=SURFACE) => {
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h:0.065, fill:{color:bgColor}, line:{color:bgColor} });
    if (pct > 0) slide.addShape(pptx.ShapeType.rect, { x, y, w: w*(pct/100), h:0.065, fill:{color:fillColor}, line:{color:fillColor} });
  };

  /* ════════════════════════════════════════
     SLIDE 1 — COVER
  ════════════════════════════════════════ */
  const cover = pptx.addSlide();
  darkBg(cover);

  /* accent bar left edge */
  cover.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.06, h:H, fill:{color:ACCENT}, line:{color:ACCENT} });

  /* Brand icon circle */
  cover.addShape(pptx.ShapeType.ellipse, { x:0.5, y:2.5, w:0.8, h:0.8, fill:{color:ACCENT}, line:{color:ACCENT} });
  cover.addText("◈", { x:0.5, y:2.52, w:0.8, h:0.8, fontSize:22, color:WHITE, align:"center", fontFace:"Arial" });

  cover.addText("BRAND WINDOW", { x:1.5, y:2.42, w:8, h:0.3, fontSize:9, bold:true, color:ACCENT, charSpacing:3, fontFace:"Courier New" });
  cover.addText(`${brandLabel} Competitor Intelligence`, { x:1.5, y:2.75, w:10, h:0.85, fontSize:38, bold:true, color:TEXT1, fontFace:"Calibri", charSpacing:-0.5 });
  cover.addText(`${monthName} ${year}  ·  Powered by Gemini + Google Search`, { x:1.5, y:3.65, w:10, h:0.3, fontSize:11, color:TEXT2, fontFace:"Calibri" });

  /* Stats row */
  const analyzedCards = cards.filter(c => c.analyzed);
  const avgScore = analyzedCards.length
    ? (analyzedCards.reduce((s,c) => s + (c.effectivenessScore||0), 0) / analyzedCards.length).toFixed(1)
    : "—";
  const stats = [
    ["Competitors Tracked", cards.length.toString()],
    ["Windows Analyzed", analyzedCards.length.toString()],
    ["Avg Effectiveness", avgScore + (avgScore !== "—" ? "/10" : "")],
    ...(signalKeyword ? [["Signal Keyword", signalKeyword]] : []),
  ];
  stats.forEach(([lbl, val], i) => {
    const bx = 1.5 + i * 2.8;
    card(cover, bx, 4.5, 2.5, 0.85, CARD);
    cover.addText(lbl.toUpperCase(), { x:bx+0.18, y:4.6, w:2.2, h:0.18, fontSize:6.5, bold:true, color:TEXT3, charSpacing:1.5, fontFace:"Courier New" });
    cover.addText(val, { x:bx+0.18, y:4.78, w:2.2, h:0.4, fontSize:18, bold:true, color:TEXT1, fontFace:"Calibri" });
  });

  cover.addText(`John Joseph  ·  Strategy Intelligence  ·  ${monthName} ${year}`, {
    x:0.5, y:H-0.35, w:W-1, h:0.25, fontSize:8, color:TEXT3, fontFace:"Courier New"
  });

  /* ════════════════════════════════════════
     SLIDES 2..N — PER COMPETITOR
  ════════════════════════════════════════ */
  cards.forEach((c, idx) => {
    const slide = pptx.addSlide();
    darkBg(slide);

    /* left accent bar */
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.06, h:H, fill:{color: c.color || ACCENT}, line:{color: c.color || ACCENT} });

    /* ── Header strip ── */
    card(slide, 0.2, 0.15, W-0.4, 0.72, SURFACE);
    /* index badge */
    slide.addShape(pptx.ShapeType.roundRect, { x:0.32, y:0.24, w:0.44, h:0.26, fill:{color:ACCENT}, line:{color:ACCENT}, rectRadius:0.05 });
    slide.addText(`${String(idx+1).padStart(2,"0")}/${String(cards.length).padStart(2,"0")}`, { x:0.32, y:0.25, w:0.44, h:0.24, fontSize:7.5, bold:true, color:WHITE, align:"center", fontFace:"Courier New" });
    slide.addText(c.name, { x:0.9, y:0.2, w:6, h:0.36, fontSize:22, bold:true, color:TEXT1, fontFace:"Calibri", charSpacing:-0.3 });
    slide.addText("SOCIAL PRESENCE & CREATIVE  ·  " + monthName.toUpperCase() + " " + year, { x:0.9, y:0.57, w:7, h:0.2, fontSize:7, bold:true, color:TEXT3, charSpacing:1.5, fontFace:"Courier New" });

    /* score badge */
    if (c.effectivenessScore != null) {
      card(slide, W-2.2, 0.2, 2.0, 0.58, CARD);
      slide.addText("◎ EFFECTIVENESS", { x:W-2.1, y:0.24, w:1.9, h:0.18, fontSize:6, bold:true, color:TEXT3, charSpacing:1.2, fontFace:"Courier New" });
      slide.addText(`${c.effectivenessScore.toFixed(1)}/10`, { x:W-2.1, y:0.4, w:1.9, h:0.32, fontSize:18, bold:true, color:ACCENT, fontFace:"Calibri" });
    }

    /* ── LEFT COLUMN (x=0.2, w=4.1) ── */
    const LX = 0.2, LW = 4.1;

    /* Executive Summary */
    if (c.executiveSummary) {
      card(slide, LX, 1.05, LW, 1.1, SURFACE);
      slide.addText("EXECUTIVE SUMMARY", { x:LX+0.18, y:1.12, w:LW-0.3, h:0.2, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      slide.addText(c.executiveSummary, { x:LX+0.18, y:1.33, w:LW-0.3, h:0.72, fontSize:9.5, color:TEXT2, fontFace:"Calibri", valign:"top", wrap:true });
    }

    /* Social Snapshot */
    const snapY = c.executiveSummary ? 2.25 : 1.05;
    card(slide, LX, snapY, LW, 1.55, SURFACE);
    slide.addText("PLATFORM PRESENCE", { x:LX+0.18, y:snapY+0.12, w:LW-0.3, h:0.2, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });

    const platColors = { Facebook:"1877F2", Instagram:"2B3A53", X:"15171A" };
    (c.snapshot || []).forEach((s, pi) => {
      const ry = snapY + 0.42 + pi * 0.35;
      /* platform pill */
      slide.addShape(pptx.ShapeType.roundRect, { x:LX+0.18, y:ry, w:0.24, h:0.24, fill:{color: platColors[s.platform]||"333"}, line:{color:"000"}, rectRadius:0.04 });
      slide.addText(s.platform, { x:LX+0.5, y:ry+0.02, w:1.1, h:0.22, fontSize:9.5, bold:true, color:TEXT1, fontFace:"Calibri" });
      const roleColor = s.role?.toLowerCase() === "primary" ? "22C55E" : s.role?.toLowerCase() === "light" ? "F5A623" : TEXT3;
      slide.addText(s.role || "—", { x:LX+1.7, y:ry+0.02, w:0.8, h:0.22, fontSize:9, bold:true, color:roleColor, fontFace:"Calibri" });
      if (s.comment) slide.addText(s.comment, { x:LX+2.55, y:ry+0.02, w:LX+LW-2.8, h:0.22, fontSize:8, color:TEXT3, fontFace:"Calibri" });
    });

    /* Sentiment */
    if (c.sentiment && (c.sentiment.positive || c.sentiment.neutral || c.sentiment.negative)) {
      const sentY = snapY + 1.65;
      card(slide, LX, sentY, LW, 0.78, SURFACE);
      slide.addText("SENTIMENT INDEX", { x:LX+0.18, y:sentY+0.1, w:LW-0.3, h:0.18, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      /* stacked bar */
      const barY = sentY + 0.38;
      let bx = LX+0.18;
      const barW = LW-0.36;
      if (c.sentiment.positive) { const w=barW*(c.sentiment.positive/100); slide.addShape(pptx.ShapeType.rect,{x:bx,y:barY,w:Math.max(w,0.01),h:0.09,fill:{color:"22C55E"},line:{color:"22C55E"}}); bx+=w; }
      if (c.sentiment.neutral)  { const w=barW*(c.sentiment.neutral/100);  slide.addShape(pptx.ShapeType.rect,{x:bx,y:barY,w:Math.max(w,0.01),h:0.09,fill:{color:"4C5669"},line:{color:"4C5669"}}); bx+=w; }
      if (c.sentiment.negative) { const w=barW*(c.sentiment.negative/100); slide.addShape(pptx.ShapeType.rect,{x:bx,y:barY,w:Math.max(w,0.01),h:0.09,fill:{color:"EF4444"},line:{color:"EF4444"}}); }
      slide.addText(`${c.sentiment.positive||0}% Positive  ·  ${c.sentiment.neutral||0}% Neutral  ·  ${c.sentiment.negative||0}% Negative`, {
        x:LX+0.18, y:barY+0.14, w:LW-0.3, h:0.18, fontSize:7.5, color:TEXT3, fontFace:"Courier New"
      });
    }

    /* ── RIGHT COLUMN (x=4.55, w=8.58) ── */
    const RX = 4.55, RW = W-4.75;

    /* Content Themes */
    if (c.themes?.length) {
      card(slide, RX, 1.05, RW/2-0.1, 1.85, SURFACE);
      slide.addText("CONTENT THEMES", { x:RX+0.18, y:1.14, w:RW/2-0.3, h:0.2, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      c.themes.slice(0,5).forEach((t, ti) => {
        const ty = 1.42 + ti * 0.27;
        slide.addText(t.label.toUpperCase(), { x:RX+0.18, y:ty, w:1.1, h:0.2, fontSize:8, bold:true, color:TEXT2, fontFace:"Courier New" });
        hBar(slide, RX+1.38, ty+0.05, RW/2-1.6, t.value||0, ACCENT, CARD);
        slide.addText((t.value||0)+'%', { x:RX+RW/2-0.5, y:ty, w:0.35, h:0.2, fontSize:8, bold:true, color:ACCENT, align:"right", fontFace:"Calibri" });
      });
    }

    /* Key Campaigns */
    if (c.keyCampaigns?.length) {
      const cx2 = RX + RW/2 + 0.1;
      card(slide, cx2, 1.05, RW/2-0.1, 1.85, SURFACE);
      slide.addText("KEY CAMPAIGNS", { x:cx2+0.18, y:1.14, w:RW/2-0.3, h:0.2, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      c.keyCampaigns.slice(0,4).forEach((camp, ci) => {
        const cy = 1.42 + ci * 0.38;
        slide.addShape(pptx.ShapeType.ellipse, { x:cx2+0.18, y:cy+0.06, w:0.1, h:0.1, fill:{color:ACCENT}, line:{color:ACCENT} });
        slide.addText(camp, { x:cx2+0.34, y:cy+0.02, w:RW/2-0.55, h:0.3, fontSize:9, color:TEXT2, fontFace:"Calibri", wrap:true });
      });
    }

    /* Strategic Insight */
    if (c.insight) {
      card(slide, RX, 3.0, RW, 0.78, "12182A");
      slide.addShape(pptx.ShapeType.rect, { x:RX, y:3.0, w:0.045, h:0.78, fill:{color:ACCENT}, line:{color:ACCENT} });
      slide.addText("STRATEGIC INSIGHT", { x:RX+0.2, y:3.08, w:1.8, h:0.18, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      slide.addText(c.insight, { x:RX+0.2, y:3.27, w:RW-0.3, h:0.45, fontSize:9.5, color:TEXT2, fontFace:"Calibri", wrap:true });
    }

    /* Creative Scores */
    if (c.creativeScores) {
      const entries = Object.entries(c.creativeScores);
      card(slide, RX, 3.88, RW, 0.98, SURFACE);
      slide.addText("CREATIVE SCORES", { x:RX+0.18, y:3.96, w:RW-0.3, h:0.18, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      const bw = (RW - 0.5) / entries.length;
      entries.forEach(([key, val], si) => {
        const sx = RX + 0.22 + si * bw;
        hBar(slide, sx, 4.34, bw-0.15, typeof val==="number"?val*10:0, ACCENT, CARD);
        slide.addText(typeof val==="number"?val.toFixed(1):"—", { x:sx, y:4.44, w:bw-0.15, h:0.2, fontSize:10, bold:true, color:TEXT1, align:"center", fontFace:"Calibri" });
        slide.addText(key.replace(/([A-Z])/g," $1").trim().toUpperCase(), { x:sx-0.05, y:4.64, w:bw, h:0.18, fontSize:6, bold:true, color:TEXT3, align:"center", charSpacing:0.5, fontFace:"Courier New" });
      });
    }

    /* Whitespace + Recommendations */
    if (c.whitespace || c.recommendations) {
      const wRow = c.creativeScores ? 4.96 : 3.88;
      const wH = H - wRow - 0.18;
      card(slide, RX, wRow, RW/2-0.08, wH, SURFACE);
      slide.addText("WHITESPACE", { x:RX+0.18, y:wRow+0.1, w:RW/2-0.3, h:0.18, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      if (c.whitespace) slide.addText(c.whitespace, { x:RX+0.18, y:wRow+0.3, w:RW/2-0.3, h:wH-0.4, fontSize:9, color:TEXT2, fontFace:"Calibri", valign:"top", wrap:true });

      card(slide, RX+RW/2+0.08, wRow, RW/2-0.08, wH, SURFACE);
      slide.addText("RECOMMENDATIONS", { x:RX+RW/2+0.26, y:wRow+0.1, w:RW/2-0.3, h:0.18, fontSize:7, bold:true, color:ACCENT, charSpacing:1.5, fontFace:"Courier New" });
      if (c.recommendations) slide.addText(c.recommendations, { x:RX+RW/2+0.26, y:wRow+0.3, w:RW/2-0.3, h:wH-0.4, fontSize:9, color:TEXT2, fontFace:"Calibri", valign:"top", wrap:true });
    }

    /* signal badge */
    if (c.signalMatch && signalKeyword) {
      slide.addShape(pptx.ShapeType.roundRect, { x:W-2.5, y:H-0.45, w:2.3, h:0.28, fill:{color:"2A2300"}, line:{color:"F5A623"}, rectRadius:0.05 });
      slide.addText(`◉ SIGNAL: ${signalKeyword}`, { x:W-2.45, y:H-0.44, w:2.2, h:0.24, fontSize:7.5, bold:true, color:"F5A623", fontFace:"Courier New" });
    }

    /* footer */
    slide.addText(`John Joseph · Strategy Intelligence · ${brandLabel} Brand Window · ${monthName} ${year}`, {
      x:0.2, y:H-0.28, w:W-0.4, h:0.2, fontSize:7, color:TEXT3, fontFace:"Courier New"
    });
  });

  /* ════════════════════════════════════════
     FINAL SLIDE — METHODOLOGY
  ════════════════════════════════════════ */
  const mSlide = pptx.addSlide();
  darkBg(mSlide);
  mSlide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.06, h:H, fill:{color:ACCENT}, line:{color:ACCENT} });
  mSlide.addText("METHODOLOGY", { x:0.5, y:0.5, w:6, h:0.22, fontSize:9, bold:true, color:ACCENT, charSpacing:2.5, fontFace:"Courier New" });
  mSlide.addText("How this intelligence was built", { x:0.5, y:0.74, w:10, h:0.55, fontSize:26, bold:true, color:TEXT1, fontFace:"Calibri" });
  const methLines = [
    "· Analysis powered by Google Gemini 2.5 Flash with live Google Search grounding",
    "· Data sourced from the Competitor Tracker Google Sheet — only rows matching the selected reporting month are included",
    "· Platform presence, content themes, sentiment, and effectiveness scores are Gemini estimates based on publicly available social posts and brand activity",
    "· Creative Effectiveness Score (1–10) is a composite of Recall, Engagement, Shareability, Brand Fit, and Cultural Resonance",
    "· Sentiment Index reflects estimated positive/neutral/negative audience response to content",
    "· Private analytics (reach, impressions, paid spend) are not accessible and are not included",
    "· Post frequency figures are estimates — supplement with screenshots from live profiles for accuracy",
  ];
  mSlide.addText(methLines.join("\n"), { x:0.5, y:1.5, w:W-1, h:4.5, fontSize:11, color:TEXT2, fontFace:"Calibri", lineSpacingMultiple:1.7, valign:"top" });
  mSlide.addText(`John Joseph · Strategy Intelligence · ${brandLabel} · ${monthName} ${year}`, {
    x:0.5, y:H-0.3, w:W-1, h:0.22, fontSize:7.5, color:TEXT3, fontFace:"Courier New"
  });

  /* ── Save ── */
  const filename = `${brandLabel.replace(/\s+/g,"_")}_Brand_Window_${monthName}_${year}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

Object.assign(window, {
  BRANDS, BRAND_ORDER, MONTHS, THEME_LABELS, PLATS,
  slugify, deriveHandle, freshCard, roleClass, isActive,
  loadSheetCompetitors, invalidateSheetCache,
  callGemini, parseChartData, parseInsight,
  analyzeWindow, suggestCompetitors, buildPrompt, generatePDF, generateReport, generatePPT,
});
