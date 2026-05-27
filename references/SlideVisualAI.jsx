import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const MOOD_OPTIONS = [
  "專業正式", "活潑輕鬆", "科技感", "溫暖親切",
  "極簡冷靜", "大膽張揚", "優雅精緻", "數據導向",
];

const FONT_STYLES = [
  { id: "sans", label: "無襯線（現代）", css: "'Segoe UI', 'Helvetica Neue', sans-serif" },
  { id: "serif", label: "襯線體（傳統）", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "等寬體（科技）", css: "'Courier New', Courier, monospace" },
  { id: "display", label: "展示體（吸睛）", css: "Impact, 'Arial Black', sans-serif" },
];

const EXAMPLES = [
  "2024 年四季營收：Q1 120億、Q2 135億、Q3 150億、Q4 180億",
  "三個市場的市佔率：台灣 45%、日本 30%、韓國 25%",
  "每月新用戶：1月100人、2月150人、3月210人、4月280人、5月340人、6月420人",
  "部門費用分配：研發 40%、行銷 25%、營運 20%、管理 15%",
];

function buildSystemPrompt(theme) {
  const fontLabel = FONT_STYLES.find((f) => f.id === theme.fontStyle)?.label || theme.fontStyle;
  return `你是一個專業的簡報視覺化設計師。
根據使用者的文字內容，配合指定的簡報主題風格，生成最合適的動態圖表設定。

【當前簡報主題風格】
- 主色：${theme.primaryColor}
- 次色：${theme.secondaryColor}
- 強調色：${theme.accentColor}
- 字型風格：${fontLabel}
- 風格關鍵字：${theme.moods.length ? theme.moods.join("、") : "通用"}
- 模式：${theme.darkMode ? "深色" : "淺色"}

設計原則：
1. colors 陣列必須從主色、次色、強調色延伸出和諧的多色方案（提供5色）
2. animationDuration 根據風格關鍵字決定（活潑輕鬆→1500，專業正式→800，科技感→600，大膽張揚→2000，其他→1000）
3. 圖表類型根據資料特性選擇（時序/趨勢→line或area，比例/分佈→pie，比較/排名→bar）
4. 數值必須是純數字，不含單位文字

請只回傳一個合法的 JSON 物件，絕對不要有任何多餘文字、說明或 Markdown 符號：
{
  "chartType": "bar 或 line 或 pie 或 area",
  "title": "圖表標題",
  "subtitle": "副標題（一句話，選填）",
  "xKey": "x軸欄位名稱",
  "yKey": "y軸欄位名稱",
  "data": [{ "xKey的值": "標籤文字", "yKey的值": 純數字 }],
  "unit": "單位",
  "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "animationDuration": 毫秒數,
  "designNote": "一句話說明你的配色邏輯"
}`;
}

function DynamicChart({ config, theme }) {
  const { chartType, xKey, yKey, data, colors, animationDuration, unit } = config;
  const c = colors?.length ? colors : [theme.primaryColor, theme.secondaryColor, theme.accentColor];
  const tooltipStyle = {
    background: theme.darkMode ? "#16162a" : "#ffffff",
    border: `1px solid ${c[0]}55`,
    borderRadius: 10,
    color: theme.darkMode ? "#e0e0f0" : "#1a1a2e",
    fontSize: 13,
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };
  const axisColor = theme.darkMode ? "#5a5a7a" : "#9090aa";
  const gridColor = theme.darkMode ? "#ffffff0d" : "#00000010";

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" />
          <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} width={50} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={yKey} stroke={c[0]} strokeWidth={3}
            dot={{ r: 5, fill: c[0], strokeWidth: 2, stroke: theme.darkMode ? "#1a1a2e" : "#fff" }}
            activeDot={{ r: 8, fill: c[1] }}
            isAnimationActive animationDuration={animationDuration} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c[0]} stopOpacity={0.5} />
              <stop offset="100%" stopColor={c[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" />
          <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} width={50} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={yKey} stroke={c[0]} strokeWidth={2.5}
            fill="url(#aG)" isAnimationActive animationDuration={animationDuration} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey={yKey} nameKey={xKey}
            cx="50%" cy="50%" outerRadius={110} innerRadius={55}
            paddingAngle={3} isAnimationActive animationDuration={animationDuration}>
            {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} stroke="transparent" />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, color: axisColor }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  // default: bar
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} width={50} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={yKey} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={animationDuration}>
          {data.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function App() {
  const [theme, setTheme] = useState({
    primaryColor: "#6366f1",
    secondaryColor: "#f59e0b",
    accentColor: "#10b981",
    fontStyle: "sans",
    moods: ["專業正式"],
    darkMode: true,
  });
  const [input, setInput] = useState("");
  const [chartConfig, setChartConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bg      = theme.darkMode ? "#0d0d16" : "#f4f4fa";
  const surface = theme.darkMode ? "#16162a" : "#ffffff";
  const surface2 = theme.darkMode ? "#1e1e33" : "#f0f0f8";
  const border  = theme.darkMode ? "#2e2e4a" : "#e0e0ec";
  const textMain = theme.darkMode ? "#e8e8f8" : "#1a1a2e";
  const textMuted = theme.darkMode ? "#6060888" : "#8080aa";

  const fontCss = FONT_STYLES.find((f) => f.id === theme.fontStyle)?.css || "sans-serif";

  const toggleMood = (m) => setTheme((p) => ({
    ...p,
    moods: p.moods.includes(m) ? p.moods.filter((x) => x !== m) : [...p.moods, m],
  }));

  const generate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(theme),
          messages: [{ role: "user", content: input }],
        }),
      });
      const raw = await res.json();
      const txt = raw.content?.[0]?.text?.replace(/```json|```/g, "").trim();
      setChartConfig(JSON.parse(txt));
    } catch {
      setError("解析失敗，請重新描述或稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textMain, fontFamily: fontCss, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${border}`, background: surface, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>✦</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.08em" }}>SLIDE VISUAL AI</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 1 }}>主題感知動態圖表生成器</div>
        </div>
        {/* Live theme preview strip */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
          {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map((c, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c }} />
          ))}
          <div style={{ fontSize: 11, color: textMuted, marginLeft: 6, fontFamily: "monospace" }}>
            {theme.moods[0] || "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Left: Theme Panel ── */}
        <div style={{ width: 256, background: surface, borderRight: `1px solid ${border}`, padding: "20px 16px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: textMuted }}>THEME CONFIG</div>

          {/* Color pickers */}
          {[
            { label: "主色 Primary", key: "primaryColor" },
            { label: "次色 Secondary", key: "secondaryColor" },
            { label: "強調 Accent", key: "accentColor" },
          ].map(({ label, key }) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", width: 36, height: 36 }}>
                  <input type="color" value={theme[key]}
                    onChange={(e) => setTheme((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                  />
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: theme[key], border: `2px solid ${border}`, pointerEvents: "none" }} />
                </div>
                <div style={{ flex: 1, padding: "7px 10px", background: bg, borderRadius: 7, fontSize: 12, fontFamily: "monospace", color: textMain, border: `1px solid ${border}` }}>
                  {theme[key]}
                </div>
              </div>
            </div>
          ))}

          <div style={{ borderTop: `1px solid ${border}` }} />

          {/* Font style */}
          <div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>字型風格</div>
            <select value={theme.fontStyle}
              onChange={(e) => setTheme((p) => ({ ...p, fontStyle: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", background: bg, border: `1px solid ${border}`, borderRadius: 7, color: textMain, fontSize: 12, cursor: "pointer" }}>
              {FONT_STYLES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>

          {/* Mood tags */}
          <div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 8 }}>風格關鍵字</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MOOD_OPTIONS.map((m) => {
                const sel = theme.moods.includes(m);
                return (
                  <button key={m} onClick={() => toggleMood(m)}
                    style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: `1px solid ${sel ? theme.primaryColor : border}`, background: sel ? theme.primaryColor + "28" : "transparent", color: sel ? theme.primaryColor : textMuted, fontWeight: sel ? 700 : 400, transition: "all 0.18s" }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${border}` }} />

          {/* Dark mode toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, color: textMuted }}>深色模式</div>
            <button onClick={() => setTheme((p) => ({ ...p, darkMode: !p.darkMode }))}
              style={{ width: 46, height: 26, borderRadius: 13, border: "none", background: theme.darkMode ? theme.primaryColor : border, cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
              <div style={{ position: "absolute", top: 3, left: theme.darkMode ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            </button>
          </div>

          {/* AI color preview */}
          {chartConfig?.colors && (
            <>
              <div style={{ borderTop: `1px solid ${border}` }} />
              <div>
                <div style={{ fontSize: 10, color: textMuted, marginBottom: 8, fontWeight: 700, letterSpacing: "0.1em" }}>AI 生成配色</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {chartConfig.colors.map((c, i) => (
                    <div key={i} style={{ flex: 1, height: 28, borderRadius: 6, background: c }} title={c} />
                  ))}
                </div>
                {chartConfig.designNote && (
                  <div style={{ fontSize: 11, color: textMuted, marginTop: 8, lineHeight: 1.6 }}>
                    {chartConfig.designNote}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Main Area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 20, overflowY: "auto" }}>

          {/* Input */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: textMuted, marginBottom: 10 }}>INPUT</div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.metaKey && generate()}
              placeholder={"用自然語言描述你的資料...\n\n例：「2024 年各季度營收：Q1 120億、Q2 135億、Q3 150億、Q4 180億」\n例：「三個市場的市佔率：台灣 45%、日本 30%、韓國 25%」"}
              style={{ width: "100%", minHeight: 100, padding: "14px 16px", background: surface, border: `1px solid ${border}`, borderRadius: 10, color: textMain, fontSize: 14, resize: "vertical", outline: "none", lineHeight: 1.7, boxSizing: "border-box", fontFamily: fontCss, transition: "border-color 0.2s" }}
            />

            {/* Example chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => setInput(ex)}
                  style={{ padding: "4px 12px", fontSize: 11, borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: textMuted, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.target.style.borderColor = theme.primaryColor; e.target.style.color = theme.primaryColor; }}
                  onMouseLeave={(e) => { e.target.style.borderColor = border; e.target.style.color = textMuted; }}>
                  {ex.length > 22 ? ex.slice(0, 22) + "…" : ex}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <div style={{ fontSize: 11, color: textMuted }}>⌘ + Enter 快速生成</div>
              <button onClick={generate} disabled={loading || !input.trim()}
                style={{ padding: "10px 26px", borderRadius: 9, border: "none", background: (loading || !input.trim()) ? border : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`, color: (loading || !input.trim()) ? textMuted : "#fff", fontWeight: 700, fontSize: 13, cursor: (loading || !input.trim()) ? "not-allowed" : "pointer", letterSpacing: "0.06em", transition: "opacity 0.2s", fontFamily: fontCss }}>
                {loading ? "⏳ AI 解析中..." : "✦ 生成圖表"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "12px 16px", background: "#ef444418", border: "1px solid #ef444466", borderRadius: 9, color: "#ef4444", fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* Chart Output */}
          {chartConfig && !loading && (
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "24px 28px", flex: 1 }}>
              {/* Chart header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 800, background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.secondaryColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {chartConfig.title}
                </div>
                {chartConfig.subtitle && (
                  <div style={{ fontSize: 13, color: textMuted, marginTop: 5, lineHeight: 1.5 }}>
                    {chartConfig.subtitle}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: theme.primaryColor + "22", color: theme.primaryColor, fontWeight: 600 }}>
                    {chartConfig.chartType}
                  </span>
                  {chartConfig.unit && (
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: surface2, color: textMuted }}>
                      單位：{chartConfig.unit}
                    </span>
                  )}
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: surface2, color: textMuted }}>
                    動畫 {chartConfig.animationDuration}ms
                  </span>
                </div>
              </div>

              <DynamicChart config={chartConfig} theme={theme} />
            </div>
          )}

          {/* Empty state */}
          {!chartConfig && !loading && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: textMuted, minHeight: 200 }}>
              <div style={{ fontSize: 52, opacity: 0.15 }}>✦</div>
              <div style={{ fontSize: 14, textAlign: "center", lineHeight: 1.7, maxWidth: 340, opacity: 0.7 }}>
                設定好左側主題風格<br />輸入資料描述，AI 將生成與簡報一致的動態圖表
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
