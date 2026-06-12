/* ============================================================
   APP ROOT — Brand Window
   ============================================================ */
const { useState, useRef } = React;

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

  const isRateLimitErr = (e) => {
    const m = (e.message || "").toLowerCase();
    return m.includes("rate") || m.includes("quota") || m.includes("429");
  };

  if (!apiKey) {
    return <SetupScreen onSave={(k) => setApiKey(k)} />;
  }
  const [signalKeyword, setSignalKeyword] = useState(() => localStorage.getItem("cs_signal_kw") || "");

  const [brandSel, setBrandSel] = useState("hunters");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [runState, setRunState] = useState("idle");
  const [fetchErr, setFetchErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [cards, setCards] = useState([]);

  const handleSetApiKey = (k) => { localStorage.setItem("cs_gemini_key", k); setApiKey(k); };
  const handleSetSignal = (k) => { localStorage.setItem("cs_signal_kw", k); setSignalKeyword(k); };
  const handleSetApifyToken = (t) => { saveApifyToken(t); setApifyToken(t); };

  const brandLabel = BRANDS[brandSel].name;
  const brandCat = BRANDS[brandSel].cat;
  const ctxColor = colors[brandSel];
  const hasCards = cards.length > 0;

  const invalidate = () => { setRunState("idle"); setCards([]); setFetchErr(null); };
  const chooseBrand = (b) => { if (b !== brandSel) { setBrandSel(b); setRunState("idle"); setCards([]); setFetchErr(null); } };
  const chooseMonth = (m) => { setMonth(m); invalidate(); };
  const chooseYear  = (y) => { setYear(y); invalidate(); };

  const onRun = async () => {
    setRunState("running");
    setFetchErr(null);
    try {
      const fetched = await loadSheetCompetitors(brandSel, colors, month, year);
      setCards(fetched);
      setRunState("ready");

      /* Auto-analyze every competitor sequentially with a small stagger */
      if (fetched.length > 0 && !aiUnavailable) {
        for (let i = 0; i < fetched.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 12000)); /* 12s stagger — Gemini free tier is 10 RPM */
          setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: true } : c));
          try {
            const res = await analyzeWindow(fetched[i], BRANDS[brandSel].name, month, year, apiKey, signalKeyword);
            setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink } : c));
          } catch (e) {
            console.error("Auto-analyze failed for", fetched[i].name, e);
            if (e.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
            if (isRateLimitErr(e)) {
              /* silent retry: wait out the rate-limit window, try once more */
              await new Promise(r => setTimeout(r, 65000));
              try {
                const res = await analyzeWindow(fetched[i], BRANDS[brandSel].name, month, year, apiKey, signalKeyword);
                setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink } : c));
                continue;
              } catch (e2) {
                console.error("Retry failed for", fetched[i].name, e2);
                if (e2.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
                setCards(prev => prev.map((c, ci) => ci === i ? { ...c, analyzing: false, analyzeError: e2.message } : c));
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
      const res = await analyzeWindow(card, brandLabel, month, year, apiKey, signalKeyword);
      patchCard(ci, { analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink });
    } catch (e) {
      console.error("Analyze failed", e);
      if (e.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
      if (isRateLimitErr(e)) {
        /* silent retry: wait out the rate-limit window, try once more */
        await new Promise(r => setTimeout(r, 65000));
        try {
          const res = await analyzeWindow(card, brandLabel, month, year, apiKey, signalKeyword);
          patchCard(ci, { analyzing: false, analyzed: true, snapshot: res.snapshot, themes: res.themes, insight: res.insight, sentiment: res.sentiment, postFrequency: res.postFrequency, effectivenessScore: res.effectivenessScore, executiveSummary: res.executiveSummary, keyCampaigns: res.keyCampaigns, contentSnapshot: res.contentSnapshot, creativeScores: res.creativeScores, whitespace: res.whitespace, recommendations: res.recommendations, signalMatch: res.signalMatch, signalNote: res.signalNote, signalLink: res.signalLink });
          return;
        } catch (e2) {
          console.error("Retry failed", e2);
          if (e2.message?.toLowerCase().includes("leaked")) { resetKey(); return; }
          patchCard(ci, { analyzing: false, analyzeError: e2.message });
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
      token = window.prompt("Paste your Apify API token to load social creative.\nGet one free at apify.com/sign-up:");
      if (!token?.trim()) return;
      handleSetApifyToken(token.trim());
    }

    patchCard(ci, { loadingCreative: true });
    try {
      const urls = await fetchApifyCreative(card.ig, token);
      urls.forEach((url, idx) => onSetPost(ci, idx, url));
      patchCard(ci, { loadingCreative: false });
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
    try {
      const comps = await suggestCompetitors(brandLabel, brandCat, apiKey);
      setCards(comps.map((c) => freshCard(c, ctxColor, brandSel, "ai")));
      setRunState("ready");
    } catch (e) { console.error("Suggest failed", e); }
    setSuggesting(false);
  };

  const stateForExport = () => ({ brandLabel, brandColor: ctxColor, month, year, cards, signalKeyword });
  const onGenerate = async () => {
    setBusy(true);
    try { await generatePDF(stateForExport()); } catch (e) { console.error(e); }
    setBusy(false);
  };
  const [reportBusy, setReportBusy] = useState(false);
  const [pptBusy, setPptBusy] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const onGenerateReport = async () => {
    setReportBusy(true);
    try { await generateReport(stateForExport()); } catch (e) { console.error(e); }
    setReportBusy(false);
  };
  const onGeneratePPT = async () => {
    setPptBusy(true);
    try { await generatePPT(stateForExport()); } catch (e) { console.error(e); }
    setPptBusy(false);
  };

  const analyzedCount = cards.filter((c) => c.analyzed).length;
  const canReport = canExport && analyzedCount > 0;
  const allAnalyzing = cards.some((c) => c.analyzing);
  const canExport = runState === "ready" && hasCards;

  return (
    <div className="app">
      <Preloader cards={cards} runState={runState} />
      <Sidebar
        brandSel={brandSel} setBrandSel={chooseBrand}
        month={month} setMonth={chooseMonth} year={year} setYear={chooseYear}
        runState={runState} onRun={onRun} colors={colors}
        onGenerate={onGenerate} busy={busy} canExport={canExport}
        signalKeyword={signalKeyword} setSignalKeyword={handleSetSignal}
        onGenerateReport={onGenerateReport} reportBusy={reportBusy} canReport={canReport}
        onGeneratePPT={onGeneratePPT} pptBusy={pptBusy}
        onShowMethodology={() => setShowMethodology(true)}
        onShowAudit={() => setShowAudit(true)} />

      <MethodologyPanel show={showMethodology} onClose={() => setShowMethodology(false)} />
      <SocialAuditPanel show={showAudit} onClose={() => setShowAudit(false)} cards={cards} apiKey={apiKey} year={year} />
      <main className="stage">
        <div className="stage-inner">
          <div className="stage-head">
            <div>
              <div className="sh-eyebrow">John Joseph · Strategy Intelligence</div>
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
  const k = getStoredKey();
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
