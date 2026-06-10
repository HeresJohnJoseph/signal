/* ============================================================
   UI — Brand Window template + control sidebar
   ============================================================ */
const { useState: _useS, useRef: _useR, useLayoutEffect: _useLE, useCallback: _useCB } = React;

/* ---------- Interactive post image slot ---------- */
function PostSlot({ imageUrl, onSet, slotIdx }) {
  const [drag, setDrag] = _useS(false);

  const applyFile = _useCB((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onSet(slotIdx, e.target.result);
    reader.readAsDataURL(file);
  }, [slotIdx, onSet]);

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { applyFile(file); return; }
    /* also try dragged image URL */
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && /^https?:/.test(url)) onSet(slotIdx, url);
  };

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) applyFile(item.getAsFile());
  };

  const onClick = () => {
    if (imageUrl) { onSet(slotIdx, ""); return; } /* click filled = clear */
    const url = window.prompt("Paste image URL from the competitor's feed:");
    if (url?.trim()) onSet(slotIdx, url.trim());
  };

  return (
    <div
      className={"post-slot" + (drag ? " drag-over" : "") + (imageUrl ? " filled" : "")}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      onClick={onClick}
      tabIndex={0}
      title={imageUrl ? "Click to clear" : "Click · Paste (⌘V) · Drop image"}
    >
      {imageUrl
        ? <img src={imageUrl} alt="post" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"14px", display:"block" }} />
        : <div className="post-slot-empty">
            <span className="ps-ic">＋</span>
          </div>
      }
    </div>
  );
}

const DESIGN_W = 1380, DESIGN_H = 781;

/* ---------- Collapsible insight bar (above canvas) ---------- */
function InsightBar({ insight }) {
  const [expanded, setExpanded] = _useS(false);
  const LIMIT = 130;
  const needs = insight.length > LIMIT;
  return (
    <div className="wp-insight">
      <span className="wi-ic">◈</span>
      <span className="wi-text">
        {expanded || !needs ? insight : insight.slice(0, LIMIT) + "…"}
        {needs && (
          <button className="wi-toggle" onClick={() => setExpanded(v => !v)}>
            {expanded ? " ▴ Less" : " ▾ Read more"}
          </button>
        )}
      </span>
    </div>
  );
}

/* ---------- Platform glyphs (inline SVG) ---------- */
function PlatformSVG({ name, white }) {
  const fill = white ? "#fff" : "#fff";
  const v = name.toLowerCase();
  if (v === "facebook")
    return (<svg viewBox="0 0 24 24" fill={fill}><path d="M14 9V7c0-1 .4-1.6 1.7-1.6H17V2.4h-2.5C11.6 2.4 10 4.2 10 6.9V9H8v3.1h2V22h3.6v-9.9H16l.5-3.1H14z"/></svg>);
  if (v === "instagram")
    return (<svg viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill={fill} stroke="none"/></svg>);
  return (<svg viewBox="0 0 24 24" fill={fill}><path d="M3 3h4.5l4 5.6L16.4 3H21l-6.8 8.2L21.5 21H17l-4.4-6.1L7.2 21H3l7.2-8.6L3 3z"/></svg>);
}

function PlatformChip({ name, active }) {
  const bg = active
    ? (name.toLowerCase() === "facebook" ? "#1877F2" : name.toLowerCase() === "instagram" ? "#2B3A53" : "#15171A")
    : null;
  return (
    <div className={"pf-chip " + (active ? "on" : "off")} style={active ? { background: bg } : undefined}>
      <PlatformSVG name={name} />
    </div>
  );
}

function SnapIcon({ name }) {
  const bg = name.toLowerCase() === "facebook" ? "#1877F2" : name.toLowerCase() === "instagram" ? "#2B3A53" : "#15171A";
  return (<span className="sp-ic" style={{ background: bg }}><PlatformSVG name={name} /></span>);
}

/* ---------- The fixed template canvas ---------- */
function WindowCanvas({ card, idx, total, brandLabel, year, ids, onSetPost }) {
  return (
    <div className="wp-canvas" data-screen-label={`Window ${String(idx + 1).padStart(2, "0")} · ${card.name}`}>
      {/* header */}
      <div className="wp-eyebrow-row">
        <div className="wp-eyebrow">Competitor Snapshot · {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
        <div className="wp-active-lbl">Active On</div>
      </div>

      <div className="wp-identity">
        <div className="wp-id-left">
          <image-slot id={ids.logo} data-kind="logo" style={{ width: "84px", height: "84px" }} shape="circle" placeholder="Logo"></image-slot>
          <div className="wp-name-block">
            <div className="wp-name">{card.name}</div>
            <div className="wp-name-sub">Social Presence &amp; Creative</div>
          </div>
        </div>
        <div className="wp-actives">
          {card.snapshot.map((s) => (
            <PlatformChip key={s.platform} name={s.platform} active={isActive(s.role)} />
          ))}
        </div>
      </div>

      {/* insight strip inside canvas */}
      {card.insight && (
        <div className="wp-canvas-insight">
          <span className="wci-label">Strategic Insight</span>
          <span className="wci-text">{card.insight.length > 160 ? card.insight.slice(0, 157) + "…" : card.insight}</span>
        </div>
      )}

      {/* body */}
      <div className="wp-body">
        <div className="wp-col">
          {/* SOCIAL SNAPSHOT */}
          <div className="wp-card">
            <div className="wp-card-head"><span className="ch-dot"></span><span className="ch-t">Social Snapshot</span></div>
            <div className="snap-head"><span>Platform</span><span>Role</span><span>Comment</span></div>
            {card.snapshot.map((s) => (
              <div className="snap-row" key={s.platform}>
                <div className="snap-plat"><SnapIcon name={s.platform} /><span className="sp-name">{s.platform}</span></div>
                <div className="snap-role">
                  <span className={"sr-dot " + roleClass(s.role)}></span>
                  <span className={"sr-lbl " + (isActive(s.role) ? "" : "muted")}>{s.role || "—"}</span>
                </div>
                <div className={"snap-comment " + (s.comment ? "" : "empty")}>{s.comment || "Awaiting analysis"}</div>
              </div>
            ))}
          </div>

          {/* SENTIMENT INDEX */}
          {(card.sentiment?.positive > 0 || card.sentiment?.neutral > 0 || card.sentiment?.negative > 0) && (
            <div className="wp-card sent-card">
              <div className="wp-card-head"><span className="ch-dot"></span><span className="ch-t">Sentiment Index</span></div>
              <div className="sent-bar-wrap">
                <div className="sent-bar">
                  {card.sentiment.positive > 0 && <div className="sent-seg pos" style={{ width: card.sentiment.positive + "%" }} title={`Positive ${card.sentiment.positive}%`}></div>}
                  {card.sentiment.neutral  > 0 && <div className="sent-seg neu" style={{ width: card.sentiment.neutral  + "%" }} title={`Neutral ${card.sentiment.neutral}%`}></div>}
                  {card.sentiment.negative > 0 && <div className="sent-seg neg" style={{ width: card.sentiment.negative + "%" }} title={`Negative ${card.sentiment.negative}%`}></div>}
                </div>
                <div className="sent-legend">
                  <span className="sl-item pos-l"><span className="sl-dot"></span>{card.sentiment.positive}% Positive</span>
                  <span className="sl-item neu-l"><span className="sl-dot"></span>{card.sentiment.neutral}% Neutral</span>
                  <span className="sl-item neg-l"><span className="sl-dot"></span>{card.sentiment.negative}% Negative</span>
                </div>
              </div>
            </div>
          )}

          {/* KEY CONTENT THEMES */}
          <div className="wp-card grow">
            <div className="wp-card-head"><span className="ch-dot"></span><span className="ch-t">Key Content Themes</span></div>
            <div className="themes-wrap">
              {card.themes.map((t) => (
                <div className="theme-row" key={t.label}>
                  <span className="theme-lbl">{t.label}</span>
                  <div className="theme-track">
                    <div className={"theme-fill " + (t.label === "Promotions" ? "coral" : "navy")}
                         style={{ width: Math.max(2, t.value) + "%" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SOCIAL CREATIVE */}
        <div className="wp-card grow">
          <div className="wp-card-head"><span className="ch-dot"></span><span className="ch-t">Social Creative</span></div>
          <div className="creative-sub">
            <image-slot id={ids.avatar} data-kind="avatar" style={{ width: "38px", height: "38px" }} shape="circle" placeholder=""></image-slot>
            <div className="creative-handle">
              {card.ig
                ? <a href={card.ig} target="_blank" rel="noopener noreferrer" className="ch-handle ch-link">{card.handle}</a>
                : <span className="ch-handle">{card.handle}</span>
              }
              <span className="ch-note">Open a profile below → right-click a post → Copy Image → paste into slot</span>
            </div>
            <div className="profile-links">
              {card.ig && <a href={card.ig} target="_blank" rel="noopener noreferrer" className="plink plink-ig" title="Open Instagram"><PlatformSVG name="Instagram" /></a>}
              {card.fb && <a href={card.fb} target="_blank" rel="noopener noreferrer" className="plink plink-fb" title="Open Facebook"><PlatformSVG name="Facebook" /></a>}
              {card.x  && <a href={card.x}  target="_blank" rel="noopener noreferrer" className="plink plink-x"  title="Open X"><PlatformSVG name="X" /></a>}
            </div>
          </div>
          <div className="post-grid">
            {[0,1,2,3,4,5].map((n) => (
              <PostSlot key={n} slotIdx={n} imageUrl={(card.posts || [])[n] || ""} onSet={onSetPost} />
            ))}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="wp-footer">
        {card.creativeScores ? (
          <div className="wp-scores-row">
            {Object.entries(card.creativeScores).map(([k, v]) => (
              <div className="wsr-item" key={k}>
                <div className="wsr-bar-wrap"><div className="wsr-bar" style={{ width: (v * 10) + "%" }}></div></div>
                <span className="wsr-val">{typeof v === "number" ? v.toFixed(1) : v}</span>
                <span className="wsr-key">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="wp-foot-center">John Joseph</div>
        )}
        <div className="wp-foot-right">{brandLabel} Brand<br/>Window {year}</div>
      </div>
    </div>
  );
}

/* ---------- Scaled, framed page with action bar ---------- */
function WindowPage(props) {
  const { card, idx, total, brandLabel, year, onAnalyze, aiUnavailable, signalKeyword, onSetPost } = props;
  const outer = _useR(null);
  const [scale, setScale] = _useS(0.5);

  _useLE(() => {
    const el = outer.current; if (!el) return;
    const fit = () => { const w = el.clientWidth; if (w) setScale(w / DESIGN_W); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slug = slugify(card.name);
  const ids = {
    logo: `logo-${card.parent}-${slug}`,
    avatar: `avatar-${card.parent}-${slug}`,
    posts: [0,1,2,3,4,5].map((n) => `post-${card.parent}-${slug}-${n}`),
  };

  return (
    <div className="wp-block">
      <div className="wp-bar">
        <div className="wp-bar-id">
          <span className="wb-dot" style={{ background: card.color }}></span>
          <span className="wb-name">{card.name}</span>
          <span className={"wb-prov " + (card.source === "synced" ? "synced" : "ai")}>
            {card.source === "synced" ? "Synced" : "AI"}
          </span>
          {card.effectivenessScore !== null && card.effectivenessScore !== undefined && (
            <span className="wb-score" title="Creative Effectiveness Score (Gemini)">
              <span className="wb-score-ic">◎</span>{card.effectivenessScore.toFixed(1)}<span className="wb-score-denom">/10</span>
            </span>
          )}
          {card.signalMatch && signalKeyword && (
            <span className="wb-signal" title={card.signalNote || "Signal match"}>
              <span className="ws-dot">◉</span>
              <span className="ws-lbl">Signal</span>
              <span className="ws-kw">{signalKeyword}</span>
            </span>
          )}
        </div>
        <button className={"wp-analyze " + (card.analyzing ? "busy " : "") + (card.analyzed ? "done" : "")}
                onClick={() => onAnalyze(idx)} disabled={card.analyzing || aiUnavailable}>
          <span className="sparkle">✦</span>
          {card.analyzing ? "Analyzing…" : (card.analyzed ? "Re-analyze" : "Analyze")}
        </button>
      </div>
      {card.analyzeError && (
        <div className="wp-err-bar">
          <span className="web-ic">⚠</span>
          <span className="web-msg">
            {card.analyzeError.startsWith("quota_exceeded")
              ? "Analysis unavailable right now — the intelligence engine is at capacity and will reset overnight. Slide data and exports are unaffected."
              : card.analyzeError.startsWith("No <chart_data>")
                ? "Analysis returned an incomplete response — click Re-analyze to try again."
                : card.analyzeError.startsWith("Gemini blocked")
                  ? "Content was flagged by the AI filter — try a different competitor or re-analyze."
                  : `Analysis could not complete: ${card.analyzeError}`}
          </span>
        </div>
      )}
      {card.insight && <InsightBar insight={card.insight} />}
      <div className={"wp-frame" + (card.analyzing ? " analyzing" : "")} ref={outer} style={{ height: DESIGN_H * scale }}>
        <div className="wp-scale" style={{ transform: `scale(${scale})`, width: DESIGN_W, height: DESIGN_H }}>
          <WindowCanvas card={card} idx={idx} total={total} brandLabel={brandLabel} year={year} ids={ids}
            onSetPost={(slotIdx, url) => onSetPost && onSetPost(idx, slotIdx, url)} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Analysis Preloader overlay ---------- */
function Preloader({ cards, runState }) {
  const [tick, setTick] = _useS(0);
  const [statusMsg, setStatusMsg] = _useS("");

  /* Pulse the orb every 600ms */
  _useLE(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 600);
    return () => clearInterval(id);
  }, []);

  /* Listen for retry status messages from callGeminiBrowser */
  _useLE(() => {
    window.__onAnalyzeStatus = (msg) => setStatusMsg(msg);
    return () => { delete window.__onAnalyzeStatus; };
  }, []);

  const isRunning = runState === "running";
  const analyzingIdx = cards.findIndex(c => c.analyzing);
  const analyzingCard = analyzingIdx >= 0 ? cards[analyzingIdx] : null;
  const doneCount = cards.filter(c => c.analyzed).length;
  const errorCount = cards.filter(c => c.analyzeError).length;
  const totalCount = cards.length;
  const isAnalyzing = analyzingCard !== null;
  const visible = isRunning || isAnalyzing;

  if (!visible) return null;

  const dots = "●●●●".slice(0, (tick % 4) + 1).padEnd(4, "○");
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="preloader-toast">
      <div className="plt-orb-wrap">
        <div className="plt-orb" style={{ animationDelay: "0s" }}></div>
        <div className="plt-orb plt-orb-2" style={{ animationDelay: ".2s" }}></div>
        <div className="plt-orb plt-orb-3" style={{ animationDelay: ".4s" }}></div>
        <span className="plt-glyph">◈</span>
      </div>
      <div className="plt-body">
        <div className="plt-title">
          {isRunning
            ? "Loading competitors…"
            : analyzingCard
              ? `Analyzing ${analyzingCard.name}`
              : "Processing…"}
        </div>
        <div className="plt-sub">
          {isRunning
            ? "Fetching from Google Sheet tracker"
            : statusMsg
              ? statusMsg
              : `${doneCount} of ${totalCount} complete · Gemini + Google Search`}
        </div>
        {isAnalyzing && totalCount > 0 && (
          <div className="plt-progress">
            <div className="plt-prog-track">
              <div className="plt-prog-fill" style={{ width: progress + "%" }}></div>
            </div>
            <span className="plt-prog-pct">{progress}%</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="plt-err-note">{errorCount} failed — check console</div>
        )}
      </div>
      <div className="plt-dots">{dots}</div>
    </div>
  );
}

/* ---------- Category Overview Slide ---------- */
function CategorySlide({ cards, month, year, brandLabel }) {
  const analyzed = cards.filter(c => c.analyzed);
  if (analyzed.length < 2) return null;

  const monthName = ["January","February","March","April","May","June","July","August","September","October","November","December"][month] || "";

  /* Sort by effectiveness score */
  const ranked = [...analyzed].filter(c => c.effectivenessScore != null)
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore);

  /* Collect all theme labels across competitors */
  const allThemes = [];
  analyzed.forEach(c => { (c.themes || []).forEach(t => { if (!allThemes.includes(t.label)) allThemes.push(t.label); }); });
  const topThemes = allThemes.slice(0, 6);

  return (
    <div className="cat-slide">
      <div className="cat-head">
        <div className="cat-eyebrow">Category Overview · {monthName} {year}</div>
        <div className="cat-title">{brandLabel} Competitive Intelligence</div>
        <div className="cat-sub">{analyzed.length} competitors analyzed · Powered by Gemini + Google Search</div>
      </div>

      <div className="cat-body">
        {/* Effectiveness Ranking */}
        <div className="cat-card">
          <div className="cat-card-head"><span className="cat-ch-dot"></span>Effectiveness Ranking</div>
          <div className="cat-rank-list">
            {ranked.map((c, i) => (
              <div className="cat-rank-row" key={c.name}>
                <span className="crr-pos">#{i + 1}</span>
                <span className="crr-dot" style={{ background: c.color }}></span>
                <span className="crr-name">{c.name}</span>
                <div className="crr-track">
                  <div className="crr-fill" style={{ width: (c.effectivenessScore / 10 * 100) + "%", background: c.color }}></div>
                </div>
                <span className="crr-score">{c.effectivenessScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Comparison */}
        <div className="cat-card">
          <div className="cat-card-head"><span className="cat-ch-dot"></span>Sentiment Comparison</div>
          <div className="cat-sent-list">
            {analyzed.map(c => {
              const s = c.sentiment || {};
              const total = (s.positive || 0) + (s.neutral || 0) + (s.negative || 0);
              if (!total) return null;
              return (
                <div className="cat-sent-row" key={c.name}>
                  <span className="csr-name" style={{ borderLeft: `3px solid ${c.color}` }}>{c.name}</span>
                  <div className="csr-bar">
                    {s.positive > 0 && <div className="csr-seg pos" style={{ width: s.positive + "%" }} title={`Positive ${s.positive}%`}></div>}
                    {s.neutral > 0  && <div className="csr-seg neu" style={{ width: s.neutral + "%" }}  title={`Neutral ${s.neutral}%`}></div>}
                    {s.negative > 0 && <div className="csr-seg neg" style={{ width: s.negative + "%" }} title={`Negative ${s.negative}%`}></div>}
                  </div>
                  <span className="csr-pos-pct">{s.positive || 0}%</span>
                </div>
              );
            })}
          </div>
          <div className="cat-sent-legend">
            <span className="csl pos">Positive</span>
            <span className="csl neu">Neutral</span>
            <span className="csl neg">Negative</span>
          </div>
        </div>

        {/* Content Theme Heat Map */}
        <div className="cat-card">
          <div className="cat-card-head"><span className="cat-ch-dot"></span>Content Theme Matrix</div>
          <div className="cat-heat-table">
            <div className="cht-header" style={{ gridTemplateColumns: `100px repeat(${analyzed.length}, 1fr)` }}>
              <span className="cht-corner">Theme</span>
              {analyzed.map(c => <span className="cht-col-label" key={c.name} style={{ color: c.color }}>{c.name.split(" ")[0]}</span>)}
            </div>
            {topThemes.map(theme => (
              <div className="cht-row" key={theme} style={{ gridTemplateColumns: `100px repeat(${analyzed.length}, 1fr)` }}>
                <span className="cht-theme-lbl">{theme}</span>
                {analyzed.map(c => {
                  const t = (c.themes || []).find(t => t.label === theme);
                  const v = t ? t.value : 0;
                  const opacity = v > 0 ? 0.15 + (v / 100) * 0.85 : 0;
                  return (
                    <div className="cht-cell" key={c.name} style={{ background: v > 0 ? `rgba(26,58,92,${opacity})` : "transparent" }}>
                      {v > 0 && <span className="cht-cell-val">{v}%</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Platform Activity */}
        <div className="cat-card">
          <div className="cat-card-head"><span className="cat-ch-dot"></span>Platform Activity</div>
          <div className="cat-plat-table">
            <div className="cpt-header">
              <span className="cpt-corner"></span>
              <span className="cpt-plat-h">Facebook</span>
              <span className="cpt-plat-h">Instagram</span>
              <span className="cpt-plat-h">X</span>
            </div>
            {analyzed.map(c => {
              const pf = c.postFrequency || {};
              const max = Math.max(1, pf.Facebook || 0, pf.Instagram || 0, pf.X || 0);
              return (
                <div className="cpt-row" key={c.name}>
                  <span className="cpt-brand" style={{ borderLeft: `3px solid ${c.color}` }}>{c.name.split(" ")[0]}</span>
                  {["Facebook","Instagram","X"].map(plt => {
                    const n = pf[plt] || 0;
                    return (
                      <div className="cpt-cell" key={plt}>
                        <div className="cpt-bar-wrap"><div className="cpt-bar" style={{ height: (n / max * 100) + "%" }}></div></div>
                        <span className="cpt-n">{n > 0 ? n : "–"}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="cpt-footnote">Estimated posts · current month</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Methodology + Lexicon Panel ---------- */
function MethodologyPanel({ show, onClose }) {
  if (!show) return null;
  return (
    <div className="meth-overlay" onClick={onClose}>
      <div className="meth-panel" onClick={e => e.stopPropagation()}>
        <div className="meth-head">
          <div>
            <div className="meth-eyebrow">Brand Window · Intelligence Engine</div>
            <div className="meth-title">Methodology &amp; Lexicon</div>
          </div>
          <button className="meth-close" onClick={onClose}>✕</button>
        </div>

        <div className="meth-body">
          <div className="meth-section">
            <div className="meth-sec-title">How it works</div>
            <p>Brand Window uses <strong>Gemini 2.5 Flash</strong> with <strong>Google Search grounding</strong> to conduct live competitor research for the selected reporting month. Each analysis pull draws on indexed social posts, press coverage, and brand activity — not static training data. Results are returned as structured intelligence covering social presence, content strategy, creative effectiveness, and audience sentiment.</p>
            <p>Data is sourced from your live <strong>Competitor Tracker Google Sheet</strong>. The sheet defines which competitors to profile per brand, their social handles, and the reporting month each row applies to. Run Snapshot fetches only the rows matching your selected month and year.</p>
          </div>

          <div className="meth-section">
            <div className="meth-sec-title">Lexicon</div>
            <div className="meth-lex-grid">
              {[
                ["Primary", "The brand's most-invested platform — highest posting frequency and production quality."],
                ["Light", "Platform is active but used secondarily — lower cadence or repurposed content."],
                ["Inactive", "Platform exists but shows no meaningful activity in the reporting period."],
                ["Effectiveness Score", "A 1–10 composite score generated by Gemini assessing creative quality, strategic consistency, audience alignment, and content originality."],
                ["Sentiment Index", "Estimated breakdown of positive, neutral, and negative audience sentiment based on comments, reactions, and content tone in the reporting month."],
                ["Content Themes", "The dominant topics a brand posted about, expressed as a percentage share of their content volume. Derived from post analysis."],
                ["Signal Keyword", "A user-defined topic (e.g. 'new flavour', 'summer', 'FIFA') that Gemini uses to flag competitors who ran posts matching that theme in the period — surfaced as a Signal badge."],
                ["Key Campaigns", "Named or identifiable campaign activations run during the reporting month, identified by Gemini from available sources."],
                ["Creative Scores", "Five sub-dimensions rated 1–10: Recall (memorability), Engagement (interaction quality), Shareability (virality potential), Brand Fit (consistency with brand identity), Cultural Resonance (relevance to current audience culture)."],
                ["Whitespace", "Strategic territory the competitor is not addressing — potential opportunity space for your brand."],
                ["Grounded Search", "Gemini is instructed to use live Google Search results rather than cached training data, ensuring analysis reflects the specific reporting month."],
              ].map(([term, def]) => (
                <div className="lex-entry" key={term}>
                  <div className="lex-term">{term}</div>
                  <div className="lex-def">{def}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="meth-section">
            <div className="meth-sec-title">Data sources &amp; limitations</div>
            <p>Analysis is based on publicly available social media posts, brand websites, and media coverage. Private analytics (reach, impressions, paid spend) are not accessible. Post frequency figures are Gemini estimates and may not match platform-native analytics exactly. For the highest accuracy, supplement AI analysis with screenshots from the competitor&apos;s live profiles using the post slots on each slide.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sidebar control panel ---------- */
function Sidebar(props) {
  const { brandSel, setBrandSel, month, setMonth, year, setYear, runState, onRun,
          colors, onGenerate, busy, canExport,
          signalKeyword, setSignalKeyword,
          onGenerateReport, reportBusy, canReport,
          onGeneratePPT, pptBusy,
          onShowMethodology } = props;
  const st = runState === "running" ? { cls: "running", txt: "◍ Running…" }
           : runState === "ready" ? { cls: "ready", txt: "◉ Windows Ready" }
           : { cls: "idle", txt: "◌ Awaiting Run" };

  const brandRow = (key, label, dot) => {
    const sel = brandSel === key;
    return (
      <div className={"brand-opt" + (sel ? " sel" : "")} onClick={() => setBrandSel(key)} role="radio" aria-checked={sel}>
        <span className="brand-dot" style={{ background: dot }}></span>
        <span className="brand-name">{label}</span>
        <span className="brand-radio"></span>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sb-scroll">
        <div className="brandmark">
          <div className="bm-icon">◈</div>
          <div>
            <div className="wm">Brand Window</div>
            <div className="sub">John Joseph · Intelligence</div>
          </div>
        </div>
        <div className="sb-rule"></div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">01</span><span className="lbl">Select Brand</span></div>
          <div className="brand-list">
            {brandRow("hunters", "Hunters", colors.hunters)}
            {brandRow("amarula", "Amarula", colors.amarula)}
            {brandRow("bernini", "Bernini", colors.bernini)}
          </div>
        </div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">02</span><span className="lbl">Reporting Period</span></div>
          <div className="period-row">
            <div className="col-month">
              <label className="field-label">Month</label>
              <select className="sb-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="col-year">
              <label className="field-label">Year</label>
              <input className="sb-input" type="number" value={year} min="2020" max="2030" onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">03</span><span className="lbl">Signal Keyword</span></div>
          <input
            className="sb-input signal-input"
            type="text"
            placeholder="e.g. new flavour, summer, FIFA…"
            value={signalKeyword}
            onChange={e => setSignalKeyword(e.target.value)}
          />
          {signalKeyword
            ? <div className="signal-hint active">◉ Gemini will flag competitors who ran posts matching this keyword</div>
            : <div className="signal-hint">Optional · detect competitor activity around a theme</div>
          }
        </div>

        <button className={"cta " + (runState === "running" ? "running" : "")} onClick={onRun} disabled={runState === "running"}>
          <span className="glyph">◈</span>{runState === "running" ? "Running…" : "Run Snapshot"}
        </button>
        <div className="cta-hint">Syncs competitor links from the tracker<br/>into a brand window per competitor.</div>

        <button className={"btn-ghost " + (busy ? "busy" : "")} onClick={onGenerate} disabled={!canExport || busy}>
          <span className="sparkle">↓</span>{busy ? "Compiling…" : "Generate Slides PDF"}
        </button>

        <button className={"btn-report " + (reportBusy ? "busy" : "")} onClick={onGenerateReport} disabled={!canReport || reportBusy}>
          <span className="rep-ic">▤</span>{reportBusy ? "Building report…" : "Export Intelligence Report"}
        </button>

        <button className={"btn-ppt " + (pptBusy ? "busy" : "")} onClick={onGeneratePPT} disabled={!canExport || pptBusy}>
          <span className="ppt-ic">⬛</span>{pptBusy ? "Building deck…" : "Export PowerPoint Deck"}
        </button>

        <button className="btn-meth" onClick={onShowMethodology}>
          <span className="meth-ic">ℹ</span>Methodology &amp; Lexicon
        </button>

        <div className="src-chip">
          <span className="src-ic">⊞</span>
          <span className="src-body">
            <span className="src-k">Data Source</span>
            <span className="src-v">Competitor Tracker · Sheet</span>
          </span>
          <span className="src-live">LIVE</span>
        </div>
      </div>

      <div className="sb-footer">
        <span className={"status-dot " + st.cls}></span>
        <span className="status-txt">{st.txt}</span>
      </div>
    </aside>
  );
}

Object.assign(window, { WindowPage, Sidebar, CategorySlide, MethodologyPanel, Preloader, DESIGN_W, DESIGN_H });
