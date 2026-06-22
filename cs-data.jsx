/* ============================================================
   DATA + AI + PDF — Brand Window template
   John Joseph · Strategy Intelligence
   Source: Competitor Social Media Tracker (Google Sheet)
   ============================================================ */

const BRAND_CATEGORIES = {
  alcohol:  { label: "Alcohol",      color: "#2E6B2F" },
  qsr:      { label: "QSR",          color: "#E87722" },
  retail:   { label: "Retail",       color: "#0071CE" },
  telecoms: { label: "Telecoms",     color: "#E60000" },
  beauty:   { label: "Beauty",       color: "#D4498F" },
  skincare: { label: "Skincare",     color: "#7BC8A4" },
  haircare: { label: "Haircare",     color: "#9B59B6" },
};

const BRANDS = {
  hunters:  { key: 'hunters',  name: 'Hunters',  color: '#2E6B2F', cat: 'Cider',                      category: 'alcohol' },
  amarula:  { key: 'amarula',  name: 'Amarula',  color: '#C8860A', cat: 'Cream Liqueur',               category: 'alcohol' },
  bernini:  { key: 'bernini',  name: 'Bernini',  color: '#4A7FB5', cat: 'Sparkling Grape Beverage',    category: 'alcohol' },
  qsr:      { key: 'qsr',      name: 'QSR',      color: '#E87722', cat: 'Quick Service Restaurant',    category: 'qsr'     },
  retail:   { key: 'retail',   name: 'Retail',   color: '#0071CE', cat: 'Retail & E-Commerce',         category: 'retail'  },
  telecoms: { key: 'telecoms', name: 'Telecoms', color: '#E60000', cat: 'Telecommunications',          category: 'telecoms'},
  beauty:   { key: 'beauty',   name: 'Beauty',   color: '#D4498F', cat: 'Beauty & Cosmetics',          category: 'beauty'  },
  skincare: { key: 'skincare', name: 'Skincare', color: '#7BC8A4', cat: 'Skincare',                    category: 'skincare'},
  haircare: { key: 'haircare', name: 'Haircare', color: '#9B59B6', cat: 'Haircare',                    category: 'haircare'},
};
const BRAND_ORDER = Object.keys(BRANDS);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const THEME_LABELS = ["Promotions", "Product", "Serves", "Seasonal", "Lifestyle"];
const PLATS = ["Facebook", "Instagram", "X", "TikTok", "Website"];
/* Alcohol brands exclude TikTok for legal/regulatory reasons */
function platsFor(brandSel) {
  return BRANDS[brandSel]?.category === "alcohol"
    ? ["Facebook", "Instagram", "X", "Website"]
    : PLATS;
}
/* Social platforms only (posting frequency) — Website isn't a feed */
function socialPlatsFor(brandSel) { return platsFor(brandSel).filter(p => p !== "Website"); }

/* ---- Markets ----
   South Africa uses the original (unprefixed) per-brand tabs.
   US / UK use prefixed, category-level tabs, e.g. "US QSR Competitor Links". */
const MARKETS = {
  sa: { label: "South Africa",   short: "SA", prefix: "" },
  us: { label: "United States",  short: "US", prefix: "US " },
  uk: { label: "United Kingdom", short: "UK", prefix: "UK " },
};
/* Proper-cased category names as they appear in the US/UK tab titles */
const CAT_TAB = {
  alcohol: "Alcohol", qsr: "QSR", retail: "Retail", telecoms: "Telecoms",
  beauty: "Beauty", skincare: "Skincare", haircare: "Haircare",
};

/* ---- Google Sheet tab names (South Africa) ---- */
const SHEET_ID = "1zIEipR_aJMiDk9XoT7LmEnXu4yg6cNgF";
const SHEET_TABS = {
  hunters:  "Hunters Competitor Links",
  amarula:  "Amarula Competitor Links",
  bernini:  "Bernini Competitor Links",
  qsr:      "QSR Competitor Links",
  retail:   "Retail Competitor Links",
  telecoms: "Telecoms Competitor Links",
  beauty:   "Beauty Competitor Links",
  skincare: "Skincare Competitor Links",
  haircare: "Haircare Competitor Links",
};

/* Resolve the sheet tab name for a brand/category in a given market */
function tabFor(brandSel, market) {
  if (!market || market === "sa") return SHEET_TABS[brandSel];
  const prefix = (MARKETS[market] && MARKETS[market].prefix) || "";
  const cat = BRANDS[brandSel] && BRANDS[brandSel].category;
  return `${prefix}${CAT_TAB[cat] || cat} Competitor Links`;
}
/* Human label for the current context (brand in SA, category in US/UK) */
function contextLabel(brandSel, market) {
  if (!market || market === "sa") return BRANDS[brandSel] ? BRANDS[brandSel].name : brandSel;
  const cat = BRANDS[brandSel] && BRANDS[brandSel].category;
  return (BRAND_CATEGORIES[cat] && BRAND_CATEGORIES[cat].label) || cat;
}

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
  hunters:  "1889059569",
  amarula:  null,          /* null → gviz by tab name */
  bernini:  "2060771197",
  qsr:      null,
  retail:   null,
  telecoms: null,
  beauty:   null,
  skincare: null,
  haircare: null,
};

async function fetchSheetTab(brandSel, filterMonth, filterYear, market) {
  const tabName = tabFor(brandSel, market);
  if (!tabName) throw new Error("Unknown brand: " + brandSel);
  /* gid export is faster but only mapped for SA tabs; US/UK use gviz-by-name */
  const gid = (!market || market === "sa") ? SHEET_GIDS[brandSel] : null;
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

  /* Header-aware column detection — tabs may order columns differently */
  const headers = (rows[hIdx] || []).map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const col = (name) => { const i = headers.indexOf(name.toLowerCase()); return i >= 0 ? i : -1; };
  const monthCol = col('reporting month');

  const targetMonth = (filterMonth !== undefined && filterYear !== undefined)
    ? `${MONTHS[filterMonth]} ${filterYear}`.toLowerCase()
    : null;

  const namedRows = dataRows.filter(r => r[0] && r[0].replace(/^"|"$/g, "").trim());
  const isMonthLike = (s) => /^[a-z]+\s+\d{4}$/.test(s); /* "june 2026" */
  const matched = namedRows.filter(r => {
    if (!targetMonth) return true;
    const rm = ((monthCol >= 0 ? r[monthCol] : r[7]) || "").replace(/^"|"$/g, "").trim().toLowerCase();
    /* include rows with no month, junk/non-month values, OR an exact match;
       only a real month that differs from the target excludes a row */
    return !rm || !isMonthLike(rm) || rm === targetMonth;
  });

  /* No exact-month rows but the tab has data:
     - past/current period → fall back to the latest available month's rows
     - future period → genuinely no data yet, tell the user what exists */
  let result = matched;
  if (targetMonth && matched.length === 0 && namedRows.length > 0) {
    const rowMonth = (r) => ((monthCol >= 0 ? r[monthCol] : r[7]) || "").replace(/^"|"$/g, "").trim();
    const parseMY = (s) => {
      const m = s.match(/^(\w+)\s+(\d{4})$/);
      if (!m) return null;
      const mi = MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase());
      return mi >= 0 ? mi + Number(m[2]) * 12 : null;
    };
    const now = new Date();
    const isFuture = (filterYear * 12 + filterMonth) > (now.getFullYear() * 12 + now.getMonth());
    if (isFuture) {
      const avail = [...new Set(namedRows.map(rowMonth).filter(Boolean))];
      throw new Error(`No rows for ${MONTHS[filterMonth]} ${filterYear} yet — this tab has data for: ${avail.join(", ")}.`);
    }
    /* latest available month ≤ anything — pick the most recent labelled month, else take all rows */
    const stamps = namedRows.map(r => parseMY(rowMonth(r)));
    const best = Math.max(...stamps.filter(s => s !== null), -1);
    result = best >= 0 ? namedRows.filter((r, i) => stamps[i] === best) : namedRows;
  }

  return result
    .map(r => ({
      name:   (r[col('brand name')]  || "").replace(/^"|"$/g, "").trim(),
      fb:     (r[col('facebook')]    || "").replace(/^"|"$/g, "").trim(),
      ig:     (r[col('instagram')]   || "").replace(/^"|"$/g, "").trim(),
      x:      (r[col('x')]           || "").replace(/^"|"$/g, "").trim(),
      tiktok: col('tiktok') >= 0 ? (r[col('tiktok')] || "").replace(/^"|"$/g, "").trim() : "",
      web:    (r[col('website')]     || "").replace(/^"|"$/g, "").trim(),
    }));
}

/* in-memory cache so switching back doesn't re-fetch */
const _sheetCache = {};

/* ============================================================
   DEMO MODE — pre-analyzed competitor sets for client demos.
   Activated via ?demo=1 ; loads instantly, no API key / sign-in,
   so a client demo can never fail on live rate limits or quota.
   ============================================================ */
const _demoImg = (seed) => `https://picsum.photos/seed/${seed}/400/500`;
/* Category-appropriate stock imagery for the creative grid (served via the weserv proxy).
   High-population keywords so they reliably return relevant photos. */
const DEMO_KEYWORDS = {
  alcohol:  ["beer", "cocktail", "bar", "party", "drinks", "cheers"],
  qsr:      ["burger", "fries", "chicken", "pizza", "restaurant", "soda"],
  retail:   ["shopping", "fashion", "store", "product", "delivery", "clothing"],
  telecoms: ["smartphone", "technology", "network", "phone", "city", "connection"],
  beauty:   ["makeup", "cosmetics", "lipstick", "model", "glamour", "mascara"],
  skincare: ["skincare", "serum", "spa", "moisturizer", "face", "cosmetics"],
  haircare: ["hairstyle", "salon", "hair", "model", "shampoo", "beauty"],
};
function _demoPosts(o) {
  const cat = BRANDS[o.parent] ? BRANDS[o.parent].category : o.parent;
  const kws = DEMO_KEYWORDS[cat] || ["product", "lifestyle", "brand", "social", "marketing", "design"];
  const base = Math.abs([...o.name].reduce((a, c) => a + c.charCodeAt(0), 0)) % 900;
  return kws.map((kw, i) => `https://loremflickr.com/400/500/${kw}?lock=${base + i + 1}`);
}
function demoCard(o) {
  const socials = socialPlatsFor(o.parent);
  return {
    name: o.name, handle: o.handle, color: o.color, parent: o.parent, source: "synced", note: "",
    ig: o.ig || "#", fb: o.fb || "#", x: o.x || "#", tiktok: o.tiktok || "", web: o.web || "#",
    snapshot: o.snapshot,
    themes: THEME_LABELS.map(l => ({ label: l, value: o.themes[l] || 0 })),
    insight: o.insight,
    sentiment: o.sentiment,
    postFrequency: Object.fromEntries(socials.map(p => [p, o.freq[p] || 0])),
    effectivenessScore: o.score,
    executiveSummary: o.exec || "",
    keyCampaigns: o.campaigns || [],
    contentSnapshot: o.content || null,
    creativeScores: o.creative,
    whitespace: o.whitespace || "",
    recommendations: o.rec || "",
    signalMatch: !!o.signalMatch, signalNote: o.signalNote || "", signalLink: o.signalLink || "",
    posts: o.posts || _demoPosts(o),
    analyzing: false, analyzed: true,
  };
}

const DEMO_DATA = {
  qsr: [
    demoCard({ name: "KFC SA", handle: "@kfcsa", color: "#E4002B", parent: "qsr",
      ig: "https://instagram.com/kfcsa", fb: "https://facebook.com/KFCSouthAfrica", x: "https://x.com/KFCSA", tiktok: "@kfcsa", web: "https://kfc.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Always-on value promos" },
        { platform: "Instagram", role: "Primary",  comment: "Bucket culture, music" },
        { platform: "X",         role: "Light",    comment: "Customer care" },
        { platform: "TikTok",    role: "Primary",  comment: "Creator-led trends" },
        { platform: "Website",   role: "Primary",  comment: "Online ordering" } ],
      themes: { Promotions: 78, Product: 60, Serves: 30, Seasonal: 22, Lifestyle: 42 },
      insight: "KFC SA dominated June through always-on value messaging, anchored by the **Streetwise** range and a **#KFCxGqom** creator series that drove the bulk of its TikTok engagement.",
      sentiment: { positive: 68, neutral: 24, negative: 8 }, freq: { Facebook: 22, Instagram: 26, X: 14, TikTok: 30 }, score: 8.4,
      creative: { platformNative: 9, culturalRelevance: 9, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 9 },
      exec: "KFC leaned hard into value and culture, pairing the Streetwise range with locally-relevant creator content to defend share among younger, price-sensitive audiences.",
      campaigns: [{ title: "Streetwise Value", description: "Always-on affordability push across all platforms." }, { title: "#KFCxGqom", description: "Creator series tying the brand to local gqom music culture." }],
      whitespace: "Limited premium / quality storytelling — all value, little craft.", rec: "Hunters can own a 'crafted' positioning where KFC stays purely transactional.",
      signalMatch: true, signalNote: "Found a **Streetwise** value-range push dated 9 June running across Instagram and TikTok.", signalLink: "https://instagram.com/kfcsa" }),
    demoCard({ name: "McDonald's SA", handle: "@mcdonaldssa", color: "#FFC72C", parent: "qsr",
      ig: "https://instagram.com/mcdonaldssa", fb: "https://facebook.com/McDonaldsSA", x: "https://x.com/McDonaldsSA", tiktok: "@mcdonaldssa", web: "https://mcdonalds.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Family & value" },
        { platform: "Instagram", role: "Primary",  comment: "Product hero shots" },
        { platform: "X",         role: "Light",    comment: "Reactive banter" },
        { platform: "TikTok",    role: "Light",    comment: "Trend participation" },
        { platform: "Website",   role: "Primary",  comment: "App & delivery" } ],
      themes: { Promotions: 65, Product: 80, Serves: 25, Seasonal: 35, Lifestyle: 20 },
      insight: "McDonald's SA centred June on product hero creative and the **McDelivery** app push, with a polished but less culturally-native feed than KFC.",
      sentiment: { positive: 62, neutral: 28, negative: 10 }, freq: { Facebook: 18, Instagram: 20, X: 9, TikTok: 12 }, score: 7.6,
      creative: { platformNative: 7, culturalRelevance: 6, visualDistinctiveness: 8, strategicClarity: 8, engagementPotential: 7 },
      exec: "Product-led and app-first, McDonald's prioritised polish and delivery conversion over cultural relevance this period.",
      campaigns: [{ title: "McDelivery", description: "App-led delivery convenience messaging." }],
      whitespace: "Under-indexed on local culture and creators vs KFC.", rec: "Cultural relevance is contestable territory against McDonald's.",
      signalMatch: false, signalNote: "No matching content found." }),
    demoCard({ name: "Burger King SA", handle: "@burgerkingsa", color: "#D62300", parent: "qsr",
      ig: "https://instagram.com/burgerkingsa", fb: "https://facebook.com/BurgerKingSA", x: "https://x.com/BurgerKingZA", tiktok: "@burgerkingsa", web: "https://burgerking.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Price-led offers" },
        { platform: "Instagram", role: "Primary",  comment: "Flame-grill craft" },
        { platform: "X",         role: "Light",    comment: "Challenger jabs" },
        { platform: "TikTok",    role: "Light",    comment: "Occasional trends" },
        { platform: "Website",   role: "Light",    comment: "Menu & stores" } ],
      themes: { Promotions: 85, Product: 70, Serves: 40, Seasonal: 18, Lifestyle: 12 },
      insight: "Burger King SA ran an aggressive price-led June built around the **Whopper Wednesday** mechanic and challenger-brand jabs at rivals.",
      sentiment: { positive: 58, neutral: 30, negative: 12 }, freq: { Facebook: 16, Instagram: 14, X: 11, TikTok: 8 }, score: 7.1,
      creative: { platformNative: 7, culturalRelevance: 6, visualDistinctiveness: 7, strategicClarity: 7, engagementPotential: 7 },
      exec: "A discount-heavy challenger play — strong on offers and flame-grill craft cues, lighter on cultural and lifestyle content.",
      campaigns: [{ title: "Whopper Wednesday", description: "Weekly price mechanic anchoring the month." }],
      whitespace: "Heavy discounting risks brand equity erosion.", rec: "Avoid a discount war; compete on distinctiveness." }),
    demoCard({ name: "Nando's SA", handle: "@nandossa", color: "#DC0032", parent: "qsr",
      ig: "https://instagram.com/nandossa", fb: "https://facebook.com/NandosSA", x: "https://x.com/NandosSA", tiktok: "@nandos.sa", web: "https://nandos.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Witty topical" },
        { platform: "Instagram", role: "Primary",  comment: "Bold art direction" },
        { platform: "X",         role: "Primary",  comment: "Topical commentary" },
        { platform: "TikTok",    role: "Light",    comment: "Brand humour" },
        { platform: "Website",   role: "Light",    comment: "Menu & PERi-PERi" } ],
      themes: { Promotions: 40, Product: 55, Serves: 30, Seasonal: 20, Lifestyle: 70 },
      insight: "Nando's SA stayed true to its wit-led playbook, using **topical current-affairs** creative and bold art direction to drive earned reach rather than discounting.",
      sentiment: { positive: 80, neutral: 15, negative: 5 }, freq: { Facebook: 14, Instagram: 16, X: 18, TikTok: 7 }, score: 8.7,
      creative: { platformNative: 8, culturalRelevance: 10, visualDistinctiveness: 9, strategicClarity: 9, engagementPotential: 9 },
      exec: "Nando's continued to win on distinctiveness and cultural commentary, generating outsized earned reach without leaning on price.",
      campaigns: [{ title: "Topical wit", description: "Reactive current-affairs creative driving earned media." }],
      whitespace: "Lower posting frequency than QSR peers.", rec: "Distinctiveness beats discounting — the Nando's model is the benchmark.",
      signalMatch: true, signalNote: "Found a **topical** load-shedding ad dated 14 June that drove strong earned reach.", signalLink: "https://x.com/NandosSA" }),
  ],
  alcohol: [
    demoCard({ name: "Castle Lite", handle: "@castlelitesa", color: "#4A7FB5", parent: "hunters",
      ig: "https://instagram.com/castlelitesa", fb: "https://facebook.com/CastleLite", x: "https://x.com/CastleLite", web: "https://castlelite.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Extra-cold lifestyle" },
        { platform: "Instagram", role: "Primary",  comment: "Music & events" },
        { platform: "X",         role: "Light",    comment: "Live event banter" },
        { platform: "Website",   role: "Primary",  comment: "Brand & events" } ],
      themes: { Promotions: 35, Product: 55, Serves: 40, Seasonal: 30, Lifestyle: 80 },
      insight: "Castle Lite reinforced its 'extra cold' equity through aspirational lifestyle content, anchored by the **Castle Lite Unlocked** music platform and a **#ExtraCold** summer push.",
      sentiment: { positive: 74, neutral: 20, negative: 6 }, freq: { Facebook: 16, Instagram: 22, X: 12 }, score: 8.5,
      creative: { platformNative: 9, culturalRelevance: 9, visualDistinctiveness: 8, strategicClarity: 9, engagementPotential: 8 },
      exec: "Premium lifestyle and music-led, Castle Lite defended its leadership through experiential equity rather than promotion.",
      campaigns: [{ title: "Castle Lite Unlocked", description: "Flagship music platform driving cultural relevance." }],
      whitespace: "Light on at-home / serve occasions.", rec: "Hunters can own the relaxed, everyday occasion Castle Lite skips.",
      signalMatch: true, signalNote: "Found a **Castle Lite Unlocked** line-up reveal dated 11 June across Instagram and Facebook.", signalLink: "https://instagram.com/castlelitesa" }),
    demoCard({ name: "Flying Fish", handle: "@flyingfishsa", color: "#16A085", parent: "hunters",
      ig: "https://instagram.com/flyingfishsa", fb: "https://facebook.com/FlyingFishSA", x: "https://x.com/FlyingFishSA", web: "https://flyingfish.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Flavour & fun" },
        { platform: "Instagram", role: "Primary",  comment: "Bold, youthful" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "Website",   role: "Light",    comment: "Product range" } ],
      themes: { Promotions: 55, Product: 75, Serves: 35, Seasonal: 25, Lifestyle: 50 },
      insight: "Flying Fish leaned into flavour-led fun, using the **FIFA World Cup** sponsorship hook and bright creator content to court a younger LDA+ audience.",
      sentiment: { positive: 70, neutral: 22, negative: 8 }, freq: { Facebook: 18, Instagram: 20, X: 0 }, score: 7.8,
      creative: { platformNative: 8, culturalRelevance: 8, visualDistinctiveness: 8, strategicClarity: 7, engagementPotential: 8 },
      exec: "Flavoured-beer fun with a sport hook — youthful and high-energy, though strategy is spread across several messages.",
      campaigns: [{ title: "FIFA World Cup", description: "Football sponsorship hook for the period." }],
      whitespace: "Message focus is diffuse across flavour, sport and music.", rec: "A sharper single-minded hook would lift Flying Fish's effectiveness.",
      signalMatch: true, signalNote: "Found a **FIFA World Cup** flavour-upgrade activation dated 7 June on Instagram.", signalLink: "https://instagram.com/flyingfishsa" }),
    demoCard({ name: "Brutal Fruit", handle: "@brutalfruitza", color: "#E84393", parent: "hunters",
      ig: "https://instagram.com/brutalfruitza", fb: "https://facebook.com/BrutalFruit", x: "https://x.com/BrutalFruit", web: "https://brutalfruit.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Elegant lifestyle" },
        { platform: "Instagram", role: "Primary",  comment: "Aspirational, feminine" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "Website",   role: "Light",    comment: "Brand world" } ],
      themes: { Promotions: 30, Product: 50, Serves: 45, Seasonal: 25, Lifestyle: 78 },
      insight: "Brutal Fruit held a premium, feminine lifestyle lane built around the **Ruby Apple** hero and elegant, occasion-led Instagram creative.",
      sentiment: { positive: 76, neutral: 19, negative: 5 }, freq: { Facebook: 10, Instagram: 18, X: 0 }, score: 7.9,
      creative: { platformNative: 8, culturalRelevance: 8, visualDistinctiveness: 9, strategicClarity: 8, engagementPotential: 7 },
      exec: "A focused, premium feminine positioning — strong visual distinctiveness and occasion framing, narrow by design.",
      campaigns: [{ title: "Ruby Apple", description: "Hero SKU anchoring elegant lifestyle creative." }],
      whitespace: "Narrow audience focus; little male or mixed-occasion content.", rec: "Brutal Fruit cedes the broad social occasion Hunters can own." }),
    demoCard({ name: "Savanna", handle: "@savannacider", color: "#F39C12", parent: "hunters",
      ig: "https://instagram.com/savannacider", fb: "https://facebook.com/Savanna", x: "https://x.com/Savanna_Cider", web: "https://savanna.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Comedy & wit" },
        { platform: "Instagram", role: "Primary",  comment: "Humour-led" },
        { platform: "X",         role: "Light",    comment: "Dry one-liners" },
        { platform: "Website",   role: "Light",    comment: "Comedy hub" } ],
      themes: { Promotions: 35, Product: 45, Serves: 30, Seasonal: 20, Lifestyle: 72 },
      insight: "Savanna stayed in its comedy lane, using the **Savanna Comedy** platform and dry one-liners to drive distinctive, highly-shareable content.",
      sentiment: { positive: 78, neutral: 17, negative: 5 }, freq: { Facebook: 15, Instagram: 16, X: 10 }, score: 8.2,
      creative: { platformNative: 8, culturalRelevance: 9, visualDistinctiveness: 9, strategicClarity: 8, engagementPotential: 9 },
      exec: "Comedy-led distinctiveness — Savanna's wit platform continues to deliver outsized share of voice for spend.",
      campaigns: [{ title: "Savanna Comedy", description: "Owned comedy platform driving earned reach." }],
      whitespace: "Humour can crowd out product/occasion cues.", rec: "Hunters can balance wit with clearer occasion framing.",
      signalMatch: true, signalNote: "Found a **Savanna Comedy** special teaser dated 18 June across Facebook and Instagram.", signalLink: "https://facebook.com/Savanna" }),
  ],
  retail: [
    demoCard({ name: "Takealot", handle: "@takealot", color: "#0A9EDC", parent: "retail",
      ig: "https://instagram.com/takealot", fb: "https://facebook.com/takealot", x: "https://x.com/takealot", tiktok: "@takealot", web: "https://takealot.com",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Deals & delivery" },
        { platform: "Instagram", role: "Primary",  comment: "Product discovery" },
        { platform: "X",         role: "Light",    comment: "Customer service" },
        { platform: "TikTok",    role: "Light",    comment: "Trend hauls" },
        { platform: "Website",   role: "Primary",  comment: "Marketplace" } ],
      themes: { Promotions: 82, Product: 70, Serves: 18, Seasonal: 40, Lifestyle: 25 },
      insight: "Takealot ran always-on deal culture in June, with **Blue Dot Sale** teasers and rapid-delivery messaging dominating the feed.",
      sentiment: { positive: 60, neutral: 28, negative: 12 }, freq: { Facebook: 24, Instagram: 22, X: 16, TikTok: 10 }, score: 8.0,
      creative: { platformNative: 8, culturalRelevance: 7, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 8 },
      exec: "Marketplace breadth and price are the story — high-volume deal content optimised for conversion over brand-building.",
      campaigns: [{ title: "Blue Dot Sale", description: "Flagship discount event teased through the month." }],
      whitespace: "Little emotional / brand storytelling beyond price.", rec: "A brand can differentiate on trust and curation where Takealot competes purely on deals.",
      signalMatch: true, signalNote: "Found a **Blue Dot Sale** pre-launch teaser dated 12 June across Instagram and Facebook.", signalLink: "https://instagram.com/takealot" }),
    demoCard({ name: "Woolworths SA", handle: "@woolworths_sa", color: "#4A7C2F", parent: "retail",
      ig: "https://instagram.com/woolworths_sa", fb: "https://facebook.com/WoolworthsSA", x: "https://x.com/WOOLWORTHS_SA", tiktok: "@woolworths_sa", web: "https://woolworths.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Food & fashion" },
        { platform: "Instagram", role: "Primary",  comment: "Premium lifestyle" },
        { platform: "X",         role: "Light",    comment: "Service & news" },
        { platform: "TikTok",    role: "Light",    comment: "Food inspiration" },
        { platform: "Website",   role: "Primary",  comment: "Online & Dash" } ],
      themes: { Promotions: 45, Product: 65, Serves: 35, Seasonal: 40, Lifestyle: 75 },
      insight: "Woolworths held a premium lifestyle lane, with **The Woolies Way** quality storytelling and seasonal food content leading June.",
      sentiment: { positive: 72, neutral: 21, negative: 7 }, freq: { Facebook: 18, Instagram: 24, X: 10, TikTok: 9 }, score: 8.5,
      creative: { platformNative: 8, culturalRelevance: 8, visualDistinctiveness: 9, strategicClarity: 9, engagementPotential: 8 },
      exec: "Premium, quality-led and consistent — Woolworths converts brand equity into loyalty rather than chasing discounts.",
      campaigns: [{ title: "The Woolies Way", description: "Quality and provenance storytelling across food and fashion." }],
      whitespace: "Premium positioning leaves value-seekers to rivals.", rec: "Quality storytelling is the benchmark to study here." }),
    demoCard({ name: "Checkers", handle: "@checkerssa", color: "#E2231A", parent: "retail",
      ig: "https://instagram.com/checkerssa", fb: "https://facebook.com/checkers", x: "https://x.com/checkerssa", tiktok: "@checkers_sa", web: "https://checkers.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Sixty60 & deals" },
        { platform: "Instagram", role: "Primary",  comment: "Convenience-led" },
        { platform: "X",         role: "Light",    comment: "Service" },
        { platform: "TikTok",    role: "Primary",  comment: "Sixty60 creators" },
        { platform: "Website",   role: "Primary",  comment: "Sixty60 app" } ],
      themes: { Promotions: 75, Product: 55, Serves: 30, Seasonal: 35, Lifestyle: 40 },
      insight: "Checkers rode its **Sixty60** delivery momentum hard, pairing speed messaging with influencer hauls to own the convenience narrative.",
      sentiment: { positive: 70, neutral: 22, negative: 8 }, freq: { Facebook: 20, Instagram: 20, X: 12, TikTok: 18 }, score: 8.3,
      creative: { platformNative: 9, culturalRelevance: 8, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 9 },
      exec: "Sixty60 is the wedge — Checkers turned a delivery app into a culturally-relevant convenience brand.",
      campaigns: [{ title: "Sixty60", description: "60-minute delivery platform driving the brand's momentum." }],
      whitespace: "Brand leans heavily on one product (Sixty60).", rec: "Watch Sixty60's creator playbook — it's the standout convenience model.",
      signalMatch: true, signalNote: "Found a **Sixty60** 'faster than ever' creator push dated 8 June on TikTok.", signalLink: "https://instagram.com/checkerssa" }),
    demoCard({ name: "Mr Price", handle: "@mrpricefashion", color: "#E4002B", parent: "retail",
      ig: "https://instagram.com/mrpricefashion", fb: "https://facebook.com/MRPFashion", x: "https://x.com/MRP_Fashion", tiktok: "@mrpfashion", web: "https://mrp.com",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Fashion drops" },
        { platform: "Instagram", role: "Primary",  comment: "Youth fashion" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Style creators" },
        { platform: "Website",   role: "Primary",  comment: "Shop online" } ],
      themes: { Promotions: 60, Product: 70, Serves: 20, Seasonal: 45, Lifestyle: 55 },
      insight: "Mr Price targeted Gen-Z value fashion, using **#MRPxStyle** creator drops and TikTok-first content to drive affordable trend appeal.",
      sentiment: { positive: 66, neutral: 26, negative: 8 }, freq: { Facebook: 12, Instagram: 22, X: 0, TikTok: 24 }, score: 7.7,
      creative: { platformNative: 9, culturalRelevance: 8, visualDistinctiveness: 7, strategicClarity: 7, engagementPotential: 8 },
      exec: "TikTok-native and youth-led — Mr Price competes on affordable trend speed and creator volume.",
      campaigns: [{ title: "#MRPxStyle", description: "Creator-led fashion drops aimed at Gen-Z." }],
      whitespace: "X/Twitter dormant; opportunity for service voice.", rec: "Mr Price's TikTok-first model is worth benchmarking for youth reach." }),
  ],
  telecoms: [
    demoCard({ name: "Vodacom", handle: "@vodacom", color: "#E60000", parent: "telecoms",
      ig: "https://instagram.com/vodacom", fb: "https://facebook.com/Vodacom", x: "https://x.com/Vodacom", tiktok: "@vodacom", web: "https://vodacom.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Data deals & care" },
        { platform: "Instagram", role: "Primary",  comment: "Lifestyle & sport" },
        { platform: "X",         role: "Primary",  comment: "Live service" },
        { platform: "TikTok",    role: "Light",    comment: "Youth trends" },
        { platform: "Website",   role: "Primary",  comment: "Plans & app" } ],
      themes: { Promotions: 70, Product: 60, Serves: 45, Seasonal: 25, Lifestyle: 50 },
      insight: "Vodacom led on scale and sport, anchoring June around **VodaPay** super-app pushes and its national sponsorship portfolio.",
      sentiment: { positive: 58, neutral: 27, negative: 15 }, freq: { Facebook: 24, Instagram: 22, X: 26, TikTok: 12 }, score: 7.9,
      creative: { platformNative: 8, culturalRelevance: 8, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 7 },
      exec: "Market leader playing the breadth game — data value, super-app and sport sponsorship across a high-volume feed.",
      campaigns: [{ title: "VodaPay", description: "Super-app adoption drive." }],
      whitespace: "High service-complaint volume on X dents sentiment.", rec: "Service responsiveness is a soft spot to exploit.",
      signalMatch: true, signalNote: "Found a **VodaPay** rewards push dated 10 June across Facebook and Instagram.", signalLink: "https://instagram.com/vodacom" }),
    demoCard({ name: "MTN SA", handle: "@mtnza", color: "#FFCB05", parent: "telecoms",
      ig: "https://instagram.com/mtnza", fb: "https://facebook.com/mtn.co.za", x: "https://x.com/MTNza", tiktok: "@mtnza", web: "https://mtn.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Deals & football" },
        { platform: "Instagram", role: "Primary",  comment: "Bold yellow brand" },
        { platform: "X",         role: "Primary",  comment: "Service & news" },
        { platform: "TikTok",    role: "Primary",  comment: "Creator content" },
        { platform: "Website",   role: "Primary",  comment: "Plans & MoMo" } ],
      themes: { Promotions: 68, Product: 58, Serves: 40, Seasonal: 30, Lifestyle: 55 },
      insight: "MTN pushed its **MoMo** financial play and football heritage, with bold yellow creative and a strong TikTok creator presence.",
      sentiment: { positive: 60, neutral: 28, negative: 12 }, freq: { Facebook: 22, Instagram: 24, X: 22, TikTok: 18 }, score: 8.1,
      creative: { platformNative: 9, culturalRelevance: 8, visualDistinctiveness: 9, strategicClarity: 8, engagementPotential: 8 },
      exec: "Distinctive brand assets plus a fintech (MoMo) and football narrative — MTN is the most creatively confident of the networks.",
      campaigns: [{ title: "MoMo", description: "Mobile money adoption push." }],
      whitespace: "Fintech story still feels separate from core telco.", rec: "MTN's distinctive yellow system is the brand-asset benchmark." }),
    demoCard({ name: "Telkom", handle: "@telkomza", color: "#00A9CE", parent: "telecoms",
      ig: "https://instagram.com/telkomza", fb: "https://facebook.com/Telkom", x: "https://x.com/TelkomZA", tiktok: "@telkomza", web: "https://telkom.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Data value" },
        { platform: "Instagram", role: "Light",    comment: "Product-led" },
        { platform: "X",         role: "Primary",  comment: "Service-heavy" },
        { platform: "TikTok",    role: "Inactive", comment: "" },
        { platform: "Website",   role: "Primary",  comment: "Deals & fibre" } ],
      themes: { Promotions: 78, Product: 62, Serves: 50, Seasonal: 20, Lifestyle: 18 },
      insight: "Telkom competed almost entirely on **data value**, with price-led creative and a heavy customer-service load on X.",
      sentiment: { positive: 48, neutral: 30, negative: 22 }, freq: { Facebook: 18, Instagram: 12, X: 24, TikTok: 0 }, score: 6.8,
      creative: { platformNative: 6, culturalRelevance: 5, visualDistinctiveness: 6, strategicClarity: 7, engagementPotential: 6 },
      exec: "Value-challenger with a thin brand layer — strong on price, weak on culture and distinctiveness.",
      campaigns: [{ title: "Data value", description: "Price-led data bundle messaging." }],
      whitespace: "No TikTok presence; weak brand-building.", rec: "Telkom's culture gap is wide open for a more distinctive challenger." }),
    demoCard({ name: "Rain", handle: "@rain.networks", color: "#6C2BD9", parent: "telecoms",
      ig: "https://instagram.com/rain.networks", fb: "https://facebook.com/rain.networks", x: "https://x.com/rainmobiledata", tiktok: "@rain.networks", web: "https://rain.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Data-only" },
        { platform: "Instagram", role: "Primary",  comment: "Clean, minimal" },
        { platform: "X",         role: "Primary",  comment: "Disruptor voice" },
        { platform: "TikTok",    role: "Light",    comment: "Explainers" },
        { platform: "Website",   role: "Primary",  comment: "Sign-up funnel" } ],
      themes: { Promotions: 55, Product: 72, Serves: 30, Seasonal: 15, Lifestyle: 35 },
      insight: "Rain played the data-only disruptor, with minimalist creative and **unlimited 5G** messaging aimed at cutting out the legacy networks.",
      sentiment: { positive: 64, neutral: 26, negative: 10 }, freq: { Facebook: 10, Instagram: 16, X: 18, TikTok: 8 }, score: 7.4,
      creative: { platformNative: 7, culturalRelevance: 7, visualDistinctiveness: 8, strategicClarity: 9, engagementPotential: 7 },
      exec: "Single-minded disruptor — clean design and a sharp 5G value proposition, narrow but focused.",
      campaigns: [{ title: "Unlimited 5G", description: "Data-only disruption play vs incumbents." }],
      whitespace: "Narrow product focus limits reach.", rec: "Rain's clarity of proposition is a lesson in single-minded messaging." }),
  ],
  beauty: [
    demoCard({ name: "MAC Cosmetics", handle: "@maccosmetics", color: "#B11226", parent: "beauty",
      ig: "https://instagram.com/maccosmetics", fb: "https://facebook.com/maccosmetics", x: "https://x.com/MACcosmetics", tiktok: "@maccosmetics", web: "https://maccosmetics.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Product launches" },
        { platform: "Instagram", role: "Primary",  comment: "Artistry-led" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "MUA tutorials" },
        { platform: "Website",   role: "Primary",  comment: "Shop & shades" } ],
      themes: { Promotions: 40, Product: 80, Serves: 25, Seasonal: 30, Lifestyle: 60 },
      insight: "MAC stayed artistry-first, with **#MACArtistChallenge** creator content and bold shade-led product storytelling driving June.",
      sentiment: { positive: 74, neutral: 20, negative: 6 }, freq: { Facebook: 10, Instagram: 24, X: 0, TikTok: 22 }, score: 8.4,
      creative: { platformNative: 9, culturalRelevance: 9, visualDistinctiveness: 9, strategicClarity: 8, engagementPotential: 9 },
      exec: "Pro-artistry credibility plus creator volume — MAC converts makeup-artist authority into aspirational reach.",
      campaigns: [{ title: "#MACArtistChallenge", description: "Creator artistry series showcasing shade range." }],
      whitespace: "Premium price point leaves value-beauty open.", rec: "MAC's artistry-credibility model is the aspirational benchmark.",
      signalMatch: true, signalNote: "Found a **#MACArtistChallenge** creator series dated 13 June across Instagram and TikTok.", signalLink: "https://instagram.com/maccosmetics" }),
    demoCard({ name: "NYX SA", handle: "@nyxcosmetics_sa", color: "#D4498F", parent: "beauty",
      ig: "https://instagram.com/nyxcosmetics_sa", fb: "https://facebook.com/nyxcosmeticssa", x: "https://x.com/NYXCosmeticsSA", tiktok: "@nyxcosmetics", web: "https://nyxcosmetics.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Promos" },
        { platform: "Instagram", role: "Primary",  comment: "Trend-led colour" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Viral products" },
        { platform: "Website",   role: "Primary",  comment: "Shop online" } ],
      themes: { Promotions: 60, Product: 75, Serves: 20, Seasonal: 30, Lifestyle: 50 },
      insight: "NYX chased TikTok virality, with the **Fat Oil Lip Drip** hero product and creator-driven dupes leading affordable colour cosmetics.",
      sentiment: { positive: 70, neutral: 23, negative: 7 }, freq: { Facebook: 9, Instagram: 20, X: 0, TikTok: 28 }, score: 8.0,
      creative: { platformNative: 9, culturalRelevance: 9, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 9 },
      exec: "TikTok-native and product-hero-led — NYX wins on affordable virality and creator dupes.",
      campaigns: [{ title: "Fat Oil Lip Drip", description: "Viral hero product anchoring TikTok content." }],
      whitespace: "Brand world is thin beyond product virality.", rec: "NYX shows how a single hero SKU can drive a whole TikTok strategy." }),
    demoCard({ name: "Estée Lauder", handle: "@esteelauder", color: "#1B3A5B", parent: "beauty",
      ig: "https://instagram.com/esteelauder", fb: "https://facebook.com/esteelauder", x: "https://x.com/EsteeLauder", tiktok: "@esteelauder", web: "https://esteelauder.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Skincare-beauty" },
        { platform: "Instagram", role: "Primary",  comment: "Luxury editorial" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Light",    comment: "Serum science" },
        { platform: "Website",   role: "Primary",  comment: "Shop & gifting" } ],
      themes: { Promotions: 35, Product: 78, Serves: 25, Seasonal: 35, Lifestyle: 65 },
      insight: "Estée Lauder held a luxury editorial lane, with **Advanced Night Repair** serum science and gifting-led creative anchoring the period.",
      sentiment: { positive: 72, neutral: 22, negative: 6 }, freq: { Facebook: 8, Instagram: 18, X: 0, TikTok: 10 }, score: 7.8,
      creative: { platformNative: 7, culturalRelevance: 7, visualDistinctiveness: 9, strategicClarity: 8, engagementPotential: 7 },
      exec: "Prestige and product science — polished, premium, less culturally-native than the colour brands.",
      campaigns: [{ title: "Advanced Night Repair", description: "Hero serum science storytelling." }],
      whitespace: "Limited cultural / creator relevance.", rec: "Prestige craft is strong; cultural relevance is contestable." }),
    demoCard({ name: "Maybelline SA", handle: "@maybelline", color: "#0033A0", parent: "beauty",
      ig: "https://instagram.com/maybelline", fb: "https://facebook.com/maybelline", x: "https://x.com/Maybelline", tiktok: "@maybelline", web: "https://maybelline.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Mass-market promos" },
        { platform: "Instagram", role: "Primary",  comment: "Everyday glam" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Sky-High virals" },
        { platform: "Website",   role: "Light",    comment: "Find a shade" } ],
      themes: { Promotions: 58, Product: 72, Serves: 22, Seasonal: 28, Lifestyle: 48 },
      insight: "Maybelline drove mass-market accessibility, with the **Sky High Mascara** hero and everyday-glam creator content sustaining reach.",
      sentiment: { positive: 68, neutral: 24, negative: 8 }, freq: { Facebook: 16, Instagram: 20, X: 0, TikTok: 22 }, score: 7.9,
      creative: { platformNative: 8, culturalRelevance: 8, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 8 },
      exec: "Accessible everyday glam at scale — strong hero products and broad creator reach.",
      campaigns: [{ title: "Sky High Mascara", description: "Viral hero product sustaining mass reach." }],
      whitespace: "Crowded everyday-glam space; little distinctiveness.", rec: "Maybelline shows hero-product consistency, but distinctiveness is winnable." }),
  ],
  skincare: [
    demoCard({ name: "Nivea SA", handle: "@niveasa", color: "#003DA5", parent: "skincare",
      ig: "https://instagram.com/niveasa", fb: "https://facebook.com/NiveaSA", x: "https://x.com/NiveaSA", tiktok: "@niveasa", web: "https://nivea.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Family skincare" },
        { platform: "Instagram", role: "Primary",  comment: "Tips & tutorials" },
        { platform: "X",         role: "Light",    comment: "Customer care" },
        { platform: "TikTok",    role: "Light",    comment: "Routine content" },
        { platform: "Website",   role: "Primary",  comment: "Product range" } ],
      themes: { Promotions: 50, Product: 78, Serves: 25, Seasonal: 35, Lifestyle: 45 },
      insight: "Nivea anchored June on the **Winter Skin SOS** seasonal push, pairing dermatologist creators with its Q10 range relaunch.",
      sentiment: { positive: 76, neutral: 18, negative: 6 }, freq: { Facebook: 18, Instagram: 20, X: 9, TikTok: 12 }, score: 8.1,
      creative: { platformNative: 8, culturalRelevance: 7, visualDistinctiveness: 8, strategicClarity: 9, engagementPotential: 8 },
      exec: "Trusted mass skincare — seasonal relevance plus dermatologist credibility drive broad reach.",
      campaigns: [{ title: "Winter Skin SOS", description: "Seasonal dry-skin campaign with creator dermatologists." }],
      whitespace: "Mass-trust positioning leaves premium derma open.", rec: "Nivea's seasonal-relevance playbook is the mass benchmark.",
      signalMatch: true, signalNote: "Found a **Winter Skin SOS** launch post dated 4 June promoting the moisturiser range.", signalLink: "https://instagram.com/niveasa" }),
    demoCard({ name: "Bio-Oil", handle: "@bio_oil", color: "#E8B64C", parent: "skincare",
      ig: "https://instagram.com/bio_oil", fb: "https://facebook.com/BioOil", x: "https://x.com/BioOil", tiktok: "@biooil", web: "https://bio-oil.com",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Scar & skin claims" },
        { platform: "Instagram", role: "Primary",  comment: "Real-skin stories" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Light",    comment: "Before/after" },
        { platform: "Website",   role: "Light",    comment: "Skin concerns" } ],
      themes: { Promotions: 40, Product: 80, Serves: 30, Seasonal: 20, Lifestyle: 50 },
      insight: "Bio-Oil leaned into efficacy proof, with **real-skin transformation** stories and scar/stretch-mark claims dominating its single-hero feed.",
      sentiment: { positive: 78, neutral: 17, negative: 5 }, freq: { Facebook: 14, Instagram: 16, X: 0, TikTok: 10 }, score: 7.7,
      creative: { platformNative: 7, culturalRelevance: 7, visualDistinctiveness: 8, strategicClarity: 9, engagementPotential: 7 },
      exec: "Single-hero focus with strong efficacy proof — narrow range, very clear claim.",
      campaigns: [{ title: "Real-skin stories", description: "User transformation content proving efficacy." }],
      whitespace: "One-product brand; limited routine play.", rec: "Bio-Oil's proof-led storytelling is worth studying for credibility." }),
    demoCard({ name: "The Ordinary", handle: "@theordinary", color: "#6B7280", parent: "skincare",
      ig: "https://instagram.com/theordinary", fb: "https://facebook.com/theordinary", x: "https://x.com/theordinary", tiktok: "@theordinary", web: "https://theordinary.com",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Ingredient-led" },
        { platform: "Instagram", role: "Primary",  comment: "Clinical minimal" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Ingredient education" },
        { platform: "Website",   role: "Primary",  comment: "Regimen builder" } ],
      themes: { Promotions: 30, Product: 82, Serves: 25, Seasonal: 15, Lifestyle: 40 },
      insight: "The Ordinary won on transparency, with **ingredient-education** content and its clinical-minimal aesthetic driving a science-led following.",
      sentiment: { positive: 75, neutral: 20, negative: 5 }, freq: { Facebook: 8, Instagram: 18, X: 0, TikTok: 20 }, score: 8.3,
      creative: { platformNative: 9, culturalRelevance: 8, visualDistinctiveness: 9, strategicClarity: 9, engagementPotential: 8 },
      exec: "Transparency and affordability as brand — ingredient education builds trust and TikTok reach.",
      campaigns: [{ title: "Ingredient education", description: "Explainer content demystifying actives." }],
      whitespace: "Clinical tone can feel cold / impersonal.", rec: "The Ordinary's transparency model is the trust-building benchmark." }),
    demoCard({ name: "Cetaphil SA", handle: "@cetaphil_sa", color: "#0093D0", parent: "skincare",
      ig: "https://instagram.com/cetaphil_sa", fb: "https://facebook.com/CetaphilSA", x: "https://x.com/Cetaphil", tiktok: "@cetaphil", web: "https://cetaphil.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Derma-recommended" },
        { platform: "Instagram", role: "Primary",  comment: "Sensitive-skin" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Light",    comment: "Gentle routines" },
        { platform: "Website",   role: "Light",    comment: "Skin advice" } ],
      themes: { Promotions: 38, Product: 76, Serves: 30, Seasonal: 25, Lifestyle: 42 },
      insight: "Cetaphil owned the gentle, derma-recommended space, with **#CetaphilGentle** content and sensitive-skin authority leading June.",
      sentiment: { positive: 74, neutral: 21, negative: 5 }, freq: { Facebook: 14, Instagram: 16, X: 0, TikTok: 11 }, score: 7.6,
      creative: { platformNative: 7, culturalRelevance: 7, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 7 },
      exec: "Derma-trust positioning — gentle, sensitive-skin authority with steady, reassuring content.",
      campaigns: [{ title: "#CetaphilGentle", description: "Sensitive-skin authority content." }],
      whitespace: "Functional tone; limited lifestyle appeal.", rec: "Cetaphil's derma-trust angle is a credibility benchmark." }),
  ],
  haircare: [
    demoCard({ name: "Cantu SA", handle: "@cantubeauty", color: "#C97B3C", parent: "haircare",
      ig: "https://instagram.com/cantubeauty", fb: "https://facebook.com/cantubeauty", x: "https://x.com/cantubeauty", tiktok: "@cantubeauty", web: "https://cantubeauty.com",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Curl care" },
        { platform: "Instagram", role: "Primary",  comment: "Natural-hair pride" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Wash-day routines" },
        { platform: "Website",   role: "Light",    comment: "Product finder" } ],
      themes: { Promotions: 45, Product: 75, Serves: 30, Seasonal: 20, Lifestyle: 65 },
      insight: "Cantu celebrated natural-hair culture, with **#CantuCurls** wash-day creator routines and texture-positive content leading June.",
      sentiment: { positive: 78, neutral: 17, negative: 5 }, freq: { Facebook: 14, Instagram: 20, X: 0, TikTok: 24 }, score: 8.2,
      creative: { platformNative: 9, culturalRelevance: 10, visualDistinctiveness: 8, strategicClarity: 8, engagementPotential: 9 },
      exec: "Community-led and culturally rooted — Cantu owns natural-hair pride with authentic creator content.",
      campaigns: [{ title: "#CantuCurls", description: "Wash-day routine creator series." }],
      whitespace: "Heavy curl focus; little straight/relaxed content.", rec: "Cantu's cultural authenticity is the haircare benchmark.",
      signalMatch: true, signalNote: "Found a **#CantuCurls** wash-day creator series dated 6 June on TikTok and Instagram.", signalLink: "https://instagram.com/cantubeauty" }),
    demoCard({ name: "Dark and Lovely", handle: "@darkandlovely", color: "#7D3C98", parent: "haircare",
      ig: "https://instagram.com/darkandlovelysa", fb: "https://facebook.com/DarkandLovelySA", x: "https://x.com/darkandlovely", tiktok: "@darkandlovely", web: "https://darkandlovely.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Colour & care" },
        { platform: "Instagram", role: "Primary",  comment: "Bold transformations" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Light",    comment: "Colour reveals" },
        { platform: "Website",   role: "Light",    comment: "Shade range" } ],
      themes: { Promotions: 55, Product: 72, Serves: 25, Seasonal: 25, Lifestyle: 55 },
      insight: "Dark and Lovely drove bold self-expression, with **colour-transformation** reveals and heritage-brand trust anchoring its feed.",
      sentiment: { positive: 70, neutral: 23, negative: 7 }, freq: { Facebook: 16, Instagram: 18, X: 0, TikTok: 12 }, score: 7.5,
      creative: { platformNative: 7, culturalRelevance: 8, visualDistinctiveness: 8, strategicClarity: 7, engagementPotential: 7 },
      exec: "Heritage trust plus bold colour — strong transformation content, lighter on creator-native formats.",
      campaigns: [{ title: "Colour transformations", description: "Before/after colour reveal content." }],
      whitespace: "Less creator-native than Cantu.", rec: "Heritage trust is an asset; creator formats are the gap." }),
    demoCard({ name: "TRESemmé SA", handle: "@tresemmesa", color: "#444444", parent: "haircare",
      ig: "https://instagram.com/tresemmesa", fb: "https://facebook.com/TRESemmeSA", x: "https://x.com/TRESemme", tiktok: "@tresemme", web: "https://tresemme.co.za",
      snapshot: [
        { platform: "Facebook",  role: "Primary",  comment: "Salon-at-home" },
        { platform: "Instagram", role: "Primary",  comment: "Pro styling" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Light",    comment: "Style hacks" },
        { platform: "Website",   role: "Light",    comment: "Routines" } ],
      themes: { Promotions: 50, Product: 70, Serves: 28, Seasonal: 22, Lifestyle: 52 },
      insight: "TRESemmé pushed its **salon-professional** positioning, with styling-routine content and pro-quality cues leading the period.",
      sentiment: { positive: 66, neutral: 26, negative: 8 }, freq: { Facebook: 14, Instagram: 16, X: 0, TikTok: 10 }, score: 7.3,
      creative: { platformNative: 7, culturalRelevance: 6, visualDistinctiveness: 7, strategicClarity: 8, engagementPotential: 7 },
      exec: "Salon-pro positioning at mass price — consistent styling content, limited cultural specificity.",
      campaigns: [{ title: "Salon professional", description: "Pro-quality styling-at-home messaging." }],
      whitespace: "Generic vs locally-rooted rivals.", rec: "TRESemmé's pro positioning is sound but culturally generic." }),
    demoCard({ name: "SheaMoisture", handle: "@sheamoisture", color: "#2E7D32", parent: "haircare",
      ig: "https://instagram.com/sheamoisture", fb: "https://facebook.com/SheaMoisture", x: "https://x.com/SheaMoisture", tiktok: "@sheamoisture", web: "https://sheamoisture.com",
      snapshot: [
        { platform: "Facebook",  role: "Light",    comment: "Natural ingredients" },
        { platform: "Instagram", role: "Primary",  comment: "Clean & community" },
        { platform: "X",         role: "Inactive", comment: "" },
        { platform: "TikTok",    role: "Primary",  comment: "Curl routines" },
        { platform: "Website",   role: "Light",    comment: "Hair quiz" } ],
      themes: { Promotions: 40, Product: 72, Serves: 30, Seasonal: 18, Lifestyle: 68 },
      insight: "SheaMoisture led with purpose, pairing **clean-ingredient** storytelling and community values with curl-routine creator content.",
      sentiment: { positive: 76, neutral: 19, negative: 5 }, freq: { Facebook: 10, Instagram: 18, X: 0, TikTok: 20 }, score: 7.8,
      creative: { platformNative: 8, culturalRelevance: 9, visualDistinctiveness: 8, strategicClarity: 8, engagementPotential: 8 },
      exec: "Purpose and clean-ingredient led — community values plus curl expertise build loyal advocacy.",
      campaigns: [{ title: "Clean ingredients", description: "Natural-ingredient and community-values storytelling." }],
      whitespace: "Premium-natural price limits mass reach.", rec: "SheaMoisture's purpose-led model is the values benchmark." }),
  ],
};

/* Returns a deep copy of demo cards for the selected brand's category, or null */
function loadDemoCompetitors(brandSel) {
  const cat = BRANDS[brandSel]?.category;
  const set = DEMO_DATA[cat];
  if (!set) return null;
  return set.map(c => ({ ...c, posts: [...c.posts], snapshot: c.snapshot.map(s => ({ ...s })), themes: c.themes.map(t => ({ ...t })) }));
}

async function loadSheetCompetitors(brandSel, colors, month, year, market) {
  const mk = market || "sa";
  const cacheKey = `${mk}-${brandSel}-${month}-${year}`;
  if (_sheetCache[cacheKey]) return _sheetCache[cacheKey];
  const raw = await fetchSheetTab(brandSel, month, year, mk);
  const cards = raw.map(c => freshCard(c, colors[brandSel], brandSel, "synced"));
  _sheetCache[cacheKey] = cards;
  return cards;
}

function invalidateSheetCache(brandSel) {
  /* brandSel may appear anywhere in the composite "{market}-{brand}-{m}-{y}" key */
  if (brandSel) Object.keys(_sheetCache).forEach(k => { if (k.includes(`-${brandSel}-`)) delete _sheetCache[k]; });
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
    name: c.name, fb: c.fb || "", ig: c.ig || "", x: c.x || "", tiktok: c.tiktok || "", web: c.web || "",
    handle: deriveHandle(c), note: c.note || "",
    color, parent, source: sourceTag || "synced",
    snapshot: platsFor(parent).map((p) => ({ platform: p, role: "", comment: "" })),
    themes: THEME_LABELS.map((l) => ({ label: l, value: 0 })),
    insight: "",
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    postFrequency: Object.fromEntries(socialPlatsFor(parent).map(p => [p, 0])),
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
    signalLink: "",
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
const LS_KEY = "signal_gemini_key";
function getStoredKey() { return localStorage.getItem(LS_KEY) || ""; }

/* ---- Shared team config from the tracker sheet's "Config" tab ----
   Two columns: key | value. Recognised keys: apify_token, gemini_key.
   Lets one person set keys for the whole team — no per-user prompts. */
let _sharedConfig = null;
async function fetchSharedConfig() {
  if (_sharedConfig) return _sharedConfig;
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Config`);
    if (!res.ok) return (_sharedConfig = {});
    const rows = parseCSV(await res.text());
    const cfg = {};
    rows.forEach(r => {
      const k = (r[0] || "").replace(/^"|"$/g, "").trim().toLowerCase();
      const v = (r[1] || "").replace(/^"|"$/g, "").trim();
      if (k && v && ["apify_token", "gemini_key"].includes(k)) cfg[k] = v;
    });
    return (_sharedConfig = cfg);
  } catch { return (_sharedConfig = {}); }
}

/* ---- Apify: auto-load Instagram creative into post slots ---- */
function getApifyToken() { return localStorage.getItem('signal_apify_token') || ''; }
function saveApifyToken(t) { localStorage.setItem('signal_apify_token', t); }

async function fetchApifyCreative(igUrl, apifyToken, month, year) {
  if (!igUrl || !apifyToken) return [];
  const handle = igUrl.replace(/.*instagram\.com\//, '').replace(/\/+$/, '').replace(/^@/, '');
  if (!handle) return [];

  /* Pull a wider pool (up to 48) so we can filter down to the reporting month.
     instagram-scraper needs ≥1GB memory; 256MB makes runs die instantly. */
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=240&memory=1024`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apifyToken },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsType: 'posts',
        resultsLimit: 48,
        addParentData: false,
      })
    }
  );

  if (!res.ok) {
    let msg = 'Apify error ' + res.status;
    try {
      const err = await res.json();
      if (err?.error?.message) msg = `Apify (${res.status}): ${err.error.message}`;
    } catch {}
    if (res.status === 401) msg = "Apify token rejected — paste a valid token (apify.com → Settings → API & Integrations).";
    if (res.status === 408) msg = "Instagram scrape timed out — try again in a moment.";
    throw new Error(msg);
  }
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error("Apify returned no posts for @" + handle);

  const imgOf = (p) => p.displayUrl || p.imageUrl || p.thumbnailUrl || (Array.isArray(p.images) ? p.images[0] : '') || '';
  const posts = items.filter(p => !p.error && imgOf(p));

  /* Prefer posts FROM the reporting month; fall back to most-recent if none.
     Apify returns each post's `timestamp` (ISO 8601). */
  let pool = posts;
  if (month != null && year != null) {
    const inMonth = posts.filter(p => {
      const t = p.timestamp ? new Date(p.timestamp) : null;
      return t && !isNaN(t) && t.getUTCMonth() === month && t.getUTCFullYear() === year;
    });
    if (inMonth.length) pool = inMonth;
  }
  /* newest first within the chosen pool */
  pool.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return pool.slice(0, 6).map(imgOf).filter(Boolean);
}
function saveKey(k) { localStorage.setItem(LS_KEY, k.trim()); }
function clearKey() { localStorage.removeItem(LS_KEY); }

/* ---- Gemini daily call counter (free tier ≈ 1,500/day) ---- */
function getGeminiCallsToday() {
  const stored = JSON.parse(localStorage.getItem('signal_gemini_quota') || '{}');
  const today = new Date().toDateString();
  if (stored.date !== today) return 0;
  return stored.calls || 0;
}

function incrementGeminiCalls() {
  const today = new Date().toDateString();
  const stored = JSON.parse(localStorage.getItem('signal_gemini_quota') || '{}');
  const calls = stored.date === today ? (stored.calls || 0) + 1 : 1;
  localStorage.setItem('signal_gemini_quota', JSON.stringify({ date: today, calls }));
  return calls;
}

/* Check if the local dev proxy is alive (fast, no throws) */
async function proxyAlive() {
  try {
    const r = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch { return false; }
}

/* Hosted serverless proxy (Vercel /api) — holds the Gemini key server-side
   so beta testers never need one. Probed once and cached. */
let _serverProxy = null;
async function serverProxyAvailable() {
  if (_serverProxy !== null) return _serverProxy;
  try {
    const r = await fetch("/api/health", { signal: AbortSignal.timeout(2500) });
    const d = await r.json().catch(() => ({}));
    _serverProxy = !!(r.ok && d.keyConfigured);
  } catch { _serverProxy = false; }
  return _serverProxy;
}
function getUserEmail() { try { return localStorage.getItem("signal_user_email") || ""; } catch { return ""; } }

/* Direct browser call to Gemini with auto-retry on 429/503 */
async function callGeminiBrowser(prompt, apiKey, attempt = 0) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    /* Key sent via header — supports both legacy AIzaSy and new AQ. key formats */
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      tools: [{ google_search: {} }],
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
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
    /* One retry after 90s — safely covers the 60s per-minute RPM reset window */
    const wait = 90000;
    console.info(`[Gemini] 429 — retrying once in ${wait/1000}s`);
    if (window.__onAnalyzeStatus) window.__onAnalyzeStatus("Rate limit hit — waiting 90s then retrying automatically…");
    await new Promise(r => setTimeout(r, wait));
    return callGeminiBrowser(prompt, apiKey, attempt + 1);
  }
  if (res.status === 429) {
    /* Second 429 = daily quota exhausted, no point retrying */
    if (window.__onAnalyzeStatus) window.__onAnalyzeStatus("Daily API quota reached — click Re-analyze tomorrow or check your Gemini key.");
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

/* Primary entry point. Order of preference:
   1) Hosted serverless proxy (Vercel /api) — key held server-side, no client key
   2) Local dev proxy (proxy-server.js on :4323)
   3) Direct browser call with a user-supplied key */
async function callGemini(prompt, apiKey) {
  /* 1) Hosted proxy — beta path. No client key required. */
  if (await serverProxyAvailable()) {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, email: getUserEmail() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.text) return data.text;
    throw new Error(data.error || `Proxy error ${res.status}`);
  }

  /* 2) + 3) require a key (local dev / static hosting) */
  const key = apiKey || getStoredKey();
  if (!key) throw new Error("no_key: No API key configured.");
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
  console.info("[Gemini] Proxy offline — using direct browser call");
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

/* Strip **highlight markers** for plain-text contexts (PDF/PPT exports) */
function stripHi(text) {
  return String(text || "").replace(/\*\*(.+?)\*\*/g, "$1");
}

/* ---- analyzeWindow: grounded brand window analysis ---- */
async function analyzeWindow(card, clientLabel, month, year, apiKey, signalKeyword, market) {
  const plats = platsFor(card.parent);
  const socialPlats = socialPlatsFor(card.parent);
  const hasTikTok = plats.includes("TikTok");
  const mkt = (MARKETS[market] && MARKETS[market].label) || "South Africa";

  const handles = [
    card.ig     && `Instagram: ${card.ig}`,
    card.fb     && `Facebook: ${card.fb}`,
    card.x      && `X/Twitter: ${card.x}`,
    card.tiktok && hasTikTok && `TikTok: ${card.tiktok}`,
    card.web    && `Website: ${card.web}`,
  ].filter(Boolean).join("\n");

  const signalInstruction = signalKeyword
    ? `\n10. SIGNAL DETECTION — Search specifically for any content by ${card.name} related to the keyword/theme "${signalKeyword}" during ${MONTHS[month]} ${year} (e.g. new product launch, flavour, campaign, collab). Set signalMatch:true if found, signalNote to a 1-2 sentence description, and signalLink to the URL of the specific post or article where it was found. If not found, signalMatch:false, signalNote:"No matching content found.", signalLink:"".`
    : "";

  const snapshotRows = plats.map(p =>
    `    {"platform":"${p}","role":"Primary|Light|Inactive","comment":"<=4 words"}`).join(",\n");
  const freqRow = socialPlats.map(p => `"${p}":<est. posts/month>`).join(",");

  const prompt =
`You are a senior brand strategist at John Joseph building a monthly competitor intelligence report for the ${mkt} market (category: ${clientLabel}).

Use Google Search to research the competitor brand "${card.name}" in the ${mkt} market.
${handles ? `Search these channels for recent activity:\n${handles}` : ""}
Reporting period: ${MONTHS[month]} ${year}.

Search for:
1. Platform activity and posting patterns on ${plats.join(", ")}${hasTikTok ? ". If the brand has no TikTok presence, set its TikTok role to Inactive with comment \"No TikTok presence\"" : ""}
2. Recent campaigns, promotions, or product launches in ${mkt}
3. Content themes and creative direction
4. Audience sentiment and engagement signals
5. A 2-sentence executive summary of their overall ${MONTHS[month]} ${year} strategy
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

  let raw = await callGemini(prompt, apiKey);
  incrementGeminiCalls();
  let cd  = parseChartData(raw);
  /* Grounding occasionally returns partial/truncated output — retry up to twice */
  for (let attempt = 0; !cd && attempt < 2; attempt++) {
    console.info(`[analyzeWindow] No chart_data — retry ${attempt + 1}/2`);
    await new Promise(r => setTimeout(r, 4000));
    raw = await callGemini(prompt, apiKey);
    incrementGeminiCalls();
    cd  = parseChartData(raw);
  }
  if (!cd) throw new Error("No <chart_data> block in Gemini response.");

  const byPlat = {};
  (cd.snapshot || []).forEach(s => { if (s?.platform) byPlat[s.platform.toLowerCase()] = s; });
  const snapshot = plats.map(p => {
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
  const postFrequency = Object.fromEntries(socialPlats.map(p =>
    [p, Math.max(0, Math.round(Number(cd.postFrequency?.[p]) || 0))]));
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
  const rawLink = String(cd.signalLink || "").trim();
  const signalLink = /^https?:\/\//.test(rawLink) ? rawLink : "";

  return {
    snapshot, themes, insight, sentiment, postFrequency, effectivenessScore,
    executiveSummary, keyCampaigns, contentSnapshot, creativeScores,
    whitespace, recommendations, signalMatch, signalNote, signalLink,
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

/* ---- auditCompetitor: month-by-month social audit over a period range ---- */
async function auditCompetitor(name, fromMonth, fromYear, toMonth, toYear, apiKey) {
  const fromLbl = `${MONTHS[fromMonth]} ${fromYear}`;
  const toLbl   = `${MONTHS[toMonth]} ${toYear}`;
  const prompt =
`You are a senior brand strategist building a period-over-period social media audit for the South African market.

Use Google Search to research the brand "${name}" in South Africa across the period ${fromLbl} to ${toLbl} (inclusive).

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

  let raw = await callGemini(prompt, apiKey);
  let cd  = parseChartData(raw);
  if (!cd) {
    await new Promise(r => setTimeout(r, 4000));
    raw = await callGemini(prompt, apiKey);
    cd  = parseChartData(raw);
  }
  if (!cd || !Array.isArray(cd.timeline)) throw new Error("No <chart_data> block in Gemini response.");
  return {
    timeline: cd.timeline.map(t => ({
      month: String(t.month || ""),
      headline: String(t.headline || ""),
      summary: String(t.summary || ""),
      activityLevel: Math.min(10, Math.max(1, Math.round(Number(t.activityLevel) || 5))),
    })),
    trend: String(cd.trend || "").trim(),
  };
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
    const tot = Object.values(card.postFrequency || {}).reduce((a, b) => a + (b || 0), 0);
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
  const combinedInsight = state.cards.filter(c=>c.insight).map(c=>stripHi(c.insight)).join(" ").slice(0, 420);
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

    if (card.executiveSummary) y1 = textBlock("EXECUTIVE SUMMARY", stripHi(card.executiveSummary), [241,247,255], navy2, PAD, y1, C1W);
    if (card.insight) y1 = textBlock("STRATEGIC INSIGHT", stripHi(card.insight), navy, [200,220,240], PAD, y1, C1W);

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
      slide.addText(stripHi(c.executiveSummary), { x:LX+0.18, y:1.33, w:LW-0.3, h:0.72, fontSize:9.5, color:TEXT2, fontFace:"Calibri", valign:"top", wrap:true });
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
      slide.addText(stripHi(c.insight), { x:RX+0.2, y:3.27, w:RW-0.3, h:0.45, fontSize:9.5, color:TEXT2, fontFace:"Calibri", wrap:true });
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
