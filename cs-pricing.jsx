/* ============================================================
   SIGNAL — PRICING
   ------------------------------------------------------------
   Single source of truth for the paid tiers, plus the pricing
   page and the paywall modal that both read from it.

   Classic script, loaded via <script type="text/babel">. There
   is no bundler and no TypeScript in this project, so this is a
   .jsx attaching to window — same pattern as cs-data / cs-ui.

   ZERO-FREE-ACCESS MODEL
   There is no free tier. An unpaid visitor can run the demo
   (canned data, ?demo=1) but cannot touch live competitor data.
   ============================================================ */

/* ---- Currency ----------------------------------------------
   Lemonsqueezy bills in USD. USD is therefore the PRICE; the
   ZAR figures are an approximate courtesy conversion for local
   buyers and are explicitly labelled as such.

   This is the reverse of the Paystack setup it replaced, where
   ZAR was the charged amount. Getting the direction wrong means
   advertising one currency and charging another, so the label
   ("approx.") is load-bearing copy, not decoration.

   The ZAR strings are fixed, not a live rate (~R18/$). They will
   drift. Treat them as indicative and refresh them periodically —
   nothing here affects what is charged. */
const FX_NOTE = "Billed in USD by Lemonsqueezy. ZAR shown as an approximate guide only — your bank's rate on the day will differ.";
const FX_RATE_NOTE = "approx.";

const PLANS = {
  insight: {
    id: "insight",
    name: "Insight",
    tagline: "For a single brand you need to stay ahead of.",
    monthly: { usd: "$49",  zar: "R881",    per: "/month", urlKey: "ls_url_insight_monthly" },
    annual:  { usd: "$490", zar: "R8,820",  per: "/year",  urlKey: "ls_url_insight_annual",
               save: "Save 17%", equiv: "$40.83/month billed annually" },
    limits: { snapshots: 5, snapshotsLabel: "5 per month", exports: ["pdf"] },
    features: [
      { label: "5 competitor snapshots per month", on: true },
      { label: "Full AI strategic analysis per competitor", on: true },
      { label: "PDF export", on: true },
      { label: "PowerPoint export", on: false },
      { label: "Email support", on: true },
    ],
  },
  intelligence: {
    id: "intelligence",
    name: "Intelligence",
    tagline: "For agencies and teams running a whole category.",
    featured: true,
    badge: "MOST POPULAR",
    monthly: { usd: "$99",  zar: "R1,782",  per: "/month", urlKey: "ls_url_intelligence_monthly" },
    annual:  { usd: "$990", zar: "R17,820", per: "/year",  urlKey: "ls_url_intelligence_annual",
               save: "Save 17%", equiv: "$82.50/month billed annually" },
    limits: { snapshots: Infinity, snapshotsLabel: "Unlimited", exports: ["pdf", "pptx"] },
    features: [
      { label: "Unlimited competitor snapshots", on: true },
      { label: "Full AI strategic analysis per competitor", on: true },
      { label: "PDF export", on: true },
      { label: "PowerPoint export", on: true },
      { label: "Priority support", on: true },
    ],
  },
};

const PLAN_ORDER = ["insight", "intelligence"];
const DEFAULT_PLAN = "intelligence";
/* Monthly is the default view so the page leads with the headline prices the
   tiers are actually sold on ($49 / $99). Annual is one tap away and carries
   the Save 17% callout — but opening on $490/$990 makes Signal look four
   times more expensive than it is at a glance. */
const DEFAULT_CYCLE = "monthly";

/* The comparison matrix is derived from the plans above rather than
   written out again — two lists of the same facts drift apart. */
const MATRIX_ROWS = [
  { key: "snapshots", label: "Competitor snapshots", value: (p) => p.limits.snapshotsLabel },
  { key: "analysis",  label: "AI strategic analysis", value: () => "Included" },
  { key: "pdf",       label: "PDF export",            value: (p) => p.limits.exports.includes("pdf")  },
  { key: "pptx",      label: "PowerPoint export",     value: (p) => p.limits.exports.includes("pptx") },
  { key: "support",   label: "Support",               value: (p) => (p.id === "intelligence" ? "Priority" : "Email") },
];

function planPrice(plan, cycle) { return PLANS[plan][cycle]; }

/* ---- Theme -------------------------------------------------
   The app itself is dark-only and has no toggle. This page ships
   its own so the pricing surface honours a light preference:
   it follows prefers-color-scheme by default and writes an
   explicit data-theme when the visitor overrides it. */
function useTheme() {
  const [theme, setTheme] = React.useState(() => {
    try {
      const saved = localStorage.getItem("signal_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("signal_theme", theme); } catch (e) {}
  }, [theme]);
  return [theme, setTheme];
}

function ThemeToggle({ theme, onToggle }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="pr-theme" onClick={() => onToggle(next)}
            aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}

/* ---- Billing-cycle switch ---------------------------------- */
function CycleSwitch({ cycle, onChange }) {
  return (
    <div className="pr-cycle" role="radiogroup" aria-label="Billing period">
      {["monthly", "annual"].map((c) => (
        <button key={c} type="button" role="radio" aria-checked={cycle === c}
                className={"pr-cycle-opt" + (cycle === c ? " on" : "")}
                onClick={() => onChange(c)}>
          {c === "monthly" ? "Monthly" : "Annual"}
          {c === "annual" && <span className="pr-save">Save 17%</span>}
        </button>
      ))}
    </div>
  );
}

/* ---- Price block ------------------------------------------- */
function Price({ plan, cycle }) {
  const p = planPrice(plan, cycle);
  return (
    <div className="pr-price">
      <div className="pr-usd">
        <span className="pr-amt">{p.usd}</span>
        <span className="pr-per">{p.per}</span>
      </div>
      {/* USD is the charged amount; ZAR is a courtesy conversion and is
          labelled "approx." so it can never read as the price */}
      <div className="pr-zar"><span className="pr-zar-note">{FX_RATE_NOTE}</span> {p.zar}{p.per}</div>
      {p.equiv && <div className="pr-equiv">{p.equiv}</div>}
    </div>
  );
}

/* ---- Tier card --------------------------------------------- */
function PlanCard({ id, cycle, onSubscribe, busy }) {
  const plan = PLANS[id];
  return (
    <article className={"pr-card liquid" + (plan.featured ? " pr-card-hi" : "")}>
      <span className="refract" /><span className="sheen" />
      {/* Both cards render the badge row — the unbadged one gets an invisible
          copy — so the names, prices and Subscribe buttons line up across the
          grid. A two-column comparison is read across, and only badging one
          card pushed everything in it 37px down. */}
      {plan.badge
        ? <div className="pr-badge">{plan.badge}</div>
        : <div className="pr-badge pr-badge-ghost" aria-hidden="true">MOST POPULAR</div>}
      <h3 className="pr-name">{plan.name}</h3>
      <p className="pr-tagline">{plan.tagline}</p>
      <Price plan={id} cycle={cycle} />
      <button className={"pr-buy" + (plan.featured ? " pr-buy-hi" : "")}
              onClick={() => onSubscribe(id, cycle)} disabled={busy}>
        {busy ? "Opening checkout…" : `Subscribe to ${plan.name}`}
        <span className="pr-arw" aria-hidden="true">→</span>
      </button>
      <ul className="pr-feats">
        {plan.features.map((f, i) => (
          <li key={i} className={f.on ? "" : "off"}>
            <span className={"pr-tick" + (f.on ? "" : " pr-tick-off")} aria-hidden="true">{f.on ? "✓" : "✕"}</span>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---- Comparison matrix ------------------------------------- */
function Matrix({ cycle }) {
  const cell = (v) => {
    if (v === true)  return <span className="pr-tick" aria-label="Included">✓</span>;
    if (v === false) return <span className="pr-tick pr-tick-off" aria-label="Not included">✕</span>;
    return <span>{v}</span>;
  };
  return (
    <div className="pr-matrix-wrap">
      <table className="pr-matrix">
        <caption className="pr-matrix-cap">Full comparison</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="pr-mono">Feature</span>
            </th>
            {PLAN_ORDER.map((id) => (
              <th scope="col" key={id}>
                <span className="pr-m-name">{PLANS[id].name}</span>
                <span className="pr-m-price">{planPrice(id, cycle).usd}{planPrice(id, cycle).per}</span>
                <span className="pr-m-zar">{planPrice(id, cycle).zar}{planPrice(id, cycle).per}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {PLAN_ORDER.map((id) => <td key={id}>{cell(row.value(PLANS[id]))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- The page ---------------------------------------------- */
function PricingPage() {
  const [theme, setTheme] = useTheme();
  const [cycle, setCycle] = React.useState(DEFAULT_CYCLE);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  /* Lemonsqueezy checkout is a hosted page, so this is a navigation, not an
     SDK call — no third-party script is loaded. The email is prefilled and
     passed as custom data so the webhook (or a manual check in the LS
     dashboard) can match the payment back to a Signal account. */
  const onSubscribe = async (planId, cyc) => {
    setErr("");
    const email = (typeof getUserEmail === "function" && getUserEmail()) || "";
    if (!email) {
      /* Without an email there is nothing to grant Pro against once they pay,
         so sign-in comes first. */
      window.location.href = "signup.html?next=pricing";
      return;
    }
    setBusy(true);
    try {
      const url = typeof lemonCheckoutUrl === "function"
        ? await lemonCheckoutUrl(planId, cyc, email)
        : "";
      if (!url) {
        setErr("Checkout isn't switched on yet — email hello@signal.build and we'll set you up directly.");
        setBusy(false);
        return;
      }
      if (window.posthog) window.posthog.capture("checkout_opened", { tier: planId, cycle: cyc, provider: "lemonsqueezy" });
      window.location.href = url;
    } catch (e) {
      setErr("Couldn't open checkout. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="pr-page">
      <header className="pr-top">
        <a className="pr-brand" href="index.html">
          <span className="pr-mark">◈</span><span className="pr-word">Signal</span>
        </a>
        <ThemeToggle theme={theme} onToggle={setTheme} />
      </header>

      <section className="pr-hero">
        <h1 className="pr-title">
          <span className="l1">Pay for the answer,</span>
          <span className="l2">not the <em className="contact-grad">software.</em></span>
        </h1>
        <p className="pr-sub">
          Every brand in your category, watched across four platforms, read back to you as
          strategy. Try it on demo data free — subscribe when you want it pointed at your
          real competitors.
        </p>
        <CycleSwitch cycle={cycle} onChange={setCycle} />
      </section>

      <section className="pr-grid" aria-label="Plans">
        {PLAN_ORDER.map((id) => (
          <PlanCard key={id} id={id} cycle={cycle} onSubscribe={onSubscribe} busy={busy} />
        ))}
      </section>

      {err && <div className="pr-err" role="alert">{err}</div>}

      <section className="pr-demo liquid">
        <span className="refract" /><span className="sheen" />
        <div>
          <h2 className="pr-demo-h">Not ready to pay? Run it on demo data.</h2>
          <p className="pr-demo-p">
            The full product with a canned category — every screen, every export, nothing
            billed. Live competitor data needs a subscription.
          </p>
        </div>
        <a className="pr-demo-btn" href="competitor-snapshot.html?demo=1">
          Try the demo <span className="pr-arw" aria-hidden="true">→</span>
        </a>
      </section>

      <Matrix cycle={cycle} />

      <footer className="pr-foot">
        <p>{FX_NOTE} Cancel anytime from your Lemonsqueezy receipt.</p>
        <p className="pr-mono">Signal · Competitor Intelligence · Cape Town</p>
      </footer>
    </div>
  );
}

/* expose for the page + the paywall */
window.PLANS = PLANS;
window.PLAN_ORDER = PLAN_ORDER;
window.DEFAULT_PLAN = DEFAULT_PLAN;
window.DEFAULT_CYCLE = DEFAULT_CYCLE;
window.MATRIX_ROWS = MATRIX_ROWS;
window.planPrice = planPrice;
window.PricingPage = PricingPage;
window.CycleSwitch = CycleSwitch;
window.Price = Price;
window.PlanCard = PlanCard;
