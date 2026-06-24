/* ============================================================
   UI — Brand Window template + control sidebar
   ============================================================ */
const { useState: _useS, useRef: _useR, useLayoutEffect: _useLE, useCallback: _useCB } = React;

/* ---------- Interactive post image slot ---------- */
/* Social CDNs (Instagram/Facebook) block hotlinking — external URLs are
   routed through the weserv.nl image proxy so they actually render. */
function proxiedSrc(url) {
  if (!url || url.startsWith("data:")) return url;
  if (/^https?:\/\//.test(url)) return "https://images.weserv.nl/?url=" + encodeURIComponent(url);
  return url;
}

function PostSlot({ imageUrl, onSet, slotIdx }) {
  const [drag, setDrag] = _useS(false);
  const [broken, setBroken] = _useS(false);

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
    if (url && /^https?:/.test(url)) { setBroken(false); onSet(slotIdx, url); }
  };

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) { applyFile(item.getAsFile()); return; }
    /* pasted text that is an image URL (e.g. Copy Image Address) */
    const txt = e.clipboardData?.getData("text/plain")?.trim();
    if (txt && /^https?:\/\//.test(txt)) { setBroken(false); onSet(slotIdx, txt); }
  };

  const onClick = () => {
    if (imageUrl) { setBroken(false); onSet(slotIdx, ""); return; } /* click filled = clear */
    const url = window.prompt("Paste image URL from the competitor's feed:");
    if (url?.trim()) { setBroken(false); onSet(slotIdx, url.trim()); }
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
      {imageUrl && !broken
        ? <img src={proxiedSrc(imageUrl)} alt="post"
               onError={(e) => {
                 /* Demo stock (loremflickr) is occasionally flaky — fall back to a
                    guaranteed-loading photo so the grid is never visibly broken.
                    Real pasted URLs keep the explicit "couldn't load" state. */
                 const orig = imageUrl || "";
                 if (orig.includes("loremflickr") && !e.target.dataset.fellBack) {
                   e.target.dataset.fellBack = "1";
                   e.target.src = proxiedSrc("https://picsum.photos/seed/sig" + slotIdx + (orig.length % 97) + "/400/500");
                 } else {
                   setBroken(true);
                 }
               }}
               style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"14px", display:"block" }} />
        : imageUrl && broken
        ? <div className="post-slot-empty">
            <span className="ps-ic">⚠</span>
            <span className="ps-err">Couldn't load — click to clear,<br/>then try Copy Image instead</span>
          </div>
        : <div className="post-slot-empty">
            <span className="ps-ic">＋</span>
          </div>
      }
    </div>
  );
}

const DESIGN_W = 1380, DESIGN_H = 781;

/* ---------- Key-activity highlighter ----------
   Renders **marked** phrases from Gemini as bold orange so campaign
   names and events jump out. Stray/unclosed markers are stripped. */
function Hi({ text }) {
  const parts = String(text || "").split(/\*\*(.+?)\*\*/g);
  return (
    <React.Fragment>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong className="hi-key" key={i}>{p}</strong>
          : <React.Fragment key={i}>{p.replace(/\*\*/g, "")}</React.Fragment>
      )}
    </React.Fragment>
  );
}

/* ---------- Collapsible insight bar (above canvas) ---------- */
function InsightBar({ insight }) {
  const [expanded, setExpanded] = _useS(false);
  const LIMIT = 130;
  const needs = insight.length > LIMIT;
  return (
    <div className="wp-insight">
      <span className="wi-ic">◈</span>
      <span className="wi-text">
        <Hi text={expanded || !needs ? insight : insight.slice(0, LIMIT) + "…"} />
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
  if (v === "tiktok")
    return (<svg viewBox="0 0 24 24" fill={fill}><path d="M16.6 3c.4 2.2 1.8 3.9 4 4.2v3.1c-1.5 0-2.9-.5-4-1.3v6.3c0 3.7-2.6 6.2-6 6.2-3.2 0-5.6-2.3-5.6-5.5 0-3.1 2.4-5.5 5.6-5.5.3 0 .7 0 1 .1v3.2c-.3-.1-.6-.2-1-.2-1.4 0-2.5 1.1-2.5 2.4 0 1.4 1.1 2.4 2.5 2.4 1.5 0 2.7-1.1 2.7-2.9V3h3.3z"/></svg>);
  if (v === "website")
    return (<svg viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.7 2.6 4 5.7 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.7-4-9s1.3-6.4 4-9z"/></svg>);
  return (<svg viewBox="0 0 24 24" fill={fill}><path d="M3 3h4.5l4 5.6L16.4 3H21l-6.8 8.2L21.5 21H17l-4.4-6.1L7.2 21H3l7.2-8.6L3 3z"/></svg>);
}

function platColor(name) {
  const v = name.toLowerCase();
  if (v === "facebook")  return "#1877F2";
  if (v === "instagram") return "#2B3A53";
  if (v === "tiktok")    return "#161823";
  if (v === "website")   return "#2E4B3F";
  return "#15171A";
}

function PlatformChip({ name, active }) {
  return (
    <div className={"pf-chip " + (active ? "on" : "off")} style={active ? { background: platColor(name) } : undefined}>
      <PlatformSVG name={name} />
    </div>
  );
}

function SnapIcon({ name }) {
  return (<span className="sp-ic" style={{ background: platColor(name) }}><PlatformSVG name={name} /></span>);
}

/* ---------- Signal badge with detail popup ---------- */
function SignalBadge({ keyword, note, link, brand }) {
  const [open, setOpen] = _useS(false);
  return (
    <span className="wb-signal-wrap">
      <span className={"wb-signal clickable" + (open ? " open" : "")} onClick={() => setOpen(v => !v)} title="Click for details">
        <span className="ws-dot">◉</span>
        <span className="ws-lbl">Signal</span>
        <span className="ws-kw">{keyword}</span>
        <span className="ws-caret">{open ? "▴" : "▾"}</span>
      </span>
      {open && (
        <div className="signal-pop" onClick={e => e.stopPropagation()}>
          <div className="sp-head">
            <span className="sp-title">Signal found · “{keyword}”</span>
            <button className="sp-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="sp-body"><Hi text={note || `${brand} ran content matching “${keyword}” this period.`} /></div>
          {link
            ? <a className="sp-link" href={link} target="_blank" rel="noopener noreferrer">View where it was found ↗</a>
            : <div className="sp-nolink">No direct link captured — check the brand's profile links on the slide.</div>}
        </div>
      )}
    </span>
  );
}

/* ---------- The fixed template canvas ---------- */
function WindowCanvas({ card, idx, total, brandLabel, year, ids, onSetPost, onLoadCreative }) {
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
          <span className="wci-text"><Hi text={card.insight.length > 160 ? card.insight.slice(0, 157) + "…" : card.insight} /></span>
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
              {card.tiktok && <a href={/^https?:/.test(card.tiktok) ? card.tiktok : `https://www.tiktok.com/@${card.tiktok.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="plink plink-tt" title="Open TikTok"><PlatformSVG name="TikTok" /></a>}
              {card.web && <a href={card.web} target="_blank" rel="noopener noreferrer" className="plink plink-web" title="Open Website"><PlatformSVG name="Website" /></a>}
            </div>
          </div>
          {card.ig && (
            <button
              className={"btn-load-creative" + (card.loadingCreative ? " busy" : "")}
              onClick={() => onLoadCreative && onLoadCreative()}
              disabled={card.loadingCreative}
              title="Auto-load recent posts from Instagram via Apify"
            >
              {card.loadingCreative ? "Loading creative…" : "✦ Auto-load Creative"}
            </button>
          )}
          {card.creativeError && <div className="creative-err">{card.creativeError}</div>}
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
  const { card, idx, total, brandLabel, year, onAnalyze, aiUnavailable, signalKeyword, onSetPost, onLoadCreative } = props;
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
            <SignalBadge keyword={signalKeyword} note={card.signalNote} link={card.signalLink} brand={card.name} />
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
            {card.analyzeError === "quota_daily"
              ? "Signal's shared AI allowance for today is used up — it resets tomorrow (≈ midnight PT). Your loaded windows and exports still work."
              : (card.analyzeError === "rate_limit" || card.analyzeError.startsWith("quota_exceeded"))
              ? "Signal's AI is busy right now — wait a moment, then click Re-analyze. (Shared free tier: ~10 requests/minute.)"
              : card.analyzeError.startsWith("No <chart_data>")
                ? "Analysis returned an incomplete response — click Re-analyze to try again."
                : card.analyzeError.startsWith("Gemini blocked")
                  ? "Content was flagged by the AI filter — try a different competitor or re-analyze."
                  : card.analyzeError.startsWith("no_key")
                    ? "No API key found — reload the page to set one up."
                    : `Analysis could not complete: ${card.analyzeError}`}
          </span>
        </div>
      )}
      {card.insight && <InsightBar insight={card.insight} />}
      <div className={"wp-frame" + (card.analyzing ? " analyzing" : "")} ref={outer} style={{ height: DESIGN_H * scale }}>
        <div className="wp-scale" style={{ transform: `scale(${scale})`, width: DESIGN_W, height: DESIGN_H }}>
          <WindowCanvas card={card} idx={idx} total={total} brandLabel={brandLabel} year={year} ids={ids}
            onSetPost={(slotIdx, url) => onSetPost && onSetPost(idx, slotIdx, url)}
            onLoadCreative={() => onLoadCreative && onLoadCreative(idx)} />
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
  /* Count the actively-analyzing card as half-done so the bar moves immediately */
  const effectiveDone = doneCount + (isAnalyzing ? 0.5 : 0);
  const progress = totalCount > 0 ? Math.round((effectiveDone / totalCount) * 100) : 0;

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
          <div className="plt-err-note">{errorCount} couldn't complete — click Re-analyze to retry</div>
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
            {(() => {
              /* dynamic platform columns — union across analyzed cards (Website excluded; not a feed) */
              const platCols = [];
              analyzed.forEach(c => Object.keys(c.postFrequency || {}).forEach(p => {
                if (p !== "Website" && !platCols.includes(p)) platCols.push(p);
              }));
              const gridCols = { gridTemplateColumns: `90px repeat(${platCols.length}, 1fr)` };
              return (
                <React.Fragment>
                  <div className="cpt-header" style={gridCols}>
                    <span className="cpt-corner"></span>
                    {platCols.map(p => <span className="cpt-plat-h" key={p}>{p}</span>)}
                  </div>
                  {analyzed.map(c => {
                    const pf = c.postFrequency || {};
                    const max = Math.max(1, ...platCols.map(p => pf[p] || 0));
                    return (
                      <div className="cpt-row" key={c.name} style={gridCols}>
                        <span className="cpt-brand" style={{ borderLeft: `3px solid ${c.color}` }}>{c.name.split(" ")[0]}</span>
                        {platCols.map(plt => {
                          const n = pf[plt] || 0;
                          const na = !(plt in pf); /* platform not tracked for this brand (e.g. alcohol × TikTok) */
                          return (
                            <div className="cpt-cell" key={plt}>
                              <div className="cpt-bar-wrap"><div className="cpt-bar" style={{ height: (n / max * 100) + "%" }}></div></div>
                              <span className="cpt-n">{na ? "n/a" : (n > 0 ? n : "–")}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })()}
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
            <div className="meth-eyebrow">Signal · Intelligence Engine</div>
            <div className="meth-title">Methodology &amp; Lexicon</div>
          </div>
          <button className="meth-close" onClick={onClose}>✕</button>
        </div>

        <div className="meth-body">
          <div className="meth-section">
            <div className="meth-sec-title">How it works</div>
            <p>Signal runs <strong>live web research</strong> through its proprietary intelligence engine for the selected reporting month — drawing on current social activity, press coverage, and brand signals rather than static data. Results are returned as structured intelligence covering social presence, content strategy, creative effectiveness, and audience sentiment.</p>
            <p>You define your competitor set and reporting period; Signal handles the research, scoring, and synthesis behind the scenes.</p>
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

/* ---------- Social Audit — period-over-period competitor view ---------- */
function SocialAuditPanel({ show, onClose, cards, apiKey, year }) {
  const [compName, setCompName] = _useS("");
  const [fromMonth, setFromMonth] = _useS(0);
  const [fromYear, setFromYear] = _useS(year);
  const [toMonth, setToMonth] = _useS(5);
  const [toYear, setToYear] = _useS(year);
  const [busy, setBusy] = _useS(false);
  const [err, setErr] = _useS("");
  const [result, setResult] = _useS(null);

  if (!show) return null;
  const names = cards.map(c => c.name);
  const name = compName || names[0] || "";

  const monthCount = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  const rangeOk = monthCount >= 1 && monthCount <= 12;

  const run = async () => {
    if (!name.trim()) { setErr("Enter a competitor name."); return; }
    if (!rangeOk) { setErr("Pick a range of 1–12 months (From must be before To)."); return; }
    setBusy(true); setErr(""); setResult(null);
    try {
      const res = await auditCompetitor(name.trim(), fromMonth, fromYear, toMonth, toYear, apiKey);
      setResult(res);
    } catch (e) {
      setErr(e.message?.startsWith("quota_exceeded")
        ? "Gemini hit its rate limit — wait a minute and try again."
        : "Audit could not complete: " + (e.message || "unknown error"));
    }
    setBusy(false);
  };

  const maxLvl = result ? Math.max(1, ...result.timeline.map(t => t.activityLevel)) : 1;

  return (
    <div className="meth-overlay" onClick={onClose}>
      <div className="meth-panel audit-panel" onClick={e => e.stopPropagation()}>
        <div className="meth-head">
          <div>
            <div className="meth-eyebrow">Signal · Social Audit</div>
            <div className="meth-title">Period-over-Period View</div>
          </div>
          <button className="meth-close" onClick={onClose}>✕</button>
        </div>

        <div className="audit-controls">
          <div className="ac-field ac-name">
            <label>Competitor</label>
            {names.length > 0 ? (
              <select value={name} onChange={e => setCompName(e.target.value)}>
                {names.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input value={compName} onChange={e => setCompName(e.target.value)} placeholder="e.g. Castle Lite" />
            )}
          </div>
          <div className="ac-field">
            <label>From</label>
            <div className="ac-pair">
              <select value={fromMonth} onChange={e => setFromMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}
              </select>
              <input type="number" value={fromYear} onChange={e => setFromYear(+e.target.value)} />
            </div>
          </div>
          <div className="ac-field">
            <label>To</label>
            <div className="ac-pair">
              <select value={toMonth} onChange={e => setToMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}
              </select>
              <input type="number" value={toYear} onChange={e => setToYear(+e.target.value)} />
            </div>
          </div>
          <button className={"audit-run " + (busy ? "busy" : "")} onClick={run} disabled={busy}>
            <span className="sparkle">✦</span>{busy ? "Auditing…" : "Run Audit"}
          </button>
        </div>

        {err && <div className="wp-err-bar" style={{ margin: "0 28px 14px" }}><span className="web-ic">⚠</span><span className="web-msg">{err}</span></div>}

        {busy && (
          <div className="audit-busy">
            <div className="sm-glyph" style={{ animation: "pulse 1s ease-in-out infinite" }}>◷</div>
            <p>Researching {name} from {MONTHS[fromMonth]} {fromYear} to {MONTHS[toMonth]} {toYear} — one pass, every month…</p>
          </div>
        )}

        {result && (
          <div className="audit-results">
            {result.trend && (
              <div className="audit-trend">
                <span className="wci-label">Period Trend</span>
                <span className="audit-trend-txt"><Hi text={result.trend} /></span>
              </div>
            )}
            <div className="audit-timeline">
              {result.timeline.map((t, i) => (
                <div className="at-row" key={i}>
                  <div className="at-rail">
                    <span className="at-dot"></span>
                    {i < result.timeline.length - 1 && <span className="at-line"></span>}
                  </div>
                  <div className="at-body">
                    <div className="at-head">
                      <span className="at-month">{t.month}</span>
                      <span className="at-headline"><Hi text={t.headline} /></span>
                      <span className="at-lvl-wrap" title={`Activity level ${t.activityLevel}/10`}>
                        <span className="at-lvl-bar" style={{ width: (t.activityLevel / maxLvl * 100) + "%" }}></span>
                      </span>
                    </div>
                    <div className="at-summary"><Hi text={t.summary} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Sidebar control panel ---------- */
function Sidebar(props) {
  const { marketSel = "sa", setMarket,
          brandSel, setBrandSel, month, setMonth, year, setYear, runState, onRun,
          colors, onGenerate, busy, canExport,
          signalKeyword, setSignalKeyword,
          onGenerateReport, reportBusy, canReport,
          onGeneratePPT, pptBusy,
          onShowMethodology, geminiCalls = 0 } = props;
  /* Signal Pro — badge when paid, "Go Pro" CTA otherwise. */
  const [isPro, setIsPro] = _useS(getProStatus());
  const [stripeUrl, setStripeUrl] = _useS("");
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const url = await getStripeProUrl();
      if (alive) setStripeUrl(url);
      /* never downgrade a just-paid local flag; upgrade across devices */
      const pro = getProStatus() || await checkProRemote(getUserEmail());
      if (alive) { setIsPro(pro); setProStatus(pro); }
    })();
    return () => { alive = false; };
  }, []);
  const st = runState === "running" ? { cls: "running", txt: "◍ Running…" }
           : runState === "ready" ? { cls: "ready", txt: "◉ Windows Ready" }
           : { cls: "idle", txt: "◌ Awaiting Run" };

  const brandRow = (key, label, dot) => {
    const sel = brandSel === key;
    return (
      <div key={key} className={"brand-opt" + (sel ? " sel" : "")} onClick={() => setBrandSel(key)} role="radio" aria-checked={sel}>
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
            <div className="wm">Signal</div>
            <div className="sub">John Joseph · Intelligence</div>
          </div>
        </div>
        <div className="sb-rule"></div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">01</span><span className="lbl">Select Market</span></div>
          <div className="market-row">
            {Object.entries(MARKETS).map(([mk, meta]) => (
              <button key={mk}
                className={"market-btn" + (marketSel === mk ? " sel" : "")}
                onClick={() => setMarket && setMarket(mk)}>
                {meta.short}
              </button>
            ))}
          </div>
          <div className="market-name">{(MARKETS[marketSel] || MARKETS.sa).label}</div>
        </div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">02</span><span className="lbl">{marketSel === "sa" ? "Select Brand" : "Select Category"}</span></div>
          <div className="brand-list">
            {marketSel === "sa"
              ? Object.entries(BRAND_CATEGORIES).map(([catKey, catMeta]) => {
                  const brandsInCat = Object.values(BRANDS).filter(b => b.category === catKey);
                  if (!brandsInCat.length) return null;
                  return (
                    <div key={catKey} className="brand-group">
                      <div className="brand-group-label">{catMeta.label}</div>
                      {brandsInCat.map(b => brandRow(b.key, b.name, colors[b.key] || b.color))}
                    </div>
                  );
                })
              : Object.entries(BRAND_CATEGORIES).map(([catKey, catMeta]) => {
                  /* US/UK: one entry per category (tabs are category-level) */
                  const rep = Object.values(BRANDS).find(b => b.category === catKey);
                  if (!rep) return null;
                  return brandRow(rep.key, catMeta.label, catMeta.color || colors[rep.key]);
                })
            }
          </div>
        </div>

        <div className="sb-block">
          <div className="step-eyebrow"><span className="num">03</span><span className="lbl">Reporting Period</span></div>
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
          <div className="step-eyebrow"><span className="num">04</span><span className="lbl">Signal Keyword</span></div>
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

        <button className="btn-audit" onClick={props.onShowAudit}>
          <span className="audit-ic">◷</span>Social Audit · Period View
        </button>

        <button className="btn-meth" onClick={onShowMethodology}>
          <span className="meth-ic">ℹ</span>Methodology &amp; Lexicon
        </button>

        {isPro ? (
          <div className="quota-chip" style={{ borderColor: "var(--accent)" }}>
            <span className="quota-ic" style={{ color: "var(--accent)" }}>★</span>
            <span className="quota-body">
              <span className="quota-k">Signal</span>
              <span className="quota-v" style={{ color: "var(--accent)", fontWeight: 700 }}>PRO · full access</span>
            </span>
          </div>
        ) : stripeUrl ? (
          <a className="btn-ppt" href={proCheckoutLink(stripeUrl, getUserEmail())} target="_blank" rel="noopener"
             style={{ textDecoration: "none", textAlign: "center" }}>
            <span className="ppt-ic">★</span>Go Pro — Unlock Full Access
          </a>
        ) : null}

        <div className={"quota-chip" + (geminiCalls >= 1425 ? " quota-red" : geminiCalls >= 1200 ? " quota-amber" : "")}>
          <span className="quota-ic">◉</span>
          <span className="quota-body">
            <span className="quota-k">Gemini</span>
            <span className="quota-v">{geminiCalls.toLocaleString()} / 1,500 calls today</span>
          </span>
          {geminiCalls >= 1200 && <span className="quota-warn">{geminiCalls >= 1425 ? "CRITICAL" : "HIGH"}</span>}
        </div>

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

/* ---- First-time API key setup screen ---- */
function SetupScreen({ onSave }) {
  const [val, setVal] = _useS("");
  const [err, setErr] = _useS("");
  const [busy, setBusy] = _useS(false);

  const handleSave = async () => {
    const k = val.trim();
    if (!k) { setErr("Paste your API key above to continue."); return; }
    setBusy(true); setErr("");
    try {
      /* Quick validation — tiny prompt to confirm the key works */
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        /* Key in header — supports both legacy AIzaSy and new AQ. key formats */
        headers: { "Content-Type": "application/json", "x-goog-api-key": k },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word OK" }] }], generationConfig: { maxOutputTokens: 5 } }),
      });
      if (res.status === 400 || res.status === 403) { setErr("That key isn't valid — double-check and try again."); setBusy(false); return; }
      if (res.status === 429) { /* quota but key is real */ }
      saveKey(k);
      onSave(k);
    } catch { setErr("Network error — make sure you're connected and try again."); }
    setBusy(false);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-brandmark">◈</div>
        <h1 className="setup-title">Signal</h1>
        <p className="setup-sub">Brand & Competitor Intelligence · VML South Africa</p>
        <div className="setup-divider" />
        <p className="setup-body">
          Signal uses Google's Gemini AI to research competitors in real time. You need a free API key to activate the intelligence engine — it takes 30 seconds to get one and you'll only ever need to do this once.
        </p>
        <a className="setup-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
          Get a free key at aistudio.google.com →
        </a>
        <div className="setup-field-wrap">
          <input
            className={"setup-input" + (err ? " error" : "")}
            type="password"
            placeholder="Paste your Gemini API key here…"
            value={val}
            onChange={e => { setVal(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
          />
          {err && <div className="setup-err">⚠ {err}</div>}
        </div>
        <button className={"setup-btn" + (busy ? " busy" : "")} onClick={handleSave} disabled={busy || !val.trim()}>
          {busy ? "Checking key…" : "Activate Signal →"}
        </button>
        <p className="setup-note">Your key is stored only in this browser. It never leaves your device.</p>
      </div>
    </div>
  );
}

Object.assign(window, { WindowPage, Sidebar, CategorySlide, MethodologyPanel, Preloader, SetupScreen, SocialAuditPanel, Hi, DESIGN_W, DESIGN_H });
