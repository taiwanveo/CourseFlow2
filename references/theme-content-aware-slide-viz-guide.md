# 主題感知 × 內容感知的動態簡報視覺化系統 — 完整實作指南

> 目標：用 LLM，根據「簡報主題風格（字型、配色、佈局…）」＋「當下一小段文字的文意」，自動生成**內容感知**的圖表、表格、圖說小動畫，且視覺風格與整份簡報一致。
> 本指南設計成可直接餵給 Cursor 等 AI 編輯器，分階段把系統做出來。

---

## 0. 先把目標講清楚

這個系統要同時做到兩種「感知」、產出三種「視覺物件」：

| 維度 | 內容 |
|------|------|
| **內容感知 (content-aware)** | LLM 依據文字的資料特性，決定要畫什麼、怎麼畫（時序→折線、比例→圓餅、強調單一數字→大數字卡…） |
| **主題感知 (theme-aware)** | 產出的配色、字型、圓角、動畫節奏，都從同一套簡報 design token 推導，確保整份簡報一致 |
| **產出 1：圖表** | bar / line / area / pie / 大數字卡 / KPI… |
| **產出 2：表格** | 對照表、排名表，含逐列進場 |
| **產出 3：圖說小動畫** | 一句話＋對應圖示依序浮現、流程步驟、強調標註 |

---

## 1. 最關鍵的架構決策：宣告式契約，不要讓 LLM 寫程式碼

整個系統成敗的關鍵**不在你選哪個動畫庫**，而在「LLM 的輸出格式」。

有兩條路：

- **❌ 命令式 / 讓 LLM 直接生程式碼**（如直接吐 D3 或 GSAP code）
  威力大，但生成的程式碼難以驗證、難 sandbox、難回歸測試，壞掉時無法定位，production 風險高。
- **✅ 宣告式 / LLM 只吐受 schema 約束的 JSON config**
  LLM 負責「決策」（畫什麼、用什麼資料、套什麼風格意圖），你的 renderer 負責「執行」。輸出可被 schema 驗證、可重試、可測試、可觀測。

**本指南全程採用宣告式契約。** 資料流如下：

```
使用者文字 ─┐
            ├──► LLM ──► JSON config ──► zod schema 驗證 ──► Renderer ──► 畫面
Design Tokens ┘                              │ 失敗
                                             └──► 自動重試 / 降級 fallback
```

這也代表：**選庫時優先選宣告式的庫**（recharts / visx / Framer Motion / react-spring），把命令式的 D3 / GSAP 留給少數需要其獨特能力、且你願意手寫的 case。

---

## 2. 三層架構總覽

```
┌─────────────────────────────────────────────┐
│  Layer 1 · Design Token 層                    │
│  唯一的視覺真實來源 (single source of truth)   │
│  色票 / 字型 / 圓角 / 間距 / 動畫節奏           │
└───────────────┬─────────────────────────────┘
                │ 同一份 token 同時餵給 ↓ 兩邊
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌──────────────────────────┐
│ Layer 2       │  │ Layer 3 · Renderer 層      │
│ LLM 生成層     │  │ 消費 token + config 畫圖    │
│ prompt 注入    │─►│ ChartRenderer              │
│ JSON 輸出      │  │ TableRenderer              │
│ schema 驗證    │  │ AnimationRenderer          │
└──────────────┘  └──────────────────────────┘
```

**核心原則**：Design Token 是「唯一真實來源」。LLM 的 prompt 讀它、Renderer 的樣式也讀它。這就是為什麼產出能跟簡報「真的」一致——而不像最初版本只把字型當文字塞進 prompt、實際卻沒套到圖上。

---

## 3. 函式庫選型總表

| 產出 | 首選 | 進階 / 替代 | 說明 |
|------|------|------------|------|
| **圖表** | recharts（快速起步） | **visx**（要客製又要可控）；D3（罕見客製圖才用） | visx 是「把 D3 的 scale 數學包成 React 元件」，控制力強又不離開 React 心智模型 |
| **表格** | 純 React + CSS | **TanStack Table**（headless，複雜排序/分組/虛擬捲動） | 表格不需要視覺化庫，逐列動畫交給 Framer Motion |
| **圖說動畫** | **Framer Motion** | GSAP（精密時間軸編排）；react-spring（物理彈簧、數值補間） | Framer Motion 與 React state 最契合，宣告式、`layout` 自動補間，做「依序浮現」最順 |

**整體建議組合**：`recharts/visx ＋ TanStack Table ＋ Framer Motion`，全部宣告式，與「LLM 吐 config」的契約完美對齊。

---

## 4. 專案骨架

建議用 Vite + React + TypeScript（與你既有的 Vite + React + Tailwind 技術棧一致）。

```
slide-viz/
├── src/
│   ├── tokens/
│   │   └── theme.ts              # Layer 1: Design Token 定義 + 預設主題
│   ├── schema/
│   │   └── visual.ts             # Layer 2: zod schema (LLM 輸出契約)
│   ├── llm/
│   │   ├── prompt.ts             # 組 system prompt（注入 token）
│   │   └── generate.ts           # 呼叫 LLM + 驗證 + 重試
│   ├── renderers/
│   │   ├── ChartRenderer.tsx     # Layer 3: 圖表
│   │   ├── TableRenderer.tsx     # Layer 3: 表格
│   │   └── AnimationRenderer.tsx # Layer 3: 圖說動畫
│   ├── VisualBlock.tsx           # 依 config.kind 分派到對應 renderer
│   └── App.tsx                   # 主題面板 + 輸入 + 預覽
├── server/                       # （選用）後端代理 LLM key，可用 Python FastAPI
│   └── main.py
├── package.json
└── README.md
```

> 後端那一層若你想用 Python，可用 FastAPI 當 LLM 代理（藏 API key、做 rate limit、集中驗證 schema）。前端只打你自己的 `/api/generate`。

---

## 5. 逐層實作

### 5.1 Layer 1 — Design Token 系統

`src/tokens/theme.ts`

```typescript
export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    text: string;
    muted: string;
  };
  font: {
    family: string;       // 真正會被套用的 CSS font-family
    label: string;        // 給 LLM 看的語意描述
  };
  radius: number;         // 圓角
  spacing: number;        // 基礎間距
  motion: {
    duration: number;     // 動畫時長 (ms)
    easing: string;       // cubic-bezier
    stagger: number;      // 元素依序浮現的間隔 (ms)
  };
  moods: string[];        // 風格關鍵字：專業正式 / 科技感 / 活潑輕鬆…
  darkMode: boolean;
}

export const DEFAULT_THEME: DesignTokens = {
  colors: {
    primary: "#6366f1",
    secondary: "#f59e0b",
    accent: "#10b981",
    surface: "#16162a",
    text: "#e8e8f8",
    muted: "#8080aa",
  },
  font: {
    family: "'Segoe UI', 'Helvetica Neue', sans-serif",
    label: "無襯線（現代）",
  },
  radius: 10,
  spacing: 16,
  motion: { duration: 800, easing: "cubic-bezier(0.22,1,0.36,1)", stagger: 80 },
  moods: ["專業正式"],
  darkMode: true,
};

// 依 mood 推導動畫節奏：讓「主題感知」有明確規則，而非任由 LLM 亂猜
export function deriveMotion(moods: string[]): DesignTokens["motion"] {
  if (moods.includes("活潑輕鬆")) return { duration: 1400, easing: "cubic-bezier(0.34,1.56,0.64,1)", stagger: 120 };
  if (moods.includes("科技感"))   return { duration: 600,  easing: "cubic-bezier(0.4,0,0.2,1)",      stagger: 50  };
  if (moods.includes("大膽張揚")) return { duration: 1800, easing: "cubic-bezier(0.22,1,0.36,1)",    stagger: 150 };
  return { duration: 800, easing: "cubic-bezier(0.22,1,0.36,1)", stagger: 80 };
}
```

### 5.2 Layer 2 — Schema（LLM 輸出契約）

`src/schema/visual.ts`，用 zod 把 LLM 輸出鎖死。**這是整個系統的防呆核心。**

```typescript
import { z } from "zod";

const ChartConfig = z.object({
  kind: z.literal("chart"),
  chartType: z.enum(["bar", "line", "area", "pie", "kpi"]),
  title: z.string(),
  subtitle: z.string().optional(),
  xKey: z.string(),
  yKey: z.string(),
  data: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
  unit: z.string().optional(),
  // 注意：不讓 LLM 自由給 hex，而是給「語意角色」，由 renderer 對應 token
  colorRole: z.enum(["sequential", "categorical", "highlight"]).default("categorical"),
  designNote: z.string().optional(),
});

const TableConfig = z.object({
  kind: z.literal("table"),
  title: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string() })).min(1),
  rows: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
  highlightColumn: z.string().optional(),
});

const AnimationConfig = z.object({
  kind: z.literal("animation"),
  title: z.string(),
  pattern: z.enum(["reveal-list", "process-flow", "callout"]),
  items: z.array(z.object({
    text: z.string(),
    icon: z.string().optional(),     // emoji 或 icon 名
    emphasis: z.boolean().default(false),
  })).min(1),
});

export const VisualConfig = z.discriminatedUnion("kind", [
  ChartConfig, TableConfig, AnimationConfig,
]);
export type VisualConfig = z.infer<typeof VisualConfig>;
```

> 關鍵設計：**配色不讓 LLM 直接吐 hex**，而是吐「語意角色」（sequential / categorical / highlight），由 renderer 用 token 對應。這樣換主題色時，所有歷史圖表自動跟著變，真正做到主題感知。

### 5.3 Layer 2 — LLM 生成層

`src/llm/prompt.ts`

```typescript
import type { DesignTokens } from "../tokens/theme";

export function buildSystemPrompt(theme: DesignTokens): string {
  return `你是專業簡報視覺化設計師。根據使用者文字，選擇最合適的視覺呈現方式。

【當前簡報主題】
- 字型風格：${theme.font.label}
- 風格關鍵字：${theme.moods.join("、") || "通用"}
- 模式：${theme.darkMode ? "深色" : "淺色"}

【決策原則】
1. 先判斷文字本質：
   - 有數列、可比較 → chart
   - 多項目多屬性對照 → table
   - 流程 / 重點條列 / 單句強調 → animation
2. chart 再依資料特性選 chartType：
   時序趨勢→line/area，比例分佈→pie，比較排名→bar，單一關鍵數字→kpi
3. 數值必須是純數字，不含單位文字（單位放 unit 欄位）
4. colorRole：強調單一對象用 highlight，分類比較用 categorical，連續趨勢用 sequential

只回傳一個合法 JSON 物件，符合下列其一的結構，不要任何多餘文字或 Markdown：
- chart: { kind, chartType, title, subtitle?, xKey, yKey, data[], unit?, colorRole, designNote? }
- table: { kind, title, columns[{key,label}], rows[], highlightColumn? }
- animation: { kind, title, pattern(reveal-list|process-flow|callout), items[{text, icon?, emphasis}] }`;
}
```

`src/llm/generate.ts`（含驗證 + 重試 + 降級）

```typescript
import { VisualConfig } from "../schema/visual";
import { buildSystemPrompt } from "./prompt";
import type { DesignTokens } from "../tokens/theme";

export async function generateVisual(input: string, theme: DesignTokens) {
  const MAX_RETRY = 2;
  let lastErr = "";

  for (let i = 0; i <= MAX_RETRY; i++) {
    const res = await fetch("/api/generate", {           // 走自己的後端代理，別在前端放 key
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: buildSystemPrompt(theme),
        input,
        // 重試時把上次錯誤回饋給 LLM，提高修正成功率
        repair: lastErr || undefined,
      }),
    });

    const raw = await res.json();
    // 穩健解析：依 type 找 text block，而非寫死 content[0]
    const text = (raw.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(text);
      return VisualConfig.parse(parsed);   // zod 驗證，過了才回傳
    } catch (e: any) {
      lastErr = e.message;                 // 把錯誤丟回下一輪當修正提示
    }
  }
  throw new Error(`生成失敗：${lastErr}`);
}
```

> 三個比原始版本更穩的點：(1) 用 `filter(type==="text")` 取代寫死的 `content[0]`；(2) zod 驗證取代裸 `JSON.parse`；(3) 驗證失敗自動把錯誤回饋給 LLM 重試（self-repair）。

### 5.4 Layer 3 — 圖表 Renderer

`src/renderers/ChartRenderer.tsx`（recharts 起步版）

```tsx
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
         XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { DesignTokens } from "../tokens/theme";

// 把語意角色對應成實際色票 —— 主題感知的落地點
function palette(role: string, t: DesignTokens): string[] {
  const { primary, secondary, accent } = t.colors;
  if (role === "highlight")  return [primary, t.muted, t.muted, t.muted, t.muted];
  if (role === "sequential") return [primary, primary + "cc", primary + "99", primary + "66", primary + "33"];
  return [primary, secondary, accent, primary + "aa", secondary + "aa"]; // categorical
}

export function ChartRenderer({ config, theme }: { config: any; theme: DesignTokens }) {
  const c = palette(config.colorRole, theme);
  const dur = theme.motion.duration;
  const axis = theme.darkMode ? "#5a5a7a" : "#9090aa";
  const common = { fill: axis, fontSize: 12, fontFamily: theme.font.family };

  if (config.chartType === "line")
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={config.data}>
          <CartesianGrid stroke="#ffffff14" strokeDasharray="4 4" />
          <XAxis dataKey={config.xKey} tick={common} axisLine={false} tickLine={false} />
          <YAxis tick={common} axisLine={false} tickLine={false} unit={config.unit} />
          <Tooltip />
          <Line type="monotone" dataKey={config.yKey} stroke={c[0]} strokeWidth={3}
                isAnimationActive animationDuration={dur} />
        </LineChart>
      </ResponsiveContainer>
    );

  // pie / area / bar 同理，差別只在用哪個 recharts 元件 + 套 c[] 與 dur
  // …（依 chartType 分支，略）
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={config.data}>
        <CartesianGrid stroke="#ffffff14" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey={config.xKey} tick={common} axisLine={false} tickLine={false} />
        <YAxis tick={common} axisLine={false} tickLine={false} unit={config.unit} />
        <Tooltip />
        <Bar dataKey={config.yKey} radius={[theme.radius / 2, theme.radius / 2, 0, 0]}
             isAnimationActive animationDuration={dur}>
          {config.data.map((_: any, i: number) => <Cell key={i} fill={c[i % c.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

> 之後要更高客製度（自訂軸、漸層、互動標註），把這支換成 **visx**：自己用 `@visx/scale` 算 scale、`@visx/shape` 畫圖形，動畫補間交給 react-spring。介面契約（吃 `config` + `theme`）完全不變，所以可以無痛替換。

### 5.5 Layer 3 — 表格 Renderer

`src/renderers/TableRenderer.tsx`（純 React + Framer Motion 逐列進場）

```tsx
import { motion } from "framer-motion";
import type { DesignTokens } from "../tokens/theme";

export function TableRenderer({ config, theme }: { config: any; theme: DesignTokens }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: theme.font.family }}>
      <thead>
        <tr>
          {config.columns.map((col: any) => (
            <th key={col.key} style={{ textAlign: "left", padding: theme.spacing / 2,
                 color: theme.colors.muted, borderBottom: `2px solid ${theme.colors.primary}` }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {config.rows.map((row: any, ri: number) => (
          <motion.tr key={ri}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (ri * theme.motion.stagger) / 1000, duration: 0.4 }}>
            {config.columns.map((col: any) => (
              <td key={col.key} style={{ padding: theme.spacing / 2, color: theme.colors.text,
                   fontWeight: col.key === config.highlightColumn ? 700 : 400 }}>
                {row[col.key]}
              </td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}
```

> 複雜需求（排序、分組、上萬列虛擬捲動）再導入 **TanStack Table**（headless，樣式仍由你的 token 控制）。

### 5.6 Layer 3 — 圖說動畫 Renderer

`src/renderers/AnimationRenderer.tsx`（Framer Motion 依序浮現）

```tsx
import { motion } from "framer-motion";
import type { DesignTokens } from "../tokens/theme";

export function AnimationRenderer({ config, theme }: { config: any; theme: DesignTokens }) {
  const isFlow = config.pattern === "process-flow";
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: theme.motion.stagger / 1000 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: theme.motion.duration / 1000 } },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show"
      style={{ display: "flex", flexDirection: isFlow ? "row" : "column",
               gap: theme.spacing, fontFamily: theme.font.family, flexWrap: "wrap" }}>
      {config.items.map((it: any, i: number) => (
        <motion.div key={i} variants={item}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: theme.spacing, borderRadius: theme.radius,
            background: it.emphasis ? theme.colors.primary + "22" : "transparent",
            border: `1px solid ${it.emphasis ? theme.colors.primary : theme.colors.muted + "44"}`,
            color: theme.colors.text,
          }}>
          {it.icon && <span style={{ fontSize: 22 }}>{it.icon}</span>}
          <span style={{ fontWeight: it.emphasis ? 700 : 400 }}>{it.text}</span>
          {isFlow && i < config.items.length - 1 && (
            <span style={{ color: theme.colors.primary, marginLeft: 8 }}>→</span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### 5.7 分派器

`src/VisualBlock.tsx`

```tsx
import { ChartRenderer } from "./renderers/ChartRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { AnimationRenderer } from "./renderers/AnimationRenderer";
import type { DesignTokens } from "./tokens/theme";
import type { VisualConfig } from "./schema/visual";

export function VisualBlock({ config, theme }: { config: VisualConfig; theme: DesignTokens }) {
  switch (config.kind) {
    case "chart":     return <ChartRenderer config={config} theme={theme} />;
    case "table":     return <TableRenderer config={config} theme={theme} />;
    case "animation": return <AnimationRenderer config={config} theme={theme} />;
  }
}
```

---

## 6. 用 Cursor 實際做出來的工作流

不要一句「幫我做一個簡報視覺化系統」丟給 Cursor——它會生出一坨難維護的東西。**分階段、給契約、逐層驗收**才是正解。

### Step 0 — 先放好「契約文件」
把**本指南**和你的 `DesignTokens`、`VisualConfig` schema 放進專案，在 Cursor 用 `@` 引用它們當 context。schema 是你跟 AI 之間的合約，永遠先確立它。

### Step 1 — 搭骨架
> 貼給 Cursor 的 prompt：
> ```
> 用 Vite + React + TypeScript 建立專案，目錄結構照 @theme-content-aware-slide-viz-guide.md 第 4 節。
> 先只實作 Layer 1 (tokens/theme.ts) 與 Layer 2 (schema/visual.ts)，
> 完全照指南 5.1 與 5.2 的程式碼。先不要動 renderer。
> ```
驗收：`npm run dev` 能起、`tsc` 無錯。

### Step 2 — 接 LLM 生成層（先用假資料）
> ```
> 實作 src/llm/prompt.ts 與 generate.ts（照指南 5.3）。
> 先寫一個 mock 版 /api/generate，回傳寫死的 chart config，
> 讓我能離線驗證 zod 驗證與重試邏輯都正確。
> ```
驗收：故意餵壞 JSON，確認會重試並最終丟出清楚錯誤。

### Step 3 — 逐一實作三個 renderer
一次只做一個，做完看畫面再下一個：
> ```
> 實作 ChartRenderer（照指南 5.4），用 Step 2 的 mock config 渲染。
> 重點檢查：colorRole 是否正確對應到 theme 的色票（改主題色時圖會跟著變）。
> ```
接著 `TableRenderer`、`AnimationRenderer` 同樣節奏。

### Step 4 — 接真實 LLM 後端
> ```
> 把 mock /api/generate 換成真的後端代理。
> 用 FastAPI（server/main.py），從環境變數讀 API key，
> 前端不得出現任何 key。後端負責呼叫模型並回傳 content。
> ```
（用 Python 的話這層正好發揮你的強項。）

### Step 5 — 主題面板 + 即時預覽
> ```
> 實作 App.tsx：左側主題面板（色票/字型/mood/深淺色），
> 中間輸入框，右側用 VisualBlock 渲染。
> 改 mood 時呼叫 deriveMotion 更新動畫節奏，並即時反映在預覽上。
> ```

### 給 Cursor 的通用守則（建議寫進 `.cursorrules`）
```
- LLM 永遠只輸出符合 src/schema/visual.ts 的 JSON，絕不生成可執行繪圖程式碼。
- 所有 renderer 必須吃 (config, theme) 兩個 props，樣式只能來自 theme token，不准寫死色票。
- 新增圖表類型 = 先擴充 zod schema → 再改 prompt 決策原則 → 最後改 renderer，順序不可顛倒。
- 任何來自 LLM 的輸出在進 renderer 前一定先過 VisualConfig.parse()。
```

---

## 7. 進階：可觀測性與評測（選做，但建議）

既然 LLM 的決策是系統核心，就值得像對待程式一樣去「測」它：

- **記錄**：把每次 `(input, theme, raw_output, validated_config, retry_count)` 落地存檔，方便回溯哪種輸入容易讓 LLM 出錯。
- **Skill eval**：準備一組「黃金測試案例」（例如 20 句各類型文字），跑批次生成，斷言 `kind / chartType` 是否符合預期、schema 是否一次通過。把通過率當成 prompt 的回歸指標。
- **降級策略**：重試到上限仍失敗時，回退到一個保底渲染（例如把文字直接做成 `callout` 動畫卡），不要讓使用者看到崩壞畫面。

---

## 8. 漸進式路線圖

| 階段 | 做到 | 用到 |
|------|------|------|
| **MVP** | chart（bar/line/pie/area）＋ 主題色票感知 | recharts + zod |
| **v1** | 加表格、加圖說動畫三種 pattern | + TanStack Table（選）+ Framer Motion |
| **v2** | 字型/圓角/動畫節奏全面 token 化、self-repair 重試 | 完整 token 系統 |
| **v3** | visx 客製圖表、批次 eval、可觀測性 | visx + react-spring + 評測腳本 |
| **v4** | 真正讀取簡報版面（佔位框尺寸）回饋給 LLM 做佈局感知 | 與簡報引擎整合 |

> 第 4 節提到的「佈局感知」是最難、最後做的：要把投影片實際可用的版面尺寸/佔位框資訊也納入 token，LLM 才能決定圖表該多大、該不該換成精簡版。建議放到最後，前面四階段穩了再碰。

---

### 一句總結
**Design Token 當唯一真實來源，LLM 只吐 schema 驗證過的宣告式 config，renderer 照 token 執行**——抓住這三件事，剩下都是換庫的細節（recharts↔visx、Framer Motion↔GSAP 都能無痛替換，因為契約不變）。
