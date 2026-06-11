import { useState, useCallback, useMemo, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ── utils ──────────────────────────────────────────────
const todayStr = () =>
  new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");

const toMinutes = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const calcSleepHours = (start, end) => {
  const s = toMinutes(start), e = toMinutes(end);
  if (s == null || e == null) return null;
  let diff = e - s; if (diff <= 0) diff += 1440;
  return parseFloat((diff / 60).toFixed(2));
};

const fmtSleep = (h) => {
  if (h == null) return "—";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}時間${mm ? mm + "分" : ""}`;
};

const scoreLabel = (v) => {
  if (v >= 90) return { text: "とてもいい", bg: "#EAF3DE", col: "#3B6D11" };
  if (v >= 80) return { text: "まあまあいい", bg: "#E6F1FB", col: "#185FA5" };
  if (v >= 60) return { text: "普通",       bg: "#FAEEDA", col: "#854F0B" };
  return             { text: "悪い",       bg: "#FCEBEB", col: "#A32D2D" };
};

const feelingLabel = (v) => {
  if (v >= 9) return { text: "とても良い", bg: "#EAF3DE", col: "#3B6D11" };
  if (v >= 7) return { text: "良い",       bg: "#E6F1FB", col: "#185FA5" };
  if (v >= 5) return { text: "ふつう",     bg: "#FAEEDA", col: "#854F0B" };
  if (v >= 3) return { text: "つらい",     bg: "#FBEED9", col: "#A86400" };
  return             { text: "かなりつらい", bg: "#FCEBEB", col: "#A32D2D" };
};

const badgeStyle = (bg, col, width = 126) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width,
  padding: "3px 11px",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 500,
  background: bg,
  color: col,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  boxSizing: "border-box",
});

const normalizeSliderValue = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = parsed > 10 ? Math.round(parsed / 10) : Math.round(parsed);
  return Math.max(1, Math.min(10, normalized));
};

const LS_KEY = "healthdb_v2";
const GK_KEY = "gemini_key_v2";
const EMPTY_FORM = {
  mind: 5, body: 5, headache: false, nausea: false, nap: false,
  sleepStart: "", sleepEnd: "", sleepScore: 50, sweetCount: 0, summary: ""
};

// ── responsive hook ────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ── toast hook ─────────────────────────────────────────
const useToast = () => {
  const [msg, setMsg] = useState("");
  const [vis, setVis] = useState(false);
  const show = useCallback((m) => { setMsg(m); setVis(true); setTimeout(() => setVis(false), 2400); }, []);
  return { msg, vis, show };
};

// ── design tokens ──────────────────────────────────────
const inputStyle = {
  width: "100%",
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 12,
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  boxSizing: "border-box",
};

// ── base components ────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "1rem 1.1rem",
    marginBottom: "0.9rem", ...style
  }}>{children}</div>
);

const CardTitle = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase",
    color: "var(--color-text-secondary)", marginBottom: "0.85rem"
  }}>{children}</div>
);

const Field = ({ label, children, style }) => (
  <div style={{ marginBottom: "0.8rem", ...style }}>
    <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
      {label}
    </label>
    {children}
  </div>
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    className="app-control"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
  />
);

const TimeInput = ({ value, onChange }) => (
  <input className="app-control" type="time" value={value} onChange={onChange} style={inputStyle} />
);

const Toggle = ({ checked, onChange, label }) => (
  <button onClick={() => onChange(!checked)} style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: 20, cursor: "pointer",
    fontSize: 13, fontWeight: 500, border: "0.5px solid",
    borderColor: checked ? "#185FA5" : "var(--color-border-secondary)",
    background: checked ? "#E6F1FB" : "transparent",
    color: checked ? "#185FA5" : "var(--color-text-secondary)",
    transition: "all .15s",
  }}>{label}</button>
);

const Btn = ({ onClick, children, primary, danger, small, disabled, full }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: small ? "5px 12px" : "8px 16px",
    fontSize: small ? 12 : 14, fontWeight: 500,
    borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    border: "0.5px solid",
    borderColor: primary ? "#185FA5" : danger ? "#A32D2D" : "var(--color-border-secondary)",
    background: primary ? "#185FA5" : danger ? "#FCEBEB" : "var(--color-background-secondary)",
    color: primary ? "#fff" : danger ? "#A32D2D" : "var(--color-text-primary)",
    opacity: disabled ? 0.5 : 1, transition: "opacity .15s",
    width: full ? "100%" : undefined,
  }}>{children}</button>
);

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: accent ? "#E6F1FB" : "var(--color-background-secondary)",
    borderRadius: 8, padding: "12px 14px", flex: 1, minWidth: 90,
  }}>
    <div style={{ fontSize: 11, color: accent ? "#185FA5" : "var(--color-text-secondary)", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: accent ? "#185FA5" : "var(--color-text-primary)" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{sub}</div>}
  </div>
);

// ── RECORD TAB ─────────────────────────────────────────
const RecordTab = ({ db, setDb, toast, isMobile }) => {
  const today = todayStr();
  const [form, setForm] = useState(() => db[today]
    ? {
        ...EMPTY_FORM,
        ...db[today],
        mind: normalizeSliderValue(db[today].mind),
        body: normalizeSliderValue(db[today].body),
      }
    : { ...EMPTY_FORM });
  const sleepH = useMemo(() => calcSleepHours(form.sleepStart, form.sleepEnd), [form.sleepStart, form.sleepEnd]);
  const sl = scoreLabel(form.sleepScore);
  const feeling = feelingLabel(form.mind);
  const bodyFeeling = feelingLabel(form.body);
  const saved = !!db[today];

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target ? e.target.value : e }));

  const save = () => {
    const entry = { ...form, date: today, sleepHours: sleepH, savedAt: new Date().toISOString() };
    const next = { ...db, [today]: entry };
    setDb(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    toast("記録を保存しました ✓");
  };

  const dateBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.1rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 500 }}>
        {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
      </span>
      {saved && <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "#EAF3DE", color: "#3B6D11" }}>保存済み</span>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Btn onClick={() => setForm({ ...EMPTY_FORM })}>クリア</Btn>
        <Btn onClick={save} primary>記録を保存</Btn>
      </div>
    </div>
  );

  const condCard = (
    <Card>
      <CardTitle>心・体の状態</CardTitle>
      <Field label="心の状態">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            className="app-range"
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.mind}
            onChange={(e) => setForm(f => ({ ...f, mind: +e.target.value }))}
            style={{ flex: 1 }}
          />
          <span style={badgeStyle(feeling.bg, feeling.col)}>
            {form.mind}/10 · {feeling.text}
          </span>
        </div>
      </Field>
      <Field label="体の状態">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            className="app-range"
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.body}
            onChange={(e) => setForm(f => ({ ...f, body: +e.target.value }))}
            style={{ flex: 1 }}
          />
          <span style={badgeStyle(bodyFeeling.bg, bodyFeeling.col)}>
            {form.body}/10 · {bodyFeeling.text}
          </span>
        </div>
      </Field>
      <Field label="症状" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Toggle checked={form.headache} onChange={upd("headache")} label="頭痛" />
          <Toggle checked={form.nausea}   onChange={upd("nausea")}   label="吐き気" />
          <Toggle checked={form.nap}      onChange={upd("nap")}      label="昼寝あり" />
        </div>
      </Field>
    </Card>
  );

  const summaryCard = (
    <Card>
      <CardTitle>今日のまとめ</CardTitle>
      <Textarea value={form.summary} onChange={upd("summary")} placeholder="今日を振り返って..." rows={isMobile ? 4 : 6} />
    </Card>
  );

  const sleepCard = (
    <Card>
      <CardTitle>睡眠</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="就寝時間"><TimeInput value={form.sleepStart} onChange={upd("sleepStart")} /></Field>
        <Field label="起床時間"><TimeInput value={form.sleepEnd}   onChange={upd("sleepEnd")}   /></Field>
      </div>
      <div style={{
        background: "var(--color-background-secondary)", borderRadius: 8,
        padding: "9px 13px", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1rem"
      }}>
        睡眠時間：<span style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>{fmtSleep(sleepH)}</span>
      </div>
      <Field label="睡眠スコア" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input className="app-range" type="range" min={0} max={100} step={1} value={form.sleepScore}
            onChange={(e) => setForm(f => ({ ...f, sleepScore: +e.target.value }))}
            style={{ flex: 1 }} />
          <span style={badgeStyle("var(--color-background-secondary)", "var(--color-text-primary)", 72)}>
            {form.sleepScore}
          </span>
          <span style={badgeStyle(sl.bg, sl.col, 126)}>
            {sl.text}
          </span>
        </div>
      </Field>
    </Card>
  );

  const foodCard = (
    <Card>
      <CardTitle>食事</CardTitle>
      <Field label="甘い食べ物・飲み物の数" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input className="app-control" type="number" value={form.sweetCount} min={0} max={99}
            onChange={(e) => setForm(f => ({ ...f, sweetCount: +e.target.value }))}
            style={{ ...inputStyle, width: 90 }} />
          <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>個</span>
        </div>
      </Field>
    </Card>
  );

  if (isMobile) {
    return (
      <div>
        {dateBar}
        {condCard}
        {sleepCard}
        {foodCard}
        {summaryCard}
      </div>
    );
  }

  return (
    <div>
      {dateBar}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>
        <div>{condCard}{summaryCard}</div>
        <div>{sleepCard}{foodCard}</div>
      </div>
    </div>
  );
};

// ── GRAPH TAB ──────────────────────────────────────────
const CHART_TABS = [
  { key: "sleep",    label: "睡眠時間" },
  { key: "score",    label: "睡眠スコア" },
  { key: "sweet",    label: "甘いもの" },
  { key: "symptoms", label: "症状" },
];

const GraphTab = ({ db, isMobile }) => {
  const [chartType, setChartType] = useState("sleep");
  const entries = useMemo(() =>
    Object.values(db).sort((a, b) => a.date < b.date ? -1 : 1).slice(-60), [db]);

  const stats = useMemo(() => {
    const sleeps = entries.filter(e => e.sleepHours != null).map(e => e.sleepHours);
    const scores = entries.map(e => e.sleepScore);
    return {
      days:         entries.length,
      avgSleep:     sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : "—",
      avgScore:     scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "—",
      headacheDays: entries.filter(e => e.headache).length,
    };
  }, [entries]);

  const chartData = useMemo(() => entries.map(e => ({
    label:    e.date.slice(5),
    sleepH:   e.sleepHours,
    score:    e.sleepScore,
    sweet:    e.sweetCount,
    headache: e.headache ? 1 : 0,
    nausea:   e.nausea   ? 1 : 0,
    nap:      e.nap      ? 1 : 0,
  })), [entries]);

  if (!entries.length) return (
    <div style={{ textAlign: "center", padding: "5rem 1rem", color: "var(--color-text-tertiary)", fontSize: 14 }}>
      まだデータがありません。記録タブから入力してください。
    </div>
  );

  const statsRow = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1rem" }}>
      <StatCard label="記録日数"   value={stats.days}         sub="日" />
      <StatCard label="平均睡眠"   value={stats.avgSleep}     sub="時間" accent />
      <StatCard label="平均スコア" value={stats.avgScore}     sub="/100" />
      <StatCard label="頭痛発生"   value={stats.headacheDays} sub="日" />
    </div>
  );

  const chartTabsSidebar = (
    <Card style={{ padding: "0.75rem" }}>
      <CardTitle>表示項目</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {CHART_TABS.map(t => (
          <button key={t.key} onClick={() => setChartType(t.key)} style={{
            textAlign: "left", padding: "8px 12px", borderRadius: 8,
            fontSize: 14, fontWeight: chartType === t.key ? 500 : 400,
            border: "none", cursor: "pointer",
            background: chartType === t.key ? "#E6F1FB" : "transparent",
            color: chartType === t.key ? "#185FA5" : "var(--color-text-secondary)",
          }}>{t.label}</button>
        ))}
      </div>
    </Card>
  );

  const chartTabsPills = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }}>
      {CHART_TABS.map(t => (
        <button key={t.key} onClick={() => setChartType(t.key)} style={{
          padding: "5px 14px", fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: "pointer",
          border: "0.5px solid",
          borderColor: chartType === t.key ? "#185FA5" : "var(--color-border-secondary)",
          background:  chartType === t.key ? "#185FA5" : "transparent",
          color:       chartType === t.key ? "#fff"    : "var(--color-text-secondary)",
        }}>{t.label}</button>
      ))}
    </div>
  );

  const theChart = (
    <ResponsiveContainer width="100%" height={isMobile ? 220 : 320}>
      {chartType === "sleep" ? (
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 12]} tick={{ fontSize: 11 }} unit="h" />
          <Tooltip formatter={(v) => v != null ? v + "h" : "—"} />
          <Bar dataKey="sleepH" name="睡眠時間" fill="#B5D4F4" stroke="#185FA5" strokeWidth={0.5} radius={[3,3,0,0]} />
        </BarChart>
      ) : chartType === "score" ? (
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line dataKey="score" name="睡眠スコア" stroke="#185FA5" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      ) : chartType === "sweet" ? (
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="sweet" name="甘いもの" fill="#FAC775" stroke="#BA7517" strokeWidth={0.5} radius={[3,3,0,0]} />
        </BarChart>
      ) : (
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="headache" name="頭痛"  fill="#F09595" stackId="s" />
          <Bar dataKey="nausea"   name="吐き気" fill="#FAC775" stackId="s" />
          <Bar dataKey="nap"      name="昼寝"  fill="#9FE1CB" stackId="s" radius={[3,3,0,0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );

  if (isMobile) {
    return (
      <div>
        {statsRow}
        {chartTabsPills}
        <Card style={{ padding: "1rem" }}>{theChart}</Card>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "1rem", alignItems: "start" }}>
      <div>
        {chartTabsSidebar}
        <Card style={{ padding: "0.75rem" }}>
          <CardTitle>統計</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <StatCard label="記録日数"   value={stats.days}         sub="日" />
            <StatCard label="平均睡眠"   value={stats.avgSleep}     sub="時間" accent />
            <StatCard label="平均スコア" value={stats.avgScore}     sub="/100" />
            <StatCard label="頭痛発生"   value={stats.headacheDays} sub="日" />
          </div>
        </Card>
      </div>
      <Card style={{ padding: "1.25rem" }}>
        <CardTitle>{CHART_TABS.find(t => t.key === chartType)?.label} — 直近{entries.length}件</CardTitle>
        {theChart}
      </Card>
    </div>
  );
};

// ── AI TAB ─────────────────────────────────────────────
const PRESETS = [
  { label: "全体サマリー", prompt: "全体的な健康状態のサマリーと気になる点を教えてください。" },
  { label: "睡眠分析",     prompt: "睡眠パターンを分析し、改善アドバイスをください。" },
  { label: "症状と相関",   prompt: "頭痛や吐き気などの症状と睡眠・食事の相関を分析してください。" },
  { label: "傾向と提案",   prompt: "最近の傾向と今後1週間のアドバイスをください。" },
];

const AITab = ({ db, isMobile }) => {
  const [apiKey,   setApiKey]   = useState(() => localStorage.getItem(GK_KEY) || "");
  const [keySaved, setKeySaved] = useState(false);
  const [prompt,   setPrompt]   = useState("");
  const [output,   setOutput]   = useState("ここにAIの解析結果が表示されます。");
  const [loading,  setLoading]  = useState(false);

  const saveKey = () => {
    localStorage.setItem(GK_KEY, apiKey);
    setKeySaved(true); setTimeout(() => setKeySaved(false), 2000);
  };

  const callGemini = async (p) => {
    if (!apiKey) { setOutput("Gemini APIキーを入力してください。"); return; }
    const entries = Object.values(db).sort((a, b) => a.date < b.date ? -1 : 1).slice(-30);
    if (!entries.length) { setOutput("データがありません。まず記録タブで入力してください。"); return; }
    setLoading(true); setOutput("解析中...");
    const sys = `あなたは健康データアナリストです。以下の日々の健康記録データをもとに、ユーザーの質問に日本語で丁寧に答えてください。\n\nデータ（直近30件）:\n${JSON.stringify(entries, null, 2)}`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: sys + "\n\nユーザーの質問: " + p }] }] }) }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || res.statusText); }
      const d = await res.json();
      setOutput(d.candidates?.[0]?.content?.parts?.[0]?.text || "応答が空でした。");
    } catch (e) { setOutput("エラー: " + e.message); }
    finally { setLoading(false); }
  };

  const keyCard = (
    <Card>
      <CardTitle>Gemini API キー</CardTitle>
      <input className="app-control" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
        placeholder="AIza..."
        style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 8 }} />
      <Btn onClick={saveKey} primary={keySaved} full>{keySaved ? "保存済み ✓" : "保存"}</Btn>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>
        <a href="https://aistudio.google.com/app/apikey" style={{ color: "#185FA5" }}>Google AI Studioで取得</a>
      </div>
    </Card>
  );

  const presetCard = (
    <Card>
      <CardTitle>クイック解析</CardTitle>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "row" : "column",
        flexWrap: isMobile ? "wrap" : "nowrap",
        gap: isMobile ? 6 : 6,
      }}>
        {PRESETS.map(p => (
          <Btn key={p.label} onClick={() => callGemini(p.prompt)} disabled={loading}
            full={!isMobile}>{p.label}</Btn>
        ))}
      </div>
    </Card>
  );

  const mainCard = (
    <Card>
      <CardTitle>質問・結果</CardTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        <textarea className="app-control" value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="AIへの質問を自由入力..." rows={2}
          style={{ ...inputStyle, flex: 1, resize: "vertical" }} />
        <Btn onClick={() => { if (prompt.trim()) callGemini(prompt); }} primary
          disabled={loading || !prompt.trim()}>送信</Btn>
      </div>
      <div style={{
        background: "var(--color-background-secondary)", borderRadius: 8,
        padding: "1rem 1.1rem", fontSize: 14, lineHeight: 1.8,
        minHeight: isMobile ? 160 : 240,
        color: loading ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
        whiteSpace: "pre-wrap",
      }}>{output}</div>
    </Card>
  );

  if (isMobile) {
    return <div>{keyCard}{presetCard}{mainCard}</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1rem", alignItems: "start" }}>
      <div>{keyCard}{presetCard}</div>
      {mainCard}
    </div>
  );
};

// ── DATA TAB ───────────────────────────────────────────
const DataTab = ({ db, setDb, toast, isMobile }) => {
  const entries = useMemo(() =>
    Object.values(db).sort((a, b) => a.date < b.date ? -1 : 1).reverse(), [db]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `health_journal_${todayStr()}.json`; a.click();
  };

  const importJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const next = { ...db, ...data };
        setDb(next); localStorage.setItem(LS_KEY, JSON.stringify(next));
        toast(`${Object.keys(data).length}件のデータを読み込みました`);
      } catch { toast("JSONの読み込みに失敗しました"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const delEntry = (date) => {
    if (!confirm(`${date}のデータを削除しますか？`)) return;
    const next = { ...db }; delete next[date];
    setDb(next); localStorage.setItem(LS_KEY, JSON.stringify(next));
    toast("削除しました");
  };

  const clearAll = () => {
    if (!confirm("全データを削除します。この操作は取り消せません。")) return;
    setDb({}); localStorage.removeItem(LS_KEY); toast("全データを削除しました");
  };

  const importCard = (
    <Card>
      <CardTitle>読み込み</CardTitle>
      <label style={{
        display: "block", border: "0.5px dashed var(--color-border-secondary)",
        borderRadius: 8, padding: "18px 12px", textAlign: "center",
        cursor: "pointer", fontSize: 13, color: "var(--color-text-tertiary)",
        marginBottom: "0.5rem",
      }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>↑</div>
        JSONをアップロード<br />
        <span style={{ fontSize: 11 }}>既存データにマージ</span>
        <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
      </label>
    </Card>
  );

  const exportCard = (
    <Card>
      <CardTitle>書き出し・管理</CardTitle>
      <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={exportJSON} primary full={!isMobile}>JSON保存</Btn>
        <Btn onClick={clearAll} danger full={!isMobile}>全データ削除</Btn>
      </div>
    </Card>
  );

  const listCard = (
    <Card>
      <CardTitle>記録一覧（{entries.length}件）</CardTitle>
      {entries.length === 0
        ? <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", padding: "1rem 0" }}>記録がありません</div>
        : entries.map(e => (
          <div key={e.date} style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "90px 1fr auto" : "110px 1fr auto",
            alignItems: "center", gap: 10,
            padding: "9px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, fontSize: isMobile ? 12 : 13 }}>{e.date}</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>
              {e.sleepHours != null ? e.sleepHours + "h" : "—"} ／ {e.sleepScore}点
              {e.headache ? " 頭痛" : ""}{e.nausea ? " 吐き気" : ""} 甘{e.sweetCount}個
            </span>
            <Btn onClick={() => delEntry(e.date)} danger small>削除</Btn>
          </div>
        ))
      }
    </Card>
  );

  if (isMobile) {
    return <div>{importCard}{exportCard}{listCard}</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1rem", alignItems: "start" }}>
      <div>{importCard}{exportCard}</div>
      {listCard}
    </div>
  );
};

// ── APP ROOT ───────────────────────────────────────────
const TABS = [
  { key: "record", label: "記録" },
  { key: "graph",  label: "グラフ" },
  { key: "ai",     label: "AI解析" },
  { key: "data",   label: "データ" },
];

export default function App() {
  const [tab, setTab] = useState("record");
  const isMobile = useIsMobile();
  const [db, setDb] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  });
  const { msg, vis, show } = useToast();

  return (
    <div style={{ maxWidth: isMobile ? "100%" : 1100, margin: "0 auto", padding: isMobile ? "0.75rem 0.9rem 5rem" : "1rem 1.5rem 3rem" }}>
      {/* header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "1.25rem", paddingBottom: "1rem",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
      }}>
        <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 500 }}>健康ジャーナル</span>
        {!isMobile && (
          <nav style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "8px 20px", fontSize: 14, fontWeight: 500,
                border: "none", background: "none", cursor: "pointer",
                color: tab === t.key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                borderBottom: `2px solid ${tab === t.key ? "var(--color-text-primary)" : "transparent"}`,
                transition: "color .15s",
              }}>{t.label}</button>
            ))}
          </nav>
        )}
      </div>

      {/* content */}
      {tab === "record" && <RecordTab db={db} setDb={setDb} toast={show} isMobile={isMobile} />}
      {tab === "graph"  && <GraphTab  db={db} isMobile={isMobile} />}
      {tab === "ai"     && <AITab     db={db} isMobile={isMobile} />}
      {tab === "data"   && <DataTab   db={db} setDb={setDb} toast={show} isMobile={isMobile} />}

      {/* mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          display: "flex", background: "var(--color-background-primary)",
          borderTop: "0.5px solid var(--color-border-tertiary)",
          zIndex: 100,
        }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "12px 4px 14px",
              fontSize: 11, fontWeight: 500,
              border: "none", background: "none", cursor: "pointer",
              color: tab === t.key ? "#185FA5" : "var(--color-text-tertiary)",
              borderTop: `2px solid ${tab === t.key ? "#185FA5" : "transparent"}`,
              transition: "color .15s",
            }}>{t.label}</button>
          ))}
        </nav>
      )}

      {/* toast */}
      <div style={{
        position: "fixed", bottom: isMobile ? 72 : 28, left: "50%", transform: "translateX(-50%)",
        background: "#185FA5", color: "#fff", padding: "9px 22px",
        borderRadius: 8, fontSize: 14, fontWeight: 500,
        opacity: vis ? 1 : 0, transition: "opacity .3s",
        pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap",
      }}>{msg}</div>
    </div>
  );
}