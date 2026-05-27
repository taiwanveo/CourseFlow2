# WVP VisualConfig（宣告式視覺）使用說明

本文件說明 v2 的「內容感知 × 主題一致」視覺管線：**LLM 做決策、Renderer 做執行**。

---

## 你會看到什麼

在 Craft（視覺動效）第 ② 步「產生章節」時，系統會對每個 step（步驟）嘗試產生一個 `VisualConfig`：

- **chart（圖表）**：bar / line / area / pie / kpi
- **table（表格）**：欄位＋列資料；支援排序、欄/列強調、**columnMeta 數值格式**、**highlightBest 最佳值標記**、**mini bar 熱力條**
- **animation（小動畫）**：reveal-list / process-flow / callout

產生後會寫入 `chapter_craft.checklist_result.stepVisualConfigs`，並在 materialize（打包）時寫進章節 TSX 的 `STEP_VISUALS`，由 `VisualBlock` 渲染。

---

## 決策規則（重點）

### 1) 只讓 LLM 輸出 JSON，不寫 TSX

LLM 輸出會被 zod schema 驗證；不合法會 **重試**，最後才降級。

### 2) 禁止把單位塞到數值

- `chart.data[*][yKey]` **必須是 number**
- 單位放 `unit`（例如 `%`、`億`、`元`）

### 3) table 第二輪（對照卡進階）

| 欄位 | 說明 |
|------|------|
| `columnMeta[]` | 每欄 `format`（text/number/percent/currency）、`unit`、`miniBar` |
| `highlightBest` | `{ key, direction: "max"\|"min" }` 標出該欄最佳列（左側 accent 邊線） |
| `density` | `compact` / `comfortable`（列高） |

未提供 `columnMeta` 時，Renderer 會依欄名與樣本值**推斷**格式；未提供 `highlightBest` 時，會對各數值欄自動標記最大值列。

### 4) 主題一致：不輸出 hex（十六進位色碼）

`colorRole` 只能是：
- `sequential`（連續趨勢）
- `categorical`（分類比較）
- `highlight`（單一強調）

實際顏色由 theme token（例如 `--accent`、`--text-2`、`--accent-glow`）決定。

---

## 降級策略（fallback）

對每個 step 依序採用：

1. **LLM**（JSON 驗證通過即用）
2. **heuristic（啟發式）**：從文字抽出「標籤-數值」或清單，推導 chart / animation
3. **fallback callout**：仍失敗時用 `animation.callout`（至少有一致的動效與可讀性）

---

## 哪些章節會使用 VisualConfig？

目前只對 **非 list-reveal / flow / hook** 的章節（通常是 magazine）嘗試套用「visual-mix」模板。

也就是：

- list-reveal：維持 `ListRevealGrid`
- flow：維持 `FlowDiagram`
- hook：維持 `HookImageStrip`
- magazine（或其他）：可能使用 `VisualBlock` + `STEP_VISUALS`

---

## 開發者：關鍵程式位置

- LLM 產 step 視覺：`apps/web/src/lib/wvp-step-visual-config.ts`
- schema + 產生器：`packages/visual-config/src/schema/visual.ts`、`packages/visual-config/src/llm/generate.ts`
- 章節模板（寫入 STEP_VISUALS）：`packages/presentation/src/codegen/templates/visual-mix.ts`
- Renderer：`packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/VisualBlock.tsx` 與 `components/visual/*`

---

## 驗收方式（建議）

1. 找一章 magazine 內容，口播中含數字／比例（例如「市佔率 45/30/25」）
2. 在 Craft 對該章按「② 產生章節」→「④ 打包課程預覽」→「⑤ 開啟播放」
3. 觀察該 step 是否出現圖表/表格/列表動畫（而不是純文字）
4. 若某步不該有視覺卻被塞滿，或該有卻沒有：把那一步的口播貼回來，我們再調 `shouldStepHaveVisual()` 與 heuristic。

