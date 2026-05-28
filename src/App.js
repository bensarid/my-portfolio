import { useState, useCallback } from "react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const DEFAULT_FORECAST = {
  years: "30", extraMonthly: "0", applyInflation: false, inflation: "3",
  applyTax: false, taxRate: "25", includePension: true, includeHishtalmut: true,
  includeShuk: true, includeNadlan: true,
};

const defaultState = {
  pension: { companies: [] },
  hishtalmut: { companies: [] },
  shuk: { accounts: [] },
  nadlan: { properties: [] },
  history: [],
  forecastSettings: { ...DEFAULT_FORECAST },
};

const STORAGE_KEY = "portfolio_data_v1";
function loadData() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (!r) return null;
    const d = JSON.parse(r);
    if (!d.nadlan) d.nadlan = { properties: [] };
    if (!d.forecastSettings) d.forecastSettings = { ...DEFAULT_FORECAST };
    return d;
  } catch { return null; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const C = {
  bg: "#0a0f1e", surface: "#111827", card: "#141d2e", border: "#1e2d45",
  accent: "#3b82f6", accent2: "#06b6d4", accent3: "#8b5cf6",
  green: "#22c55e", yellow: "#eab308", red: "#ef4444", orange: "#f97316",
  text: "#f1f5f9", muted: "#64748b", subtle: "#1e2d45",
};

function fmt(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}
function totalOf(arr, key = "balance") { return arr.reduce((s, x) => s + (parseFloat(x[key]) || 0), 0); }

const Pill = ({ children, color }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{children}</span>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px", ...style }}>{children}</div>
);
const Label = ({ children }) => (
  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{children}</div>
);
const Input = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <Label>{label}</Label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none" }} />
  </div>
);
const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <Label>{label}</Label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Btn = ({ children, onClick, variant = "primary", small = false }) => {
  const bg = variant === "primary" ? C.accent : variant === "danger" ? C.red : C.subtle;
  return (
    <button onClick={onClick} style={{ background: bg, color: C.text, border: "none", borderRadius: 10, padding: small ? "6px 14px" : "11px 22px", fontSize: small ? 12 : 14, fontWeight: 700, cursor: "pointer" }}>
      {children}
    </button>
  );
};
const Toggle = ({ value, onChange, label, sublabel, color = C.accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
    <div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sublabel}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", transition: "background .2s", background: value ? color : C.border, position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </div>
  </div>
);

const TRACK_OPTIONS = [
  { value: "מניות", label: "מניות" }, { value: "מניות גלובלי", label: "מניות גלובלי" },
  { value: "מניות ישראל", label: "מניות ישראל" }, { value: "כללי", label: "כללי" },
  { value: "סולידי", label: "סולידי" }, { value: "S&P500", label: "S&P 500" },
  { value: 'אג"ח', label: "אגח" }, { value: "אחר", label: "אחר" },
];
const CURRENCY_OPTIONS = [
  { value: "ILS", label: "₪ שקל" }, { value: "USD", label: "$ דולר" }, { value: "EUR", label: "€ יורו" },
];
const PERIOD_OPTIONS = [
  { value: "5", label: "ממוצע 5 שנים" }, { value: "7", label: "ממוצע 7 שנים" }, { value: "10", label: "ממוצע 10 שנים" },
];
const PROPERTY_TYPE_OPTIONS = [
  { value: "דירה", label: "🏢 דירה" },
  { value: "בית פרטי", label: "🏠 בית פרטי" },
  { value: "קרקע", label: "🌿 קרקע" },
  { value: "נכס מסחרי", label: "🏪 נכס מסחרי" },
  { value: "מחסן", label: "📦 מחסן" },
  { value: "חניה", label: "🚗 חניה" },
  { value: "אחר", label: "➕ אחר" },
];

async function fetchYieldFromClaude(companyName, track, fundType, years) {
  const typeLabel = fundType === "pension" ? "קרן פנסיה" : "קרן השתלמות";
  const prompt = [
    "חפש את התשואה השנתית הממוצעת ל-" + years + " שנים אחרונות של " + typeLabel + " \"" + companyName + "\" במסלול \"" + track + "\" בישראל.",
    "חפש באתרים כמו mygemel.net, gemelnet.cma.gov.il, igemel-net.co.il.",
    "חשוב מאוד: החזר ממוצע שנתי (לא מצטבר).",
    "אם מצאת נתון אמין החזר JSON בלבד: {\"yield\": 0, \"period\": \"" + years + " שנים\", \"source\": \"שם האתר\", \"date\": \"תאריך\", \"gemelnet_url\": null}",
    "אם לא מצאת: {\"yield\": null, \"period\": null, \"source\": null, \"date\": null, \"gemelnet_url\": null}",
    "החזר JSON בלבד."
  ].join(" ");
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const textBlock = [...(data.content || [])].reverse().find(b => b.type === "text");
  if (!textBlock) return null;
  try { return JSON.parse(textBlock.text.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

function SavingsForm({ item, onChange, onRemove, fundType = "hishtalmut" }) {
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("5");

  const handleAutoYield = async () => {
    if (!item.name) { setFetchError("יש להזין שם חברה קודם"); return; }
    setFetching(true); setFetchResult(null); setFetchError(null);
    try {
      const result = await fetchYieldFromClaude(item.name, item.track, fundType, selectedPeriod);
      if (result && result.yield != null) setFetchResult(result);
      else setFetchError("not_found");
    } catch { setFetchError("שגיאת רשת"); }
    setFetching(false);
  };

  const applyYield = () => { onChange({ ...item, yield: String(fetchResult.yield) }); setFetchResult(null); };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Input label="שם חברה" value={item.name} onChange={v => onChange({ ...item, name: v })} placeholder="מיטב, מנורה..." />
        <Input label="יתרה (₪)" type="number" value={item.balance} onChange={v => onChange({ ...item, balance: v })} placeholder="150000" />
        <Input label="דמי ניהול מצבירה %" type="number" value={item.feeBalance} onChange={v => onChange({ ...item, feeBalance: v })} placeholder="0.5" />
        <Input label={fundType === "pension" ? "דמי ניהול מהפקדה %" : "הוצאות ניהול השקעות %"} type="number" value={item.feePremium} onChange={v => onChange({ ...item, feePremium: v })} placeholder="3" />
        <Select label="מסלול" value={item.track} onChange={v => onChange({ ...item, track: v })} options={TRACK_OPTIONS} />
        <Input label="הפקדה חודשית (₪)" type="number" value={item.monthly} onChange={v => onChange({ ...item, monthly: v })} placeholder="2000" />
      </div>
      <div style={{ marginTop: 10, background: C.card, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Label>תשואה שנתית %</Label>
            <input type="number" value={item.yield} onChange={e => onChange({ ...item, yield: e.target.value })} placeholder="8.2"
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 14, outline: "none" }} />
          </div>
          <div style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, padding: "5px 8px", fontSize: 11, outline: "none" }}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleAutoYield} disabled={fetching} style={{
              background: fetching ? C.border : C.accent + "22", border: `1px solid ${C.accent}44`,
              color: fetching ? C.muted : C.accent, borderRadius: 8, padding: "8px 12px",
              cursor: fetching ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            }}>
              {fetching ? "⏳ טוען..." : "🔄 עדכן אוטומטית"}
            </button>
          </div>
        </div>
        {fetchResult && (
          <div style={{ marginTop: 10, background: C.green + "11", border: `1px solid ${C.green}33`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 20 }}>{fetchResult.yield}%</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>ממוצע שנתי | {fetchResult.period}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>מקור: {fetchResult.source} | {fetchResult.date}</div>
                <div style={{ color: C.yellow, fontSize: 10, marginTop: 2 }}>⚠️ לאימות מלא השווה לגמל-נט</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <Btn small onClick={applyYield}>✓ אמץ</Btn>
                <a href={fetchResult.gemelnet_url || (fundType === "pension" ? "https://gemel-net.co.il/pension/" : "https://gemelnet.cma.gov.il/views/gemeltsuot.aspx")} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: C.accent2, textDecoration: "none" }}>🔗 גמל-נט</a>
              </div>
            </div>
          </div>
        )}
        {fetchError === "not_found" && (
          <div style={{ marginTop: 10, background: C.yellow + "11", border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: C.yellow, fontSize: 12, marginBottom: 8 }}>⚠️ לא נמצא נתון אמין – עדכן ידנית מגמל-נט</div>
            <a href={fundType === "pension" ? "https://gemel-net.co.il/pension/" : "https://gemelnet.cma.gov.il/views/gemeltsuot.aspx"} target="_blank" rel="noreferrer"
              style={{ display: "inline-block", background: C.accent + "22", border: `1px solid ${C.accent}44`, color: C.accent, borderRadius: 7, padding: "6px 12px", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
              🔗 פתח גמל-נט לחיפוש ידני
            </a>
          </div>
        )}
        {fetchError && fetchError !== "not_found" && (
          <div style={{ marginTop: 8, color: C.yellow, fontSize: 12 }}>⚠️ {fetchError}</div>
        )}
      </div>
      <div style={{ marginTop: 10, textAlign: "left" }}>
        <Btn variant="danger" small onClick={onRemove}>הסר</Btn>
      </div>
    </div>
  );
}

const HOLDING_TYPE_OPTIONS = [
  { value: "etf", label: "קרן סל (ETF)" },
  { value: "stock", label: "מנייה" },
];
const YIELD_PERIODS = ["1", "3", "5", "7", "10"];
const TICKER_OPTIONS = [
  { value: "SPY", label: "SPY", icon: "🟢", type: "etf", desc: "S&P 500 ETF" },
  { value: "QQQ", label: "QQQ", icon: "🔵", type: "etf", desc: "Nasdaq 100 ETF" },
  { value: "SOXX", label: "SOXX", icon: "🟠", type: "etf", desc: "Semiconductors ETF" },
  { value: "BTCUSD", label: "BTC/USD", icon: "🟡", type: "crypto", desc: "Bitcoin" },
  { value: "ETHUSD", label: "ETH/USD", icon: "🔷", type: "crypto", desc: "Ethereum" },
  { value: "NVDA", label: "NVDA", icon: "🟢", type: "stock", desc: "Nvidia" },
  { value: "AAPL", label: "AAPL", icon: "⚪", type: "stock", desc: "Apple" },
  { value: "MSFT", label: "MSFT", icon: "🔵", type: "stock", desc: "Microsoft" },
  { value: "GOOGL", label: "GOOGL", icon: "🔵", type: "stock", desc: "Alphabet" },
  { value: "META", label: "META", icon: "🔵", type: "stock", desc: "Meta" },
  { value: "AMZN", label: "AMZN", icon: "🟠", type: "stock", desc: "Amazon" },
  { value: "TSLA", label: "TSLA", icon: "🔴", type: "stock", desc: "Tesla" },
  { value: "INTC", label: "INTC", icon: "🔵", type: "stock", desc: "Intel" },
  { value: "ESLT", label: "ESLT", icon: "🟢", type: "stock", desc: "Elbit Systems" },
  { value: "TA35", label: "ת'א 35", icon: "🇮🇱", type: "etf", desc: "מדד ת'א 35" },
  { value: "MTF_TECH", label: "MTF תא-טכנו", icon: "🇮🇱", type: "etf", desc: "מדד תא-טכנולוגיה" },
  { value: "OTHER", label: "אחר...", icon: "➕", type: "stock", desc: "" },
];

function ShukForm({ item, onChange, onRemove, usdRate }) {
  const isUSD = item.currency === "USD";
  const enabled = item.enabled !== false;
  const balanceILS = isUSD && usdRate ? parseFloat(item.balance || 0) * usdRate : parseFloat(item.balance || 0);
  return (
    <div style={{ background: C.surface, border: `1px solid ${enabled ? C.border : C.subtle}`, borderRadius: 14, padding: 16, marginBottom: 12, opacity: enabled ? 1 : 0.45 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div onClick={() => onChange({ ...item, enabled: !enabled })}
          style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: enabled ? C.accent3 : C.border, position: "relative", flexShrink: 0, transition: "background .2s" }}>
          <div style={{ position: "absolute", top: 2, left: enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
        </div>
        <span style={{ fontSize: 12, color: enabled ? C.text : C.muted, fontWeight: 600 }}>{enabled ? "פעיל" : "כבוי"}</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Label>נייר ערך</Label>
        <select value={item.ticker || ""} onChange={e => {
          const t = TICKER_OPTIONS.find(x => x.value === e.target.value);
          if (!t) return;
          const currency = ["TA35", "MTF_TECH"].includes(t.value) ? "ILS" : "USD";
          onChange({ ...item, ticker: t.value, name: t.label, holdingType: t.type === "etf" ? "etf" : "stock", currency });
        }} style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none" }}>
          <option value="">— בחר נייר ערך —</option>
          {TICKER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label} — {t.desc}</option>)}
        </select>
        {item.ticker === "OTHER" && (
          <input type="text" value={item.name || ""} onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="שם חופשי..." style={{ marginTop: 6, width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none" }} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
        <Select label="סוג" value={item.holdingType} onChange={v => onChange({ ...item, holdingType: v })} options={HOLDING_TYPE_OPTIONS} />
        <Select label="מטבע" value={item.currency} onChange={v => onChange({ ...item, currency: v })} options={CURRENCY_OPTIONS} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>שווי נוכחי ({item.currency === "USD" ? "$" : "₪"})</Label>
        <input type="number" value={item.balance} onChange={e => onChange({ ...item, balance: e.target.value })} placeholder={item.currency === "USD" ? "5000" : "18000"}
          style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none" }} />
        {isUSD && usdRate && parseFloat(item.balance) > 0 && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>≈ {fmt(balanceILS)} (לפי ₪{usdRate.toFixed(2)}/$)</div>}
        {isUSD && !usdRate && <div style={{ color: C.yellow, fontSize: 11, marginTop: 4 }}>⚠️ עדכן שער דולר למעלה כדי לראות שקלים</div>}
      </div>
      <div style={{ marginBottom: 4 }}>
        <Label>תשואה שנתית ממוצעת לפי תקופה (%)</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {YIELD_PERIODS.map(p => (
            <div key={p}>
              <div style={{ fontSize: 10, color: C.muted, textAlign: "center", marginBottom: 3 }}>{p === "1" ? "1 שנה" : p + " שנים"}</div>
              <input type="number" value={item[`yield${p}`] || ""} onChange={e => onChange({ ...item, [`yield${p}`]: e.target.value })} placeholder="—"
                style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 8px", fontSize: 13, outline: "none", textAlign: "center" }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, textAlign: "left" }}>
        <Btn variant="danger" small onClick={onRemove}>הסר</Btn>
      </div>
    </div>
  );
}

// ─── NADLAN FORM ────────────────────────────────────────────────────
function NadlanForm({ item, onChange, onRemove }) {
  const ownerFrac = Math.min(100, Math.max(0, parseFloat(item.ownership ?? 100) || 100)) / 100;
  const purchaseFull = parseFloat(item.purchasePrice) || 0;
  const currentFull = parseFloat(item.currentValue) || 0;
  const roi = purchaseFull > 0 && currentFull > 0 ? ((currentFull - purchaseFull) / purchaseFull * 100).toFixed(1) : null;
  const profitFull = purchaseFull > 0 && currentFull > 0 ? currentFull - purchaseFull : null;
  const profit = profitFull !== null ? profitFull * ownerFrac : null;
  const rentFull = parseFloat(item.rent) || 0;
  const mortgageFull = parseFloat(item.mortgage) || 0;
  const rent = rentFull * ownerFrac;
  const mortgage = mortgageFull * ownerFrac;
  const netMonthlyFull = item.isRented ? rentFull - mortgageFull : null;
  const netMonthly = item.isRented ? rent - mortgage : null;
  const rentalYield = item.isRented && purchaseFull > 0 && rentFull > 0 ? (rentFull * 12 / purchaseFull * 100).toFixed(2) : null;
  const roiColor = roi !== null ? (parseFloat(roi) >= 0 ? C.green : C.red) : C.muted;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Select label="סוג נכס" value={item.propertyType} onChange={v => onChange({ ...item, propertyType: v })} options={PROPERTY_TYPE_OPTIONS} />
        <Input label="תיאור" value={item.name} onChange={v => onChange({ ...item, name: v })} placeholder='ת"א, ירושלים...' />
        <Input label="סכום קנייה (₪)" type="number" value={item.purchasePrice} onChange={v => onChange({ ...item, purchasePrice: v })} placeholder="1500000" />
        <Input label="שווי נוכחי (₪)" type="number" value={item.currentValue} onChange={v => onChange({ ...item, currentValue: v })} placeholder="1800000" />
        <Input label="אחוז בעלות %" type="number" value={item.ownership ?? "100"} onChange={v => onChange({ ...item, ownership: v })} placeholder="100" />
      </div>

      {/* ROI */}
      {roi !== null && (
        <div style={{ background: roiColor + "11", border: `1px solid ${roiColor}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>תשואה מהקנייה</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: roiColor }}>{parseFloat(roi) > 0 ? "+" : ""}{roi}%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>רווח / הפסד</div>
              {ownerFrac < 1 ? (
                <>
                  <div style={{ fontSize: 10, color: C.muted }}>כל הנכס</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: roiColor }}>{profitFull > 0 ? "+" : ""}{fmt(profitFull)}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>חלקך ({item.ownership}%)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: roiColor }}>{profit > 0 ? "+" : ""}{fmt(profit)}</div>
                </>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: roiColor }}>{profitFull > 0 ? "+" : ""}{fmt(profitFull)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <Input label="עליית ערך שנתית משוערת % (לתחזית)" type="number" value={item.appreciation} onChange={v => onChange({ ...item, appreciation: v })} placeholder="4" />

      {/* Rental toggle */}
      <Toggle value={!!item.isRented} onChange={v => onChange({ ...item, isRented: v })} label="הנכס מושכר" sublabel={item.isRented ? "מניב דמי שכירות" : "למגורים / לא מושכר"} color={C.orange} />

      {/* Rental fields */}
      {item.isRented && (
        <div style={{ marginTop: 12, background: C.card, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Input label="שכירות חודשית (₪)" type="number" value={item.rent} onChange={v => onChange({ ...item, rent: v })} placeholder="6000" />
            <Input label="משכנתא חודשית (₪)" type="number" value={item.mortgage} onChange={v => onChange({ ...item, mortgage: v })} placeholder="4000" />
          </div>
          {rentFull > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
              <div style={{ background: C.surface, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>רווח חודשי</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: netMonthlyFull >= 0 ? C.green : C.red, marginTop: 2 }}>{fmt(netMonthlyFull)}</div>
                {ownerFrac < 1 && <div style={{ fontSize: 11, fontWeight: 600, color: netMonthly >= 0 ? C.green : C.red, marginTop: 1 }}>חלקך: {fmt(netMonthly)}</div>}
              </div>
              <div style={{ background: C.surface, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>רווח שנתי</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: netMonthlyFull >= 0 ? C.green : C.red, marginTop: 2 }}>{fmt(netMonthlyFull * 12)}</div>
                {ownerFrac < 1 && <div style={{ fontSize: 11, fontWeight: 600, color: netMonthly >= 0 ? C.green : C.red, marginTop: 1 }}>חלקך: {fmt(netMonthly * 12)}</div>}
              </div>
              <div style={{ background: C.surface, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>תשואת שכ"ד</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.orange, marginTop: 2 }}>{rentalYield ? rentalYield + "%" : "—"}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: "left" }}>
        <Btn variant="danger" small onClick={onRemove}>הסר</Btn>
      </div>
    </div>
  );
}

// ─── NADLAN TAB ─────────────────────────────────────────────────────
function NadlanTab({ data, setData }) {
  const newProperty = () => ({ id: Date.now(), propertyType: "דירה", name: "", purchasePrice: "", currentValue: "", appreciation: "", isRented: false, rent: "", mortgage: "", ownership: "100" });
  const add = () => setData(d => ({ ...d, nadlan: { properties: [...d.nadlan.properties, newProperty()] } }));
  const upd = (id, val) => setData(d => ({ ...d, nadlan: { properties: d.nadlan.properties.map(p => p.id === id ? val : p) } }));
  const rem = id => setData(d => ({ ...d, nadlan: { properties: d.nadlan.properties.filter(p => p.id !== id) } }));

  const ownerOf = p => Math.min(100, Math.max(0, parseFloat(p.ownership ?? 100) || 100)) / 100;
  const totalValue = data.nadlan.properties.reduce((s, p) => s + (parseFloat(p.currentValue) || 0) * ownerOf(p), 0);
  const rentedProps = data.nadlan.properties.filter(p => p.isRented);
  const totalNetMonthly = rentedProps.reduce((s, p) => s + (parseFloat(p.rent || 0) - parseFloat(p.mortgage || 0)) * ownerOf(p), 0);
  const totalNetMonthlyFull = rentedProps.reduce((s, p) => s + (parseFloat(p.rent || 0) - parseFloat(p.mortgage || 0)), 0);
  const hasPartialOwnership = rentedProps.some(p => ownerOf(p) < 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>נדל"ן</div>
          <div style={{ color: C.orange, fontSize: 18, fontWeight: 700, marginTop: 2 }}>{totalValue > 0 ? fmt(totalValue) : "—"}</div>
        </div>
        <Btn onClick={add}>+ הוסף נכס</Btn>
      </div>

      {rentedProps.length > 0 && (
        <Card style={{ marginBottom: 16, padding: "12px 16px" }}>
          <Label>סיכום הכנסות שכירות</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted }}>נטו חודשי</div>
              {hasPartialOwnership && <div style={{ fontSize: 13, fontWeight: 800, color: totalNetMonthlyFull >= 0 ? C.green : C.red, marginTop: 2 }}>{fmt(totalNetMonthlyFull)}</div>}
              {hasPartialOwnership && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>חלקך</div>}
              <div style={{ fontSize: hasPartialOwnership ? 16 : 20, fontWeight: 800, color: totalNetMonthly >= 0 ? C.green : C.red, marginTop: hasPartialOwnership ? 0 : 2 }}>{fmt(totalNetMonthly)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted }}>נטו שנתי</div>
              {hasPartialOwnership && <div style={{ fontSize: 13, fontWeight: 800, color: totalNetMonthlyFull >= 0 ? C.green : C.red, marginTop: 2 }}>{fmt(totalNetMonthlyFull * 12)}</div>}
              {hasPartialOwnership && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>חלקך</div>}
              <div style={{ fontSize: hasPartialOwnership ? 16 : 20, fontWeight: 800, color: totalNetMonthly >= 0 ? C.green : C.red, marginTop: hasPartialOwnership ? 0 : 2 }}>{fmt(totalNetMonthly * 12)}</div>
            </div>
          </div>
        </Card>
      )}

      {data.nadlan.properties.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>אין נכסים עדיין – לחץ + הוסף נכס</div>}
      {data.nadlan.properties.map(p => <NadlanForm key={p.id} item={p} onChange={v => upd(p.id, v)} onRemove={() => rem(p.id)} />)}
    </div>
  );
}

function PensionTab({ data, setData }) {
  const add = () => setData(d => ({ ...d, pension: { companies: [...d.pension.companies, { id: Date.now(), name: "", balance: "", feeBalance: "", feePremium: "", yield: "", track: "מניות", monthly: "" }] } }));
  const upd = (id, val) => setData(d => ({ ...d, pension: { companies: d.pension.companies.map(c => c.id === id ? val : c) } }));
  const rem = id => setData(d => ({ ...d, pension: { companies: d.pension.companies.filter(c => c.id !== id) } }));
  const total = totalOf(data.pension.companies);
  const avgFee = data.pension.companies.length ? (data.pension.companies.reduce((s, c) => s + (parseFloat(c.feeBalance) || 0), 0) / data.pension.companies.length).toFixed(2) : null;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>קרן פנסיה</div>
          <div style={{ color: C.accent, fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmt(total)}</div>
        </div>
        <Btn onClick={add}>+ הוסף קרן</Btn>
      </div>
      {avgFee && <div style={{ marginBottom: 16 }}>
        <Pill color={parseFloat(avgFee) > 0.5 ? C.yellow : C.green}>דמי ניהול ממוצע: {avgFee}%</Pill>
        {parseFloat(avgFee) > 0.5 && <span style={{ color: C.muted, fontSize: 12, marginRight: 8 }}>⚠️ גבוה מהמומלץ (0.5%)</span>}
      </div>}
      {data.pension.companies.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>אין קרנות פנסיה עדיין</div>}
      {data.pension.companies.map(c => <SavingsForm key={c.id} item={c} onChange={v => upd(c.id, v)} onRemove={() => rem(c.id)} fundType="pension" />)}
    </div>
  );
}

function HishtalmutTab({ data, setData }) {
  const add = () => setData(d => ({ ...d, hishtalmut: { companies: [...d.hishtalmut.companies, { id: Date.now(), name: "", balance: "", feeBalance: "", feePremium: "", yield: "", track: "מניות", monthly: "" }] } }));
  const upd = (id, val) => setData(d => ({ ...d, hishtalmut: { companies: d.hishtalmut.companies.map(c => c.id === id ? val : c) } }));
  const rem = id => setData(d => ({ ...d, hishtalmut: { companies: d.hishtalmut.companies.filter(c => c.id !== id) } }));
  const total = totalOf(data.hishtalmut.companies);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>קרן השתלמות</div>
          <div style={{ color: C.accent2, fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmt(total)}</div>
        </div>
        <Btn onClick={add}>+ הוסף קרן</Btn>
      </div>
      {data.hishtalmut.companies.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>אין קרנות השתלמות עדיין</div>}
      {data.hishtalmut.companies.map(c => <SavingsForm key={c.id} item={c} onChange={v => upd(c.id, v)} onRemove={() => rem(c.id)} />)}
    </div>
  );
}

async function fetchUsdRate() {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: "מה שער הדולר מול השקל כרגע? החזר JSON בלבד: {\"rate\": <מספר עשרוני>}" }],
    }),
  });
  const data = await res.json();
  const textBlock = [...(data.content || [])].reverse().find(b => b.type === "text");
  if (!textBlock) return null;
  try { return JSON.parse(textBlock.text.replace(/```json|```/g, "").trim()).rate; }
  catch { return null; }
}

function ShukTab({ data, setData, usdRate, setUsdRate, rateDate, setRateDate }) {
  const [fetchingRate, setFetchingRate] = useState(false);
  const newHolding = () => ({ id: Date.now(), ticker: "", name: "", holdingType: "etf", currency: "ILS", balance: "", yield1: "", yield3: "", yield5: "", yield7: "", yield10: "", enabled: true });
  const add = () => setData(d => ({ ...d, shuk: { accounts: [...d.shuk.accounts, newHolding()] } }));
  const upd = (id, val) => setData(d => ({ ...d, shuk: { accounts: d.shuk.accounts.map(a => a.id === id ? val : a) } }));
  const rem = id => setData(d => ({ ...d, shuk: { accounts: d.shuk.accounts.filter(a => a.id !== id) } }));
  const handleFetchRate = async () => {
    setFetchingRate(true);
    const rate = await fetchUsdRate();
    if (rate) { setUsdRate(rate); setRateDate(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })); }
    setFetchingRate(false);
  };
  const activeAccounts = data.shuk.accounts.filter(a => a.enabled !== false);
  const totalILS = activeAccounts.reduce((s, a) => {
    const bal = parseFloat(a.balance || 0);
    return s + (a.currency === "USD" && usdRate ? bal * usdRate : a.currency === "ILS" ? bal : 0);
  }, 0);
  const totalUSD = activeAccounts.filter(a => a.currency === "USD").reduce((s, a) => s + parseFloat(a.balance || 0), 0);
  const totalILSonly = activeAccounts.filter(a => a.currency === "ILS").reduce((s, a) => s + parseFloat(a.balance || 0), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>שוק ההון</div>
          <div style={{ color: C.accent3, fontSize: 18, fontWeight: 700, marginTop: 2 }}>{totalILS > 0 ? fmt(totalILS) : "—"}</div>
          {totalUSD > 0 && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>${totalUSD.toLocaleString()} | {fmt(totalILSonly)} נוספים</div>}
        </div>
        <Btn onClick={add}>+ הוסף</Btn>
      </div>
      <Card style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Label>שער דולר (USD/ILS)</Label>
            {usdRate ? <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>₪{usdRate.toFixed(3)} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>עודכן {rateDate}</span></div>
              : <div style={{ fontSize: 13, color: C.muted }}>לא עודכן עדיין</div>}
          </div>
          <button onClick={handleFetchRate} disabled={fetchingRate} style={{ background: fetchingRate ? C.border : C.accent + "22", border: `1px solid ${C.accent}44`, color: fetchingRate ? C.muted : C.accent, borderRadius: 8, padding: "8px 14px", cursor: fetchingRate ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            {fetchingRate ? "⏳ טוען..." : "🔄 עדכן שער"}
          </button>
        </div>
      </Card>
      {data.shuk.accounts.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>אין החזקות עדיין – לחץ + הוסף</div>}
      {data.shuk.accounts.map(a => <ShukForm key={a.id} item={a} onChange={v => upd(a.id, v)} onRemove={() => rem(a.id)} usdRate={usdRate} />)}
    </div>
  );
}

function calcForecast({ pensionPV, hishtalmutPV, shukPV, nadlanPV = 0, pensionPMT, hishtalmutPMT, extraPMT, nadlanPMT = 0, avgYield, nadlanYield = 4, yr, inflation, applyInflation, applyTax, taxRate }) {
  const r = avgYield / 100 / 12;
  const rN = nadlanYield / 100 / 12;
  const n = yr * 12;
  const fvRaw = (pv, pmt, rate) => {
    if (rate === 0) return pv + pmt * n;
    return pv * Math.pow(1 + rate, n) + pmt * ((Math.pow(1 + rate, n) - 1) / rate);
  };
  let pensionFV = fvRaw(pensionPV, pensionPMT, r);
  let hishtalmutFV = fvRaw(hishtalmutPV, hishtalmutPMT, r);
  let shukFV = fvRaw(shukPV, extraPMT, r);
  let nadlanFV = fvRaw(nadlanPV, nadlanPMT, rN);
  if (applyTax && shukPV > 0) {
    const gain = shukFV - shukPV - extraPMT * n;
    shukFV -= Math.max(0, gain) * (taxRate / 100);
  }
  let total = pensionFV + hishtalmutFV + shukFV + nadlanFV;
  let realTotal = applyInflation ? total / Math.pow(1 + inflation / 100, yr) : total;
  return { nominal: total, real: realTotal, pensionFV, hishtalmutFV, shukFV, nadlanFV };
}

function ForecastTab({ data, setData, usdRate }) {
  const fs = data.forecastSettings || DEFAULT_FORECAST;
  const setFs = (key, val) => setData(d => ({ ...d, forecastSettings: { ...(d.forecastSettings || DEFAULT_FORECAST), [key]: val } }));
  const years = fs.years;
  const extraMonthly = fs.extraMonthly;
  const applyInflation = fs.applyInflation;
  const inflation = fs.inflation;
  const applyTax = fs.applyTax;
  const taxRate = fs.taxRate;
  const includePension = fs.includePension;
  const includeHishtalmut = fs.includeHishtalmut;
  const includeShuk = fs.includeShuk;
  const includeNadlan = fs.includeNadlan;

  const pensionTotal = totalOf(data.pension.companies);
  const hishtalmutTotal = totalOf(data.hishtalmut.companies);
  const shukTotal = data.shuk.accounts.filter(a => a.enabled !== false).reduce((s, a) => {
    const bal = parseFloat(a.balance || 0);
    if (a.currency === "USD") return s + (usdRate ? bal * usdRate : 0);
    return s + bal;
  }, 0);
  const nadlanOwnerOf = p => Math.min(100, Math.max(0, parseFloat(p.ownership ?? 100) || 100)) / 100;
  const nadlanTotal = data.nadlan.properties.reduce((s, p) => s + (parseFloat(p.currentValue) || 0) * nadlanOwnerOf(p), 0);
  const nadlanNetMonthly = data.nadlan.properties.filter(p => p.isRented).reduce((s, p) => s + (parseFloat(p.rent || 0) - parseFloat(p.mortgage || 0)) * nadlanOwnerOf(p), 0);

  const pensionMonthly = totalOf(data.pension.companies, "monthly");
  const hishtalmutMonthly = totalOf(data.hishtalmut.companies, "monthly");

  const avgYield = (() => {
    const pensionItems = includePension ? data.pension.companies : [];
    const hishtalmutItems = includeHishtalmut ? data.hishtalmut.companies : [];
    const shukItems = includeShuk ? data.shuk.accounts.filter(a => a.enabled !== false) : [];
    const savingsYields = [...pensionItems, ...hishtalmutItems].filter(x => parseFloat(x.yield)).map(x => parseFloat(x.yield));
    const shukYields = shukItems.map(x => {
      const vals = ["1","3","5","7","10"].map(p => parseFloat(x["yield"+p] || 0)).filter(v => v > 0);
      return vals.length ? vals.reduce((s,v) => s+v, 0) / vals.length : 0;
    }).filter(v => v > 0);
    const all = [...savingsYields, ...shukYields];
    if (!all.length) return 7;
    return all.reduce((s, v) => s + v, 0) / all.length;
  })();

  const yr = parseInt(years) || 30;
  const calcParams = {
    pensionPV: includePension ? pensionTotal : 0,
    hishtalmutPV: includeHishtalmut ? hishtalmutTotal : 0,
    shukPV: includeShuk ? shukTotal : 0,
    nadlanPV: includeNadlan ? nadlanTotal : 0,
    pensionPMT: includePension ? pensionMonthly : 0,
    hishtalmutPMT: includeHishtalmut ? hishtalmutMonthly : 0,
    extraPMT: includeShuk ? parseFloat(extraMonthly || 0) : 0,
    nadlanPMT: includeNadlan ? nadlanNetMonthly : 0,
    avgYield, nadlanYield: 0, yr,
    inflation: parseFloat(inflation || 3), applyInflation, applyTax, taxRate: parseFloat(taxRate || 25),
  };
  const { nominal, real, pensionFV, hishtalmutFV, shukFV, nadlanFV } = calcForecast(calcParams);
  const displayFV = applyInflation ? real : nominal;
  const totalMonthly = pensionMonthly + hishtalmutMonthly + parseFloat(extraMonthly || 0) + nadlanNetMonthly;

  const chartData = Array.from({ length: yr + 1 }, (_, i) => {
    const res = calcForecast({ ...calcParams, yr: i });
    const p = { year: `${2026 + i}` };
    p["נומינלי"] = Math.round(res.nominal / 1000);
    if (applyInflation) p["ריאלי"] = Math.round(res.real / 1000);
    return p;
  }).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 8)) === 0 || i === yr);

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>תחזית עתידית</div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <Label>אופק זמן</Label>
          <input type="range" min={1} max={40} value={years} onChange={e => setFs("years", e.target.value)} style={{ width: "100%", accentColor: C.accent }} />
          <div style={{ color: C.accent, fontWeight: 700, fontSize: 18, textAlign: "center" }}>{years} {parseInt(years) === 1 ? "שנה" : "שנים"}</div>
        </div>
        <Input label="הפקדה חודשית נוספת לשוק הון (₪)" type="number" value={extraMonthly} onChange={v => setFs("extraMonthly", v)} placeholder="500" />
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>תשואה ממוצעת (פנסיה/שוק): {avgYield.toFixed(1)}%</div>
        <div style={{ color: C.muted, fontSize: 12 }}>הפקדה חודשית כוללת: {fmt(totalMonthly)}</div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>אפיקי השקעה לחישוב</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>בחר אילו אפיקים ייכללו בתחזית</div>
        <Toggle value={includePension} onChange={v => setFs("includePension", v)} label="פנסיה" sublabel={pensionTotal > 0 ? fmt(pensionTotal) : "אין נתונים"} color={C.accent} />
        <Toggle value={includeHishtalmut} onChange={v => setFs("includeHishtalmut", v)} label="קרן השתלמות" sublabel={hishtalmutTotal > 0 ? fmt(hishtalmutTotal) : "אין נתונים"} color={C.accent2} />
        <Toggle value={includeShuk} onChange={v => setFs("includeShuk", v)} label="שוק הון" sublabel={shukTotal > 0 ? fmt(shukTotal) : "אין נתונים"} color={C.accent3} />
        <Toggle value={includeNadlan} onChange={v => setFs("includeNadlan", v)} label='נדל"ן' sublabel={nadlanTotal > 0 ? `${fmt(nadlanTotal)} | שכ"ד נטו: ${fmt(nadlanNetMonthly)}/חודש` : "אין נתונים"} color={C.orange} />
        {!includePension && !includeHishtalmut && !includeShuk && !includeNadlan && <div style={{ color: C.yellow, fontSize: 12, marginTop: 10, textAlign: "center" }}>⚠️ יש לבחור לפחות אפיק אחד</div>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>הגדרות מתקדמות</div>
        <Toggle value={applyInflation} onChange={v => setFs("applyInflation", v)} label="תיקון אינפלציה" sublabel="מציג בכוח קנייה של היום" color={C.accent2} />
        {applyInflation && <div style={{ paddingTop: 10 }}><Input label="אינפלציה שנתית %" type="number" value={inflation} onChange={v => setFs("inflation", v)} placeholder="3" /></div>}
        <Toggle value={applyTax} onChange={v => setFs("applyTax", v)} label="מס רווחי הון (25%)" sublabel="חל על שוק הון בלבד – לא על השתלמות" color={C.yellow} />
        {applyTax && <div style={{ paddingTop: 10 }}><Input label="שיעור מס %" type="number" value={taxRate} onChange={v => setFs("taxRate", v)} placeholder="25" /></div>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Label>{applyInflation ? "שווי עתידי (ריאלי)" : "שווי תיק עתידי משוער (נומינלי)"}</Label>
          <div style={{ fontSize: 32, fontWeight: 900, color: C.accent, marginTop: 4 }}>{fmt(displayFV)}</div>
          {applyInflation && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>נומינלי: {fmt(nominal)}</div>}
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>בעוד {years} שנים</div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <Label>פירוט לפי מוצר</Label>
          {[
            { label: "פנסיה", val: pensionFV, color: C.accent, note: "לא פטור ממס רווחי הון" },
            { label: "קרן השתלמות", val: hishtalmutFV, color: C.accent2, note: "✓ פטור ממס רווחי הון" },
            { label: "שוק הון", val: shukFV, color: C.accent3, note: applyTax ? `לאחר מס ${taxRate}%` : "ללא ניכוי מס" },
            { label: 'נדל"ן', val: nadlanFV, color: C.orange, note: `שכ"ד נטו בלבד` },
          ].map(({ label, val, color, note }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <div><div style={{ fontSize: 13, color: C.text }}>{label}</div><div style={{ fontSize: 10, color: C.muted }}>{note}</div></div>
              <div style={{ fontSize: 14, fontWeight: 700, color }}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>גרף צמיחה</Label>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={chartData}>
            <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 10 }} />
            <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v}k`} />
            <Tooltip formatter={(v, name) => [`${v}k ₪`, name]} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }} />
            {applyInflation && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Line type="monotone" dataKey="נומינלי" stroke={C.accent} strokeWidth={2.5} dot={false} />
            {applyInflation && <Line type="monotone" dataKey="ריאלי" stroke={C.accent2} strokeWidth={2} strokeDasharray="5 3" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <Label>צמיחה לפי אופק זמן</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 6 }}>
            {[1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30].filter(y => y <= parseInt(years)).map(y => {
              const res = calcForecast({ ...calcParams, yr: y });
              const fv = applyInflation ? res.real : res.nominal;
              const pv = calcParams.pensionPV + calcParams.hishtalmutPV + calcParams.shukPV + calcParams.nadlanPV;
              const pct = pv > 0 ? ((fv - pv) / pv * 100).toFixed(1) : "—";
              return (
                <div key={y} style={{ background: C.surface, borderRadius: 8, padding: "7px 4px", textAlign: "center", border: y === parseInt(years) ? `1px solid ${C.accent}44` : `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{y === 1 ? "1 שנה" : y + " שנים"}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.green, marginTop: 2 }}>+{pct}%</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{fmt(fv)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Dashboard({ data, usdRate }) {
  const pensionTotal = totalOf(data.pension.companies);
  const hishtalmutTotal = totalOf(data.hishtalmut.companies);
  const shukTotal = data.shuk.accounts.filter(a => a.enabled !== false).reduce((s, a) => {
    const bal = parseFloat(a.balance || 0);
    if (a.currency === "USD") return s + (usdRate ? bal * usdRate : 0);
    return s + bal;
  }, 0);
  const nadlanTotal = data.nadlan.properties.reduce((s, p) => s + (parseFloat(p.currentValue) || 0) * (Math.min(100, Math.max(0, parseFloat(p.ownership ?? 100) || 100)) / 100), 0);
  const grand = pensionTotal + hishtalmutTotal + shukTotal + nadlanTotal;

  const pieData = [
    { name: "פנסיה", value: pensionTotal, color: C.accent },
    { name: "השתלמות", value: hishtalmutTotal, color: C.accent2 },
    { name: "שוק הון", value: shukTotal, color: C.accent3 },
    { name: 'נדל"ן', value: nadlanTotal, color: C.orange },
  ].filter(d => d.value > 0);

  const allItems = [...data.pension.companies, ...data.hishtalmut.companies, ...data.shuk.accounts];
  const trackMap = {};
  allItems.forEach(x => { if (x.track && parseFloat(x.balance)) trackMap[x.track] = (trackMap[x.track] || 0) + parseFloat(x.balance); });
  const trackData = Object.entries(trackMap).map(([name, value]) => ({ name, value: Math.round(value) }));

  const alerts = [];
  data.pension.companies.forEach(c => {
    if (parseFloat(c.feeBalance) > 0.5) alerts.push({ type: "warn", msg: `דמי ניהול גבוהים בפנסיה: ${c.name} (${c.feeBalance}%)` });
    if (c.track === "סולידי" && parseFloat(c.balance) > 0) alerts.push({ type: "info", msg: `מסלול סולידי בפנסיה: ${c.name} – כדאי לבדוק אם מתאים לגיל שלך` });
  });
  data.nadlan.properties.forEach(p => {
    if (p.isRented && parseFloat(p.rent || 0) < parseFloat(p.mortgage || 0))
      alerts.push({ type: "warn", msg: `${p.name || p.propertyType}: השכירות נמוכה מהמשכנתא – הפסד חודשי` });
  });

  const histData = data.history.slice(-6).map(h => ({ date: h.date, פנסיה: h.pension, השתלמות: h.hishtalmut, "שוק הון": h.shuk, 'נדל"ן': h.nadlan || 0 }));

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>תמונה כוללת</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>סה״כ נכסים</div>
      <Card style={{ marginBottom: 16, textAlign: "center", background: "linear-gradient(135deg, #0d1b35 0%, #141d2e 100%)" }}>
        <Label>שווי תיק כולל</Label>
        <div style={{ fontSize: 36, fontWeight: 900, color: C.text, marginTop: 4 }}>{fmt(grand)}</div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "פנסיה", val: pensionTotal, color: C.accent },
          { label: "השתלמות", val: hishtalmutTotal, color: C.accent2 },
          { label: "שוק הון", val: shukTotal, color: C.accent3 },
          { label: 'נדל"ן', val: nadlanTotal, color: C.orange },
        ].map(({ label, val, color }) => (
          <Card key={label} style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color }}>{fmt(val)}</div>
          </Card>
        ))}
      </div>

      {pieData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Label>חלוקת תיק</Label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="50%" height={140}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                    <span style={{ fontSize: 13, color: C.text }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: C.muted }}>{grand > 0 ? Math.round(d.value / grand * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {trackData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Label>חלוקה לפי מסלול</Label>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={trackData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} width={80} />
              <Tooltip formatter={v => [fmt(v), "שווי"]} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }} />
              <Bar dataKey="value" fill={C.accent} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {histData.length > 1 && (
        <Card style={{ marginBottom: 16 }}>
          <Label>היסטוריה</Label>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={histData}>
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="פנסיה" stroke={C.accent} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="השתלמות" stroke={C.accent2} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="שוק הון" stroke={C.accent3} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey='נדל"ן' stroke={C.orange} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {alerts.length > 0 && (
        <Card>
          <Label>התראות</Label>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderBottom: i < alerts.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span>{a.type === "warn" ? "⚠️" : "ℹ️"}</span>
              <span style={{ fontSize: 13, color: C.text }}>{a.msg}</span>
            </div>
          ))}
        </Card>
      )}
      {alerts.length === 0 && grand > 0 && <Card><div style={{ color: C.green, textAlign: "center", padding: 12 }}>✅ אין התראות – התיק נראה תקין</div></Card>}
      {grand === 0 && <Card><div style={{ color: C.muted, textAlign: "center", padding: 30, fontSize: 13 }}>הוסף נתונים בטאבים למטה כדי לראות את התמונה הכוללת</div></Card>}
    </div>
  );
}

function SnapshotModal({ data, setData, onClose }) {
  const save = () => {
    const snap = {
      date: new Date().toLocaleDateString("he-IL", { month: "2-digit", year: "2-digit" }),
      pension: totalOf(data.pension.companies),
      hishtalmut: totalOf(data.hishtalmut.companies),
      shuk: totalOf(data.shuk.accounts),
      nadlan: data.nadlan.properties.reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0),
    };
    setData(d => ({ ...d, history: [...d.history.slice(-11), snap] }));
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>שמור snapshot</div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>ישמור את הערכים הנוכחיים לגרף ההיסטוריה</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={save}>שמור</Btn>
          <Btn variant="ghost" onClick={onClose}>ביטול</Btn>
        </div>
      </Card>
    </div>
  );
}

const TABS = [
  { id: "dashboard", label: "📊 סקירה" },
  { id: "pension", label: "🏦 פנסיה" },
  { id: "hishtalmut", label: "📈 השתלמות" },
  { id: "shuk", label: "💹 שוק הון" },
  { id: "nadlan", label: '🏠 נדל"ן' },
  { id: "forecast", label: "🔮 תחזית" },
];

// ─── PIN SCREEN ─────────────────────────────────────────────────────
const CORRECT_PIN = "2256";
const AUTH_KEY = "portfolio_auth_v1";

function PinScreen({ onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === CORRECT_PIN) {
          sessionStorage.setItem(AUTH_KEY, "1");
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => { setPin(""); setError(false); }, 800);
        }
      }, 120);
    }
  };

  const handleDel = () => { setPin(p => p.slice(0, -1)); setError(false); };

  const keys = ["3","2","1","6","5","4","9","8","7","⌫","0",""];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <div style={{ fontSize: 26, fontWeight: 900, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>MyPortfolio</div>
      <div style={{ color: C.muted, fontSize: 14, marginBottom: 36 }}>הזן קוד כניסה</div>

      {/* dots */}
      <div style={{ display: "flex", gap: 14, marginBottom: 40 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: error ? C.red : pin.length > i ? C.accent : C.border, transition: "background 0.15s" }} />
        ))}
      </div>

      {/* keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={() => { if (k === "⌫") handleDel(); else if (k) handleDigit(k); }}
            style={{ width: 72, height: 72, borderRadius: "50%", background: k ? C.surface : "transparent", border: `1px solid ${k ? C.border : "transparent"}`, color: C.text, fontSize: k === "⌫" ? 18 : 22, fontWeight: 600, cursor: k ? "pointer" : "default" }}>
            {k}
          </button>
        ))}
      </div>

      {error && <div style={{ marginTop: 24, color: C.red, fontSize: 14, fontWeight: 600 }}>קוד שגוי, נסה שוב</div>}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(() => loadData() || defaultState);
  const [showSnap, setShowSnap] = useState(false);
  const [usdRate, setUsdRate] = useState(null);
  const [rateDate, setRateDate] = useState(null);

  const setDataPersist = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveData(next);
      return next;
    });
  }, []);

  if (!authed) return <PinScreen onSuccess={() => setAuthed(true)} />;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI', Tahoma, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 18, fontWeight: 900, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          MyPortfolio
        </div>
        <button onClick={() => setShowSnap(true)} style={{ background: C.subtle, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          📸 snapshot
        </button>
      </div>
      <div style={{ padding: "20px 16px 100px" }}>
        {tab === "dashboard" && <Dashboard data={data} usdRate={usdRate} />}
        {tab === "pension" && <PensionTab data={data} setData={setDataPersist} />}
        {tab === "hishtalmut" && <HishtalmutTab data={data} setData={setDataPersist} />}
        {tab === "shuk" && <ShukTab data={data} setData={setDataPersist} usdRate={usdRate} setUsdRate={setUsdRate} rateDate={rateDate} setRateDate={setRateDate} />}
        {tab === "nadlan" && <NadlanTab data={data} setData={setDataPersist} />}
        {tab === "forecast" && <ForecastTab data={data} setData={setDataPersist} usdRate={usdRate} />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "8px 2px", background: "none", border: "none", cursor: "pointer", color: tab === t.id ? C.accent : C.muted, fontSize: 8, fontWeight: tab === t.id ? 800 : 400, borderTop: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all .15s" }}>
            <div style={{ fontSize: 16 }}>{t.label.split(" ")[0]}</div>
            <div>{t.label.split(" ").slice(1).join(" ")}</div>
          </button>
        ))}
      </div>
      {showSnap && <SnapshotModal data={data} setData={setDataPersist} onClose={() => setShowSnap(false)} />}
    </div>
  );
}
