/* ============================================================
   APP ROOT — Brand Window
   ============================================================ */
const { useState, useRef } = React;

/* Demo mode (?demo=1): skips sign-in + API key, loads pre-analyzed data */
const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';

function App() {
  const colors = {
    amarula:  "#C8860A", bernini:  "#4A7FB5", hunters:  "#2E6B2F",
    qsr:      "#E87722", retail:   "#0071CE", telecoms: "#E60000",
    beauty:   "#D4498F", skincare: "#7BC8A4", haircare: "#9B59B6",
  };

  const [apiKey, setApiKey] = useState(() => getStoredKey());
  const [apifyToken, setApifyToken] = useState(() => getApifyToken());
  const aiUnavailable = false;

  const resetKey = () => { clearKey(); setApiKey(""); };

  /* Daily free-tier exhaustion is NOT worth a 65s retry — it won't clear until
     tomorrow. Distinguish it from a transient per-minute spike. */
  const isDailyQuotaErr = (e) => /per day|perday|daily|requests per day/i.test(e.message || "");
  const isRateLimitErr = (e) => {
    const m = (e.message || "").toLowerCase();
    return m.includes("rate") || m.includes("quota") || m.includes("429");
  };

  /* Hosted serverless proxy holds the key — no per-user key needed */
  const serverProxy = typeof window !== "undefined" && window.__signalServerProxy === true;
  if (!apiKey && !DEMO_MODE && !serverProxy) {
    return <SetupScreen onSave={(k) => setApiKey(k)} />;
  }
  const [signalKeyword, setSignalKeyword] = useState(() => localStorage.getItem("cs_signal_kw") || "");

  const [marketSel, setMarketSel] = useState(() => localStorage.getItem("cs_market") || "sa");
  const [brandSel, setBrandSel] = useState("hunters");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [runState, setRunState] = useState("idle");
  const [fetchErr, setFetchErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [cards, setCards] = useState([]);
  const [geminiCalls, setGeminiCalls] = useState(() => getGeminiCallsToday());
  /* Tier (Free / Solo / Agency). Default open until the sheet says otherwise so
     nothing downgrades before the Tier column exists. */
  const [tierInfo, setTierInfo] = useState({ tier: "agency", gating: false });
  const [paywall, setPaywall] = useState(null);   // { gate } when a free user hits a locked export
  const [stripeUrl, setStripeUrl] = useState("");
  React.useEffect(() => {
    if (DEMO_MODE) return;
    let alive = true;
    (async () => {
      const t = await getUserTier(getUserEmail()); if (alive) setTierInfo(t);
      const u = await getStripeProUrl(); if (alive) setStripeUrl(u);
    })();
    return () => { alive = false; };
  }, []);

  const handleSetApiKey = (k) => { localStorage.setItem("cs_gemini_key", k); setApiKey(k); };
  const handleSetSignal = (k) => { localStorage.setItem("cs_signal_kw", k); setSignalKeyword(k); };
  const handleSetApifyToken = (t) => { saveApifyToken(t); setApifyToken(t); };
  const refreshQuota = () => setGeminiCalls(getGeminiCallsToday());

  /* Returning from a successful Stripe checkout → mark Pro + welcome. */
  const [proWelcome, setProWelcome] = useState(false);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pro") === "success") {
      setProStatus(true);
      if (window.posthog) window.posthog.capture("pro_checkout_success", { email: getUserEmail() });
      params.delete("pro");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
      setProWelcome(true);
    }
  }, []);

  const brandLabel = contextLabel(brandSel, marketSel);
  const brandCat = BRANDS[brandSel].cat;
  const ctxColor = colors[brandSel] || (BRANDS[brandSel] && BRANDS[brandSel].color) || "#FF5500";
  const hasCards = cards.length > 0;

  /* Tier-derived gates (demo is always fully open + clean). Free = PDF-only +
     forced watermark; paid = all formats + clean. Legacy (no Tier column) keeps
     full access + watermark so nothing changes until tiers are configured. */
  const effTier = DEMO_MODE ? "agency" : tierInfo.tier;
  const gating  = DEMO_MODE ? false : tierInfo.gating;
  const isFreeTier = gating && effTier === "free";
  const exportWatermark = DEMO_MODE ? false : (!gating ? true : effTier === "free");

  const invalidate = () => { setRunState("idle"); setCards([]); setFetchErr(null); };
  const chooseBrand = (b) => { if (b !== brandSel) { setBrandSel(b); setRunState("idle"); setCards([]); setFetchErr(null); } };
  const chooseMonth = (m) => { setMonth(m); invalidate(); };
  const chooseYear  = (y) => { setYear(y); invalidate(); };
  const chooseMarket = (m) => {
    if (m === marketSel) return;
    localStorage.setItem("cs_market", m);
    setMarketSel(m);
    /* US/UK have no per-brand alcohol tabs — snap an alcohol brand to a category default */
    if (m !== "sa" && BRANDS[brandSel] && BRANDS[brandSel].category === "alcohol" && brandSel !== "hunters") setBrandSel("hunters");
    setRunState("idle"); setCards([]); setFetchErr(null);
  };

  /* Zero-token demand capture. Returns a result so the input can confirm inline.
     If the brand is already on the platform we say so (and don't log noise). */
  const onRequestBrand = (raw) => {
    const q = (raw || "").trim();
    if (!q) return { ok: false };
    const knownKey = findKnownBrand(q, marketSel);
    if (knownKey) {
      if (window.posthog) window.posthog.capture('brand_request_existing', { brand: q, market: marketSel });
      return { ok: true, existing: true, name: BRANDS[knownKey].name };
    }
    requestBrand(q, marketSel);
    if (window.posthog) window.posthog.capture('brand_requested', { brand: q, market: marketSel });
    return { ok: true, existing: false };
  };

  const onRun = async () => {
    setRunState("running");
    setFetchErr(null);

    /* Demo mode — load pre-analyzed cards instantly, no API */
    if (DEMO_MODE) {
      const demo = loadDemoCompetitors(brandSel, marketSel);
      if (demo && demo.length) {
        setCards(demo);
        setRunState("ready");
        if (window.posthog) window.posthog.capture('run_snapshot', { brand: brandSel, competitor_count: demo.length, month, year, demo: true });
        if (window.posthog) window.posthog.capture('ran_snapshot', { market: marketSel, category: BRANDS[brandSel] && BRANDS[brandSel].category, brand: brandLabel, demo: true });
      } else {
        setFetchErr(`No demo data for ${brandLabel} yet — try QSR or an Alcohol brand.`);
        setRunState("idle");
      }
      return;
    }

    try {
      const fetched = await loadSheetCompetitors(brandSel, colors, month, year, marketSel);
      setCards(fetched);
      setRunState("ready");
      if (window.posthog) window.posthog.capture('run_snapshot', { brand: brandSel, competitor_count: fetched.length, month, year });
      if (window.posthog) window.posthog.capture('ran_snapshot', { market: marketSel, category: BRANDS[brandSel] && BRANDS[brandSel].category, brand: brandLabel });

      /* Auto-analyze every competitor sequentially with a small stagger */
      if (fetched.length > 0 && !aiUnavailable) {
        for (let i = 0; i < fetched.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 12000)); /* 12s stagger — Gemini free tier is 10 RPM */
          setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: true } : c));
          try {
            const res = await analyzeWindow(fetched[i], brandLabel, month, year, apiKey, signalKeyword, marketSel);
            setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink } : c));
            refreshQuota();
            if (window.posthog) window.posthog.capture('card_analyzed', { brand: brandSel, competitor: fetched[i].name });
          } catch (e) {
            console.error("Auto-analyze failed for", fetched[i].name, e);
            if (e.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
            if (isDailyQuotaErr(e)) {
              /* daily cap hit — mark this and all remaining windows, stop (won't clear today) */
              setCards(prev => prev.map((c, ci) => (ci >= i && !c.analyzed) ? { ...c, analyzing: false, analyzeError: "quota_daily" } : c));
              break;
            }
            if (isRateLimitErr(e)) {
              /* silent retry: wait out the per-minute window, try once more */
              await new Promise(r => setTimeout(r, 65000));
              try {
                const res = await analyzeWindow(fetched[i], brandLabel, month, year, apiKey, signalKeyword, marketSel);
                setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink } : c));
                refreshQuota();
                if (window.posthog) window.posthog.capture('card_analyzed', { brand: brandSel, competitor: fetched[i].name });
                continue;
              } catch (e2) {
                console.error("Retry failed for", fetched[i].name, e2);
                if (e2.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
                setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzeError: isDailyQuotaErr(e2) ? "quota_daily" : "rate_limit" } : c));
                continue;
              }
            }
            setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzeError: e.message } : c));
          }
        }
      }
    } catch (e) {
      console.error("Sheet fetch failed", e);
      setFetchErr(e.message || "Could not load sheet data");
      setRunState("idle");
    }
  };

  const patchCard = (ci, patch) => setCards((prev) => prev.map((c, i) => (i === ci ? { ...c, ...patch } : c)));

  const onAnalyze = async (ci) => {
    const card = cards[ci];
    patchCard(ci, { analyzing: true, analyzeError: null });
    try {
      const res = await analyzeWindow(card, brandLabel, month, year, apiKey, signalKeyword, marketSel);
      patchCard(ci, { analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink });
      if (window.posthog) window.posthog.capture('card_analyzed', { brand: brandSel, competitor: card.name });
      refreshQuota();
    } catch (e) {
      console.error("Analyze failed", e);
      if (e.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
      if (isDailyQuotaErr(e)) { patchCard(ci, { analyzing: false, analyzeError: "quota_daily" }); return; }
      if (isRateLimitErr(e)) {
        /* silent retry: wait out the per-minute window, try once more */
        await new Promise(r => setTimeout(r, 65000));
        try {
          const res = await analyzeWindow(card, brandLabel, month, year, apiKey, signalKeyword, marketSel);
          patchCard(ci, { analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink });
          if (window.posthog) window.posthog.capture('card_analyzed', { brand: brandSel, competitor: card.name });
          refreshQuota();
          return;
        } catch (e2) {
          console.error("Retry failed", e2);
          if (e2.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
          patchCard(ci, { analyzing: false, analyzeError: isDailyQuotaErr(e2) ? "quota_daily" : "rate_limit" });
          return;
        }
      }
      patchCard(ci, { analyzing: false, analyzeError: e.message });
    }
  };
  const onAnalyzeAll = async () => { for (let i = 0; i < cards.length; i++) if (!cards[i].analyzed) await onAnalyze(i); };

  const onLoadCreative = async (ci) => {
    const card = cards[ci];
    if (!card.ig) return;

    let token = apifyToken;
    if (!token) {
      /* shared team token from the sheet's Config tab — no prompt needed */
      const cfg = await fetchSharedConfig();
      if (cfg.apify_token) { token = cfg.apify_token; handleSetApifyToken(token); }
    }
    if (!token) {
      token = window.prompt("Paste your Apify API token to load social creative.\nGet one free at apify.com/sign-up:");
      if (!token?.trim()) return;
      handleSetApifyToken(token.trim());
    }

    patchCard(ci, { loadingCreative: true });
    try {
      const urls = await fetchApifyCreative(card.ig, token, month, year);
      urls.forEach((url, idx) => onSetPost(ci, idx, url));
      patchCard(ci, { loadingCreative: false });
      if (window.posthog) window.posthog.capture('load_creative', { brand: brandSel, competitor: card.name });
    } catch (e) {
      console.error("Apify creative load failed", e);
      if ((e.message || "").includes("token rejected")) handleSetApifyToken("");
      patchCard(ci, { loadingCreative: false, creativeError: e.message || "Couldn't load creative — try again." });
    }
  };

  const onSetPost = (cardIdx, slotIdx, url) => {
    setCards(prev => prev.map((c, i) => {
      if (i !== cardIdx) return c;
      const posts = [...(c.posts || ["","","","","",""])];
      posts[slotIdx] = url;
      return { ...c, posts };
    }));
  };

  const onSuggest = async () => {
    setSuggesting(true);
    setFetchErr(null);
    try {
      const comps = await suggestCompetitors(brandLabel, BRANDS[brandSel].category, marketSel);
      if (!comps.length) { setFetchErr("AI didn't return any competitors — try again."); return; }
      setCards(comps.map((c) => freshCard(c, ctxColor, brandSel, "ai")));
      setRunState("ready");
      if (window.posthog) window.posthog.capture('suggest_competitors', { brand: brandSel, market: marketSel, count: comps.length });
    } catch (e) {
      console.error("Suggest failed", e);
      const m = (e.message || "").toLowerCase();
      setFetchErr(
        /quota|rate|429/.test(m) ? "AI is at its limit right now — try again in a minute." :
        /not_allowed|403/.test(m) ? "Your account doesn't have access to AI suggestions yet." :
        /no_server|proxy|failed to fetch|networkerror/.test(m) ? "Couldn't reach the AI service — check your connection and try again." :
        "Couldn't suggest competitors — please try again."
      );
    } finally {
      setSuggesting(false);
    }
  };

  const stateForExport = () => ({ brandLabel, brandColor: ctxColor, month, year, cards, signalKeyword, watermark: exportWatermark });
  /* Free tier: clean PPT + Report are paid — intercept and surface the paywall. */
  const hitPaywall = (gate) => {
    setPaywall({ gate });
    if (window.posthog) window.posthog.capture('hit_paywall', { gate, tier: effTier });
  };
  const onGenerate = async () => {
    setBusy(true);
    try { await generatePDF(stateForExport()); if (window.posthog) { window.posthog.capture('export_pdf', { brand: brandSel }); window.posthog.capture('exported', { format: 'pdf', brand: brandSel }); } } catch (e) { console.error(e); }
    setBusy(false);
  };
  const [reportBusy, setReportBusy] = useState(false);
  const [pptBusy, setPptBusy] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const onGenerateReport = async () => {
    if (isFreeTier) { hitPaywall('export_report'); return; }
    setReportBusy(true);
    try { await generateReport(stateForExport()); if (window.posthog) window.posthog.capture('exported', { format: 'report', brand: brandSel }); } catch (e) { console.error(e); }
    setReportBusy(false);
  };
  const onGeneratePPT = async () => {
    if (isFreeTier) { hitPaywall('export_powerpoint'); return; }
    setPptBusy(true);
    try { await generatePPT(stateForExport()); if (window.posthog) { window.posthog.capture('export_ppt', { brand: brandSel }); window.posthog.capture('exported', { format: 'powerpoint', brand: brandSel }); } } catch (e) { console.error(e); }
    setPptBusy(false);
  };

  const analyzedCount = cards.filter((c) => c.analyzed).length;
  const allAnalyzing = cards.some((c) => c.analyzing);
  const canExport = runState === "ready" && hasCards;
  const canReport = canExport && analyzedCount > 0;

  return (
    <div className="app">
      {proWelcome && (
        <div onClick={() => setProWelcome(false)}
          style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
                   background: "var(--accent)", color: "#0C0F16", fontWeight: 700, fontSize: 14,
                   padding: "12px 22px", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.4)", cursor: "pointer" }}>
          ★ Welcome to Signal Pro — you now have full access. (click to dismiss)
        </div>
      )}
      {paywall && (
        <div className="paywall-overlay" onClick={() => setPaywall(null)}>
          <div className="paywall-card" onClick={(e) => e.stopPropagation()}>
            <div className="pw-kicker">UPGRADE TO UNLOCK</div>
            <h3>Clean, client-ready exports are a Pro feature</h3>
            <p>Your Free plan includes the <strong>watermarked PDF</strong>. Upgrade to remove the Signal watermark and export the <strong>PowerPoint deck</strong> and <strong>Intelligence Report</strong>.</p>
            <div className="pw-actions">
              <a className="pw-upgrade" href={stripeUrl ? proCheckoutLink(stripeUrl, getUserEmail()) : "signup.html#gopro"} target="_blank" rel="noopener">Upgrade to Pro</a>
              <button className="pw-dismiss" onClick={() => setPaywall(null)}>Maybe later</button>
            </div>
          </div>
        </div>
      )}
      <Preloader cards={cards} runState={runState} />
      <Sidebar
        marketSel={marketSel} setMarket={chooseMarket}
        brandSel={brandSel} setBrandSel={chooseBrand}
        onRequestBrand={onRequestBrand}
        month={month} setMonth={chooseMonth} year={year} setYear={chooseYear}
        runState={runState} onRun={onRun} colors={colors}
        onGenerate={onGenerate} busy={busy} canExport={canExport}
        signalKeyword={signalKeyword} setSignalKeyword={handleSetSignal}
        onGenerateReport={onGenerateReport} reportBusy={reportBusy} canReport={canReport}
        onGeneratePPT={onGeneratePPT} pptBusy={pptBusy} isFreeTier={isFreeTier}
        onShowMethodology={() => setShowMethodology(true)}
        onShowAudit={() => setShowAudit(true)}
        geminiCalls={geminiCalls} />

      <MethodologyPanel show={showMethodology} onClose={() => setShowMethodology(false)} />
      <SocialAuditPanel show={showAudit} onClose={() => setShowAudit(false)} cards={cards} apiKey={apiKey} year={year} />
      <main className="stage">
        <div className="stage-inner">
          <div className="stage-head">
            <div>
              <div className="sh-eyebrow">John Joseph · Strategy Intelligence · {MARKETS[marketSel] ? MARKETS[marketSel].label : "South Africa"}</div>
              <div className="sh-title">{brandLabel} · Signal</div>
            </div>
            <div className="sh-meta">
              <div className="sh-count">{MONTHS[month]} {year}</div>
              <div>{hasCards ? `${analyzedCount}/${cards.length} analyzed` : "—"}</div>
            </div>
          </div>

          {runState === "running" ? (
            <div className="stage-msg">
              <div className="sm-glyph" style={{ animation: "pulse 1s ease-in-out infinite" }}>◈</div>
              <h2>{hasCards ? `Analyzing ${brandLabel} competitors…` : `Loading ${brandLabel} competitors…`}</h2>
              <p>{hasCards ? `Running AI analysis on ${cards.filter(c=>c.analyzed).length} of ${cards.length} brand windows. Hang tight.` : "Fetching competitor links from the tracker sheet."}</p>
            </div>
          ) : runState !== "ready" ? (
            <div className="stage-msg">
              {fetchErr && <div className="sm-err">⚠ {fetchErr}</div>}
              <div className="sm-glyph">◈</div>
              <h2>Ready when you are.</h2>
              <p>Select a brand and reporting period, then run the snapshot to pull live competitor links from the tracker and build a brand window per competitor.</p>
              <div className="sm-meta">No windows loaded · {brandLabel}</div>
            </div>
          ) : !hasCards ? (
            <div className="stage-msg">
              <div className="sm-glyph">⬡</div>
              <h2>No competitor links for {brandLabel}.</h2>
              <p>The {brandLabel} tab of the tracker hasn't been synced yet. Share that tab — or let Claude propose the key {brandCat.toLowerCase()} competitors to profile now.</p>
              <button className={"sm-btn " + (suggesting ? "busy" : "")} onClick={onSuggest} disabled={suggesting || aiUnavailable}>
                <span className="sparkle">✦</span>{suggesting ? "Finding competitors…" : "Suggest competitors with AI"}
              </button>
              {aiUnavailable && <div className="sm-meta">AI unavailable in this view</div>}
            </div>
          ) : (
            <React.Fragment>
              <CategorySlide cards={cards} month={month} year={year} brandLabel={brandLabel} />
              <div className="stage-actions">
                <button className="btn-refresh" onClick={() => { invalidateSheetCache(brandSel); invalidate(); }} title="Re-fetch from sheet">↺ Refresh</button>
                <button className={"analyze-all " + (allAnalyzing ? "busy" : "")} onClick={onAnalyzeAll} disabled={allAnalyzing || aiUnavailable}>
                  <span className="sparkle">✦</span>{allAnalyzing ? "Analyzing all…" : "Analyze all windows"}
                </button>
              </div>
              <div className="pages">
                {cards.map((c, i) => (
                  <WindowPage key={brandSel + "-" + c.name} card={c} idx={i} total={cards.length}
                    brandLabel={brandLabel} year={year} onAnalyze={onAnalyze} aiUnavailable={aiUnavailable}
                    signalKeyword={signalKeyword} onSetPost={onSetPost} onLoadCreative={onLoadCreative} />
                ))}
              </div>
            </React.Fragment>
          )}
        </div>
      </main>
    </div>
  );
}

/* Validate any stored key before rendering — a dead/leaked key is cleared
   automatically so the user lands on the setup screen instead of a broken app. */
(async () => {
  /* Demo mode skips key validation entirely — render straight away */
  if (DEMO_MODE) {
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
    return;
  }
  /* Hosted serverless proxy (Vercel) — key lives server-side, no client key needed */
  if (await serverProxyAvailable()) {
    window.__signalServerProxy = true;
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
    return;
  }
  let k = getStoredKey();
  if (!k) {
    /* no local key — try the shared team key from the sheet's Config tab */
    const cfg = await fetchSharedConfig();
    if (cfg.gemini_key) { saveKey(cfg.gemini_key); k = cfg.gemini_key; }
  }
  if (k) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": k },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 1 } }),
      });
      if (res.status === 400 || res.status === 403) clearKey();
    } catch { /* network error — keep key, app will surface errors normally */ }
  }
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
