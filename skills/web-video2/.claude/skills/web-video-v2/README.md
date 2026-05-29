# Web Video Presentation Skill

**把文章或口播稿做成點選驅動的 16:9 網頁演示，並透過錄屏產出有電影感影片的 Agent Skill。內建字幕條、頂部功能表、PDF 匯出、頁碼對話定址、可選全螢幕無黑邊、自動排版自檢六項能力。**

---

## 這是什麼？

這個 Skill 幫 Agent 構建一種 Vite + React + TypeScript 演示：它看起來不是傳統幻燈片，而更像為錄屏設計的影片舞臺。每次點選推進一個口播節拍，每一步獨佔 1920×1080 舞臺，進度 UI 平時隱藏，只有懸浮時出現，方便錄出乾淨畫面。

三件事是它設計的核心：

1. **錄屏時最乾淨**：cover fit 可選無黑邊；錄屏模式 (`?recording=1`) 強制隱藏 chrome；字幕條獨立 (`?subs=off`) 可控。
2. **講者體驗完整**：頂部 hover 功能表給出 Restart / Pause / Play / Auto Section / Auto All + 速度切換 + PDF 下載；右下頁碼方便「重寫 2.3」這種對話定址。
3. **品質有兜底**：`npm run self-check` 用 Playwright 巡所有 step，量字級、查溢出、產報告。

它適合：

- 把文章改寫成 B 站 / YouTube / 影片號風格口播稿
- 把已有口播稿做成有節奏的網頁演示
- 做產品演示、教程、keynote 式講解、視覺 talk
- 做「動態 PPT，但不要像 PPT」的演示體驗
- 需要一份 PDF 簡報版本與影片版本並存
- 在視覺 outline 對齊後，可選合成口播音訊

這個 Skill 的核心是**方法論 + 協作流程**。腳手架提供 token、舞臺原語、主題和示例，但每個專案仍然應該根據主題重新選擇視覺語言。

---

## 6 大內建能力

| # | 能力 | 一句話 | 控制方式 |
|---|---|---|---|
| 1 | **底部字幕條** | 顯示當前 step 的 `narrations[step]` —— 講什麼語言就顯示什麼，不做語言切換 UI | `S` 鍵開關、`?subs=off` 隱藏；**預設顯示，錄屏模式也顯示** |
| 2 | **頂部 hover 功能表** | 滑鼠進入頂部 5% 區 200ms 漸顯；六個按鈕 Restart / Pause / Play / Auto Section / Auto All + 速度切換 + PDF 下載入口 | Manual 模式 hover 顯示；Auto / Section / `?recording=1` 隱藏 |
| 3 | **一鍵匯出 PDF 簡報** | 一頁 = 一個 step，A4 橫向，16:9 排版，含字幕、無 chrome | 頂部功能表 → Download PDF；走 `window.print()` 路徑 |
| 4 | **右下角頁碼** | `{chapterIdx+1}.{step+1}` 格式，例：`2.3` = 第 2 章第 3 步。對話定址用：「重寫 2.3」 | Manual 模式 hover Stage 200ms 漸顯；Auto / `?recording=1` 隱藏 |
| 5 | **可選全螢幕無黑邊** | 預設 contain fit（保比例 + 黑邊，任何 viewport 都不裁切）；加 `?fit=cover` opt-in 切到「填滿 viewport，必要時對稱裁切兩側 / 上下，無黑邊」 | URL 參數 `?fit=cover` 切 cover（預設省略 = contain）|
| 6 | **自動排版自檢** | Playwright 巡所有 step，量主視覺字級、查文字溢出、驗證頁碼 / 字幕條，產出 `self-check-report.html` | `npm run self-check`；< 16px = 紅線必修、< 24px = 警告 |

URL 參數對照見 [`references/URL-PARAMS.md`](references/URL-PARAMS.md)，章節作者落地細則見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)。

---

## 核心理念

- **固定 16:9 舞臺**：內容寫在穩定的 1920×1080 座標系裡，再按視口縮放。`?fit=cover` 可選全螢幕無黑邊（對稱裁切）；預設 contain（保比例 + letterbox），章節作者只在使用者選用 `?fit=cover` 時才需要把核心視覺集中在中央 1600×900 安全區內。
- **一個全域性 step 遊標**：點選或鍵盤推進 `(chapter, step)`，遊標本地持久化。
- **一步一個想法**：每個節拍獨佔整屏，不堆疊專案符號。
- **口播節拍驅動結構**：講述節奏直接對映為視覺 step；字幕條直接讀 `narrations[step]` 顯示。
- **錄屏時無 chrome / 互動時可 hover 顯示 chrome**：Auto / `?recording=1` 強制隱藏 TopMenu + PageNumber；Manual 模式 hover 顯示；字幕條由 `?subs=off` 獨立控制（錄屏時可保留）。
- **動效優先**：每一步都需要一個移動的視覺錨點，靜態正文是壞味道。
- **主題 token**：視覺屬性透過語義 token 驅動，換主題不只是換顏色。
- **硬 checkpoint**：稿子 / 主題、outline、音訊合成前都必須停下來與使用者確認。

完整十條原則 + 原則 1 / 5 / 6 細則見 [`SKILL.md`](./SKILL.md)。

---

## 工作流

```text
Phase 1.1  識別使用者輸入
Phase 1.2  文章 -> 口播稿 + outline
   |
Checkpoint Plan  5 件事一次對齊（稿子 / outline / 主題 / 素材 / 模式）
   |
Phase 2    構建 Vite / React / TS 演示
           （字幕 / TopMenu / 頁碼 / fit / PDF 元件已內建）
   |
Checkpoint Audio  詢問是否合成音訊
   |
Phase 3    可選音訊合成
Phase 4    錄屏與後期 + PDF 匯出
```

這些 checkpoint 是 Skill 契約的一部分：Agent 不應該從原文一路悶頭做到成品。

---

## 內含內容

```text
skills/web-video-v2/
├── SKILL.md
├── README.md                  ← 本檔
├── manifest.json
├── references/
│   ├── CHAPTER-CRAFT.md       ← 章節實現規則 + 頁碼定址 / 字幕條規約 / 安全區 / self-check
│   ├── URL-PARAMS.md          ← ?auto / ?fit / ?subs / ?recording / ?chapter&step / ?speed / ?section
│   ├── OUTLINE-FORMAT.md
│   ├── SCRIPT-STYLE.md
│   ├── THEMES.md
│   ├── AUDIO.md
│   └── RECORDING.md
├── scripts/
│   └── scaffold.sh
├── templates/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       │   ├── SubtitleBar.tsx
│       │   ├── TopMenu.tsx
│       │   ├── PageNumber.tsx
│       │   └── Stage.tsx          ← cover/contain fit
│       ├── hooks/
│       │   ├── useSubtitleSettings.ts
│       │   ├── useViewportFit.ts
│       │   ├── usePdfExport.ts
│       │   └── useAutoMode.ts     ← manual / audio / section / auto
│       └── styles/
│           └── print.css
└── themes/
    ├── paper-press/
    ├── warm-keynote/
    ├── midnight-press/
    ├── blueprint/
    └── ...
```

---

## 快速上手

把這個 Skill 複製到你的 Agent 會掃描的目錄，然後讓 Agent 把一篇文章或口播稿做成網頁影片演示。

手動腳手架：

```bash
bash skills/web-video-v2/scripts/scaffold.sh ./presentation --theme=paper-press
```

查看可用主題：

```bash
bash skills/web-video-v2/scripts/scaffold.sh --list-themes
```

生成的 `presentation/` 是普通 Vite + React + TypeScript 專案。啟動後：

```bash
cd presentation
npm install
npm run dev          # localhost:5173
npm run self-check   # Playwright 跑所有 step、產 self-check-report.html
```

錄屏時開 `localhost:5173/?recording=1`（TopMenu / 頁碼隱藏；字幕條仍顯示，可加 `&subs=off` 一併關）。

要 PDF：開 dev server → hover 頂部 → Download PDF → 系統 print 對話框選「儲存為 PDF」。

---

## 內建主題方向

Skill 內建多套主題，每套都有自己的設計 DNA，不只是換色：

- `paper-press`：編輯紙張、溫暖印刷質感
- `warm-keynote`：現代 keynote / talk 氣質
- `midnight-press`：深色編輯式演示
- `blueprint`：技術藍圖 / 規劃圖紙
- `chalk-garden`：課堂 / 黑板風格
- `terminal-green`：磷光終端氛圍
- `bauhaus-bold`：幾何、粗黑邊、宣言感
- `sunset-zine`：獨立 zine / 拼貼表達
- `newsroom`：報刊 / 媒體編輯臺
- `monochrome-print`：剋制的黑白印刷排版

完整 token 契約和主題說明見 [`THEMES.md`](./references/THEMES.md)。

---

## Reference Map

| 檔案 | 何時讀 |
|---|---|
| [`SKILL.md`](./SKILL.md) | 入口：工作流 + 十條原則 + 原則 1/5/6 細則 + 6 大內建能力總覽 |
| [`references/URL-PARAMS.md`](references/URL-PARAMS.md) | URL 參數總清單（`?auto` `?fit` `?subs` `?recording` `?chapter&step` `?speed` `?section`） |
| [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) | 章節實現規則 + 視覺 checklist + 安全區 / 頁碼定址 / 字幕條 / self-check 紅線 |
| [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) | outline 必須遵循的結構 |
| [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) | 文章轉口播稿規則 |
| [`references/THEMES.md`](references/THEMES.md) | 主題 token 契約 + 切換 / 創作主題 |
| [`references/AUDIO.md`](references/AUDIO.md) | 可選口播音訊合成流程（IndexTTS2 / mmx-cli） |
| [`references/RECORDING.md`](references/RECORDING.md) | 錄屏與後期注意事項 |
