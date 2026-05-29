# CHANGES

本專案 fork 自上游 `web-video-presentation`，在原版的「點選驅動 16:9 網頁演示 + 錄屏成片」工作流之上補強了六項能力，並調整三條設計原則以容納「錄屏 + 互動演講 + PDF 簡報 + 對話定址」四個維度的使用情境。

skill 本體（`.claude/skills/web-video-v2/`）已重新整理為獨立視角的敘述 —— 內部文件不再提及「v1 / v2」或上游版本，使用 agent 時把它當成一份完整的、自洽的 skill 就好。本檔案是專案層級的歷史記錄，說明這份 fork 相對於上游做了什麼。

---

## 上游

- 上游 skill：`web-video-presentation`（Conard Li / garden-skills）
- 上游能力：B 站風口播稿轉「動態 PPT 但不像 PPT」的點選驅動 16:9 演示、Vite + React + TS 腳手架、(chapter, step) 遊標模型、主題 token 系統、可選 MiniMax mmx-cli 音訊合成、Auto 模式一鏡到底錄屏。

本 fork 保留上游全部設計哲學（十條原則、雙源原則、章節資料夾物理隔離、`narrations.ts` 唯一真相源、主題 token 兜底視覺統一），僅在 framework chrome 與工具鏈層做擴張。

---

## 新增能力（六項，全部內建在腳手架）

### 1. 底部字幕條 SubtitleBar

- 直接讀 `narrations[step]` 顯示在底部 8vh 黑半透明條上。
- 使用者寫什麼語言就顯示什麼，**不引入語言切換 UI**、**不改 narrations 資料結構**（避免污染音訊合成管線）。
- 控制：鍵盤 `S` 開關 / `?subs=off` 強制隱藏 / `?subs=on` 強制顯示。**預設顯示，錄屏模式也顯示** —— 字幕屬於成片內容，不是 chrome。
- localStorage key：`presentation-subtitle-enabled-v2`。

### 2. 頂部 hover 功能表 TopMenu

- 滑鼠進入頂部 5vh 觸發區 200ms 漸顯、離開 600ms 漸隱。
- 七個入口：Restart / Pause / Play / Auto Section / Auto All / 速度切換 (1× → 1.25× → 1.5× → 2×) / Download PDF。
- 速度切換只動 `audio.playbackRate` 與 CSS var `--speed`，章節 CSS 動畫透過 `var(--anim-*)` token 或 `calc(<ms> / var(--speed))` 自動跟著加速。
- 錄屏 (`mode === 'auto' | 'section'` 或 `?recording=1`) 強制隱藏。

### 3. Auto Section 模式

- `useAutoMode` 新增 `section` 模式（在 audio 與 auto 之間）：自動播到當前 chapter 最後一步就停，**不跨章**。
- 適合「自動播完本章 → 講者解說 → 手動進入下一章」的 demo 場景。
- URL：`?section=1`；鍵盤 `M` 循環 `manual → audio → section → auto → manual`。

### 4. 一鍵 PDF 簡報匯出

- 主路徑：React 同步掛上 `.print-deck`（所有 step 一次性渲染）→ `window.print()` → 系統列印對話框存 PDF。
- 一頁 = 一個 step，A4 橫向，16:9 排版，**包含字幕、不含 chrome**。
- 兜底路徑（預留未啟用）：`html2pdf.js` 走 canvas 合併。
- 章節作者不需要為 PDF 做特別工作 —— print.css 獨立排版、共用同一 React render path。

### 5. 右下角頁碼 PageNumber + 對話定址

- 顯示 `{chapterIdx+1}.{step+1}`（1-based，給人類用），例如 `2.3` = 第 2 章第 3 步。
- hover Stage 任意處 200ms 漸顯；錄屏模式強制隱藏。
- 使用者可用此編碼直接對話定址：「重寫 2.3」= agent 開 `src/chapters/02-<id>/Chapter.tsx` 找 `step === 2` 分支重做。
- 程式碼內部仍用 0-based 索引（`chapters[N-1]` 的 `step === M-1`），agent 處理時記得 -1。

### 6. 可選全螢幕無黑邊 Fit 模式

- Stage 外層新增 `fit` 策略，由 `?fit=` 控制：
  - `contain`（**預設**）= 上游原行為，保比例 + letterbox 黑邊，任何 viewport 都不裁切。
  - `cover`（`?fit=cover` opt-in）= 填滿 viewport，必要時對稱裁切兩側 / 上下，全螢幕無黑邊。
- **預設選擇歷史**：本 fork 初版預設 `cover`（「無黑邊出廠」），但實測發現 16:10 筆電 viewport 下章節作者寫的「邊角 corner label / 頂部 hero 大字」常被悄悄裁掉，破壞了上游「what you design is what you see」承諾 —— 翻回 `contain` 預設，`cover` 改為明確 opt-in。
- **僅當使用者選用 `?fit=cover`** 時，章節作者才需要遵守「安全區 1600×900」（核心視覺集中於中央，外圈只放裝飾性元素）。contain 預設下無此約束。

### 7. 自動排版自檢 self-check

- `npm run self-check` 啟動 Playwright，遍歷所有 `(chapter, step)` 組合：
  - Recording pass：`?chapter=N&step=M&recording=1` 截圖、量主視覺字級、查文字溢出 stage。
  - Manual pass：驗 PageNumber 位置（右下 24px 內距）+ SubtitleBar 文字 = `narrations[step]`。
  - Subs-off pass（每章首步抽樣）：驗 `?subs=off` 下 SubtitleBar 不渲染。
- 紅線：主視覺字級 < 16px / 任一文字溢出 stage → 必修。
- 警告：主視覺字級 < 24px → 允許但需在 progress 註記。
- 產出：`self-check-report.html`（人類審 + 縮圖）+ `self-check-report.json`（agent 解析）+ `self-check-screenshots/`。
- 兜底：Playwright → `puppeteer-core` + 本機 Chrome → `vitest + jsdom` 純量測（無截圖）。
- 強制：每章交付前跑通 + 無紅線。

---

## 對上游「十條原則」的調整（原則 1 / 5 / 6）

| 上游原則 | 本 fork 調整 | 落地位置 |
|---|---|---|
| **原則 1 · 16:9 固定舞臺** | 內容**仍**在 1920×1080 設計、章節作者照舊不處理響應式。Stage 外層新增 `fit` 策略：預設 `contain`（=上游行為），`?fit=cover` opt-in 切無黑邊。僅 cover 模式下要遵守「安全區 1600×900」。 | `components/Stage.tsx` + `hooks/useViewportFit.ts` |
| **原則 5 · 隱藏的邊角控制元件** | 擴大覆蓋：TopMenu / PageNumber / SubtitleBar 三個新邊角元件全部遵循「平時隱形 / 進入互動才顯示」變體（SubtitleBar 預設顯示是例外，因為字幕屬於內容）。 | `components/{TopMenu,PageNumber,SubtitleBar}.tsx` |
| **原則 6 · 舞臺無 chrome** | 改寫為「**錄屏時無 chrome**」：錄屏模式強制隱藏 TopMenu + PageNumber；Manual 模式 hover 顯示。SubtitleBar 例外（錄屏仍顯示，由 `?subs=off` 獨立控制）。 | 各元件讀 `useAutoMode().mode` + URL flag |

調整動機：上游「整片無 chrome、無響應式」是為「乾淨錄屏一鏡到底」設計的；本 fork 把工作流從「只錄屏」擴張到「錄屏 + 互動演講 + PDF 簡報 + 對話定址」，所以必須區分「錄屏態（最乾淨）」與「互動態（給講者 + 觀者控制權）」兩個態，並讓字幕從 chrome 升格為內容。

其餘七條原則（全域性 step 計數器 / 每步獨佔整屏 / 口播節拍 = step / 內容驅動動畫 / 多點逐個揭示 / 整片同一主題 / 雙源原則）原樣保留。

---

## 新增 URL 參數

上游：`?auto=1` / `?audio=1`

本 fork 新增：
- `?fit=cover` —— Stage 切到全螢幕無黑邊（預設省略 = contain）
- `?subs=off` / `?subs=on` —— 字幕條隱藏 / 顯示
- `?recording=1` —— 強制隱藏 TopMenu + PageNumber（字幕不受影響）
- `?speed=N` —— 音訊播放速度（1 / 1.25 / 1.5 / 2）
- `?section=1` —— Auto Section 模式
- `?chapter=N&step=M` —— 深連結（self-check 與對話定址用，0-index）

---

## 新增 / 修改檔案清單

新增（templates）：
- `src/components/SubtitleBar.tsx` + `.css`
- `src/components/TopMenu.tsx` + `.css`
- `src/components/PageNumber.tsx` + `.css`
- `src/hooks/useSubtitleSettings.ts`
- `src/hooks/useViewportFit.ts`
- `src/hooks/usePauseControl.ts`
- `src/hooks/usePdfExport.ts`
- `src/hooks/usePlaybackRate.ts`
- `src/styles/print.css`
- `scripts/visual-self-check.ts`

修改（templates）：
- `src/components/Stage.tsx` —— 改用 `useViewportFit` 取代 `useStageScale`（後者保留未刪）
- `src/hooks/useAutoMode.ts` —— 加入 `section` 模式 + `M` 鍵循環擴充
- `src/hooks/useStepper.ts` —— 支援 `?chapter=N&step=M` 深連結
- `src/App.tsx` —— 掛載新元件、新 hook
- `scripts/scaffold.sh` —— 拷新增檔案、`npm install playwright`、寫入 `self-check` script

未動：所有主題 (`themes/*`)、`useStageScale.ts`、`useAudioPlayer.ts`、`extract-narrations.ts`、`synthesize-audio.sh`、章節資料結構 (`narrations: string[]`)。

---

## 預設音訊管線

上游：MiniMax `mmx-cli`。

本 fork：預設改為本機 IndexTTS2（GPU 跑、無 API 費用）；偵測不到 `indextts2-tts` 命令時退到 `mmx-cli`；兩者都沒有則互動詢問使用者選哪一個。具體流程見 `.claude/skills/web-video-v2/references/AUDIO.md`。

---

## 持久化 schema

兩個 localStorage key 由本 fork 引入並承諾穩定：
- `presentation-subtitle-enabled-v2` —— 字幕條 enabled 狀態
- `wv-speed-v1` —— 播放速度

如要重整 stepper 持久化遊標（例如章節數量大改），上游既有的 `useStepper.ts` 內 `STORAGE_KEY` bump 規則仍然適用。
