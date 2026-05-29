---
name: web-video-v2
description: 把一篇文章或口播稿，做成"看起來像影片"的點選驅動 16:9 網頁演示，可選合成口播音訊。內建 6 項能力：**底部字幕條**（顯示當前 step 的口播文字，講什麼語言就顯示什麼）、**頂部 hover 功能表**（重新開始 / 暫停 / 播放 / 自動播放本段 / 全自動 / 1× 1.25× 1.5× 2× 速度切換 + PDF 下載）、**一鍵匯出 PDF 簡報**（一頁一個 step）、**右下角頁碼**（用於對話定址，例如「重寫 2.3」就重寫第 2 章第 3 步）、**可選全螢幕無黑邊**（opt-in `?fit=cover`；預設 contain 行為，保比例 + letterbox 黑邊，任何 viewport 下都不裁切）、**自動排版自檢**（Playwright 巡所有 step，量字級、查溢出，產出 self-check 報告）。流程：原始文章 → **一次產出**口播稿 + outline 開發計劃 → 使用者**一次對齊** 5 件事（稿子 / outline / 主題 / 素材 / 開發模式）→ 網頁開發（逐章 / 順序 / 並行）→ 可選音訊合成（預設本機 IndexTTS2，未裝退到 MiniMax CLI mmx-cli）。**outline 只規劃節奏與資訊密度，不規劃動畫** —— 動畫由章節開發時按 PRINCIPLES + ANTI-AI 法則即時設計。每次點選推進口播稿的一個節拍，每一步獨佔整屏；字幕條、頂部功能表、頁碼皆遵循「平時隱形 / 進入互動才顯示」變體，錄屏時可由 `?recording=1` 強制隱藏 chrome（字幕條由 `?subs=off` 獨立控制）。適用場景：用網頁做影片（動態 PPT 但不像 PPT）、把口播稿 / 文章變成可互動的解說、為 B 站 / YouTube / 影片號錄屏教程、做有電影感的產品 / talk demo。本 Skill 沉澱的是設計方法論 + 協作流程 —— 不繫結任何特定樣式 / 字型 / 顏色 —— 因此能複用到任意主題與美學。
---

# Web Video Presentation

把一篇文章或口播稿，一步步做成可錄屏的"偽裝成影片的網頁"，可選合成
口播音訊。產出物 = Vite + React + TS 專案 + 按章節切分的音訊。

## 適用場景

- "我有口播稿 / 一篇文章，幫我做成影片" —— 口播驅動的內容
- 想做 "動態 PPT"
- 16:9 橫屏錄屏，大字、留白、每屏都要有動效
- 教學 / 產品演示 / keynote 想要電影感
- B 站 / YouTube /抖音影片內容

本 Skill **以方法論 + 協作流程為核心**。腳手架模板提供 token 和原語，
但每個美學決策（配色、字型、動效氣質）都應該針對你的主題重新設計 ——
不要照搬。

---

## 6 大內建能力總覽

腳手架預先掛載了 6 項能力，寫章節時通常不需要碰它們的程式碼，但要知道它們存在、以便在合適時機向使用者展示。**URL 參數總清單**見 [`references/URL-PARAMS.md`](references/URL-PARAMS.md)；**章節作者要遵守的落地細則**見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)；**原則 1 / 5 / 6 的「Manual / 錄屏雙態」設計**見下文「原則 1 / 5 / 6 細則」段。

| # | 能力 | 一句話 | 控制方式 |
|---|---|---|---|
| 1 | **底部字幕條 SubtitleBar** | 直接顯示當前 step 的 `narrations[step]` 文字。**使用者寫什麼語言就顯示什麼語言，本 Skill 不做語言切換 UI**。 | 鍵盤 `S` 整體開關；`?subs=off` 強制隱藏；**預設顯示，錄屏模式也顯示**（字幕屬於成片內容） |
| 2 | **頂部 hover 功能表 TopMenu** | 六個按鈕 Restart / Pause / Play / Auto Section / Auto All / 速度切換（1× → 1.25× → 1.5× → 2×）+ 一個 PDF 下載入口。Auto Section = 自動播到本章最後一步就停，Auto All = 既有 `?auto=1` 行為。速度切換只動 `audio.playbackRate`（章節 CSS 動畫保留作者寫的時長）；Manual 模式按鈕 disabled。 | 滑鼠進入頂部 5vh 200ms 漸顯；`?recording=1` 強制隱藏（其他模式都靠 hover 顯示） |
| 3 | **一鍵匯出 PDF 簡報** | 點 TopMenu 的 Download PDF → 系統 print 對話框 → 存成 PDF。**一頁 = 一個 step**，A4 橫向、16:9 排版、含字幕、無 chrome。 | TopMenu 入口；底層走 `window.print()` + `styles/print.css` |
| 4 | **右下角頁碼 PageNumber + 對話定址** | 顯示 `{chapterIdx+1}.{step+1}`，例：第 2 章第 3 步 = `2.3`。使用者可用此編碼**對話定址**：「重寫 2.3」= 重寫第 2 章第 3 步。 | hover Stage 任意處 200ms 漸顯；Auto / `?recording=1` 強制隱藏；用法見下文「Phase 2 · 對話定址」 |
| 5 | **可選全螢幕無黑邊（Fit 模式）** | Stage 預設 `contain` fit（保比例 + letterbox，任何 viewport 都不裁切）；加 `?fit=cover` 才切到 cover 模式（填滿 viewport，對稱裁切兩側 / 上下，無黑邊）。 | URL `?fit=cover` 切 cover；省略 / `?fit=contain` 都是 contain。**cover 模式下**章節作者必須遵守「**安全區**」（核心視覺集中在中央 1600×900 內）；contain 預設下無此約束 |
| 6 | **自動排版自檢 self-check** | Playwright 腳本巡所有 (chapter, step) 組合：截圖、量主視覺字級、查文字溢出、驗 PageNumber / SubtitleBar 位置與內容，產出 `self-check-report.html`。 | `npm run self-check`；< 16px = **紅線必修**、< 24px = 警告；**每章完工自檢必跑**（CHAPTER-CRAFT.md「完工自檢」） |

> 這 6 大能力作為「演講 / 錄屏 / 對話 / 自檢」四個維度的工具，貼附在 Phase 1 內容編寫 / Phase 2 章節開發 / Phase 3 音訊合成 / Phase 4 錄屏的整條工作流之上 —— 章節資料結構（`narrations: string[]`）、音訊合成管線、Auto 模式錄屏路徑都不變。

---

## 工作流總覽

```
Phase 1   內容編寫
   1.1  識別使用者輸入
   1.2  一次產出 script.md + outline.md
        （口播稿 + 開發計劃）
   ▼
[Checkpoint Plan]      ← 必須停。一次對齊 5 件事：
                         稿子 / outline / 主題 / 素材 / 開發模式
   ▼
Phase 2   網頁開發
   2.1  腳手架（按選定主題）
   2.2  第 1 章 = 主執行緒 + 完整版本（強制 anchor）
        ▼
        [硬節點] 使用者驗收第 1 章 ← 不可跳過
        ▼
   2.3  第 2~N 章（按選定模式：A 逐章 / B 順序 / C 並行）
   ▼
[Checkpoint Audio]     ← 必須停。是否合成音訊
   ▼
Phase 3   音訊合成（可選）
   ▼
Phase 4   錄屏 + 後期
```

工作目錄約定（agent 在使用者當前目錄下建立 / 編輯）：

```
my-video/
├── article.md          # 使用者給原文時必有 —— 不刪！開發階段畫面資訊源
├── script.md           # 必有：B 站風格口播稿（決定節拍）
├── outline.md          # 必有：開發計劃（章節切分 + 每步內容 + 資訊池）
└── presentation/       # 腳手架產出的 Vite + React + TS 專案
    ├── src/chapters/<NN>-<id>/
    │   ├── <Chapter>.tsx     # 視覺實現
    │   ├── <Chapter>.css
    │   └── narrations.ts     # ★ step 數 + 口播文字的唯一真相源
    ├── scripts/
    │   ├── extract-narrations.ts   # 掃所有 narrations.ts → audio-segments.json
    │   └── synthesize-audio.sh     # 調 mmx 合成 mp3
    ├── audio-segments.json         # extract 產出（合成前 review）
    └── public/audio/<id>/<N>.mp3   # 可選：合成的音訊
```

> **關鍵**：`narrations.ts` 是 step 數和音訊合成的**唯一真相源**。
> 章節 `.tsx` 裡的 `if (step === N)` 出現的最大 N + 1 必須等於
> `narrations.length`。這保證 5 處地方（script / outline / 章節程式碼 /
> chapters.ts / 音訊檔案）永遠不會漂。

---

## 硬性自檢協議（貫穿整個 Skill）

下面三個產出，每一個**完成後必須走自檢 → 修復 → 再彙報 / 推進**：

| 產出 | 自檢清單出處 |
|---|---|
| `script.md` | [`SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) 三層自檢（形式 / 風骨 / 念出來） |
| `outline.md` | [`OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) 自檢 |
| 單章實現完成 | [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 完工自檢 |

**執行方式**（按能力降級，**優先用更隔離的方式**）：

1. **Agent Teams（最優）**：開一個獨立的 reviewer agent，給它"產出檔案
   路徑 + 對應清單 + 關鍵上下文"，讓它逐項核查並**嚴格彙報結論**
   （哪幾條 pass / 哪幾條 fail + 證據 + 改寫建議）。
2. **subAgent（次優）**：沒有 Teams 能力但能開 subagent 就用 subagent
   走同樣流程。
3. **自檢（兜底）**：當前 agent 都沒有上述能力，就自己**嚴格逐項**
   核查 —— 不允許目測一遍就放行。

**鐵律**：拿到結論後**先按 fail 項把產出改完**，再向使用者彙報"做完了
+ 自檢結論 + 改了什麼"。**直接拿原始結論彙報但不修復 = 違規**。

---

## 各階段檔案讀取指南

不同階段讀不同的檔案。**長會話裡 agent 容易遺忘原則**，特別是
Phase 2.4 的"實現單章"會重複 N 次 —— 每次都要回看核心約束。

| 階段 | 必讀（每次都看） | 一次性看完 / 按需查 |
|---|---|---|
| Phase 1.1-1.2 內容編寫 | `references/SCRIPT-STYLE.md` + `references/OUTLINE-FORMAT.md` + `article.md`（使用者原文，如有） | —— |
| **Checkpoint Plan 選主題** | —— | `themes/*/theme.json`（動態讀全部，列清單 + `bestFor` 推薦 + `descriptionZh`）；`references/THEMES.md`（使用者想了解主題系統時） |
| Phase 2.1 腳手架 | —— | SKILL.md 本節看一次 |
| **Phase 2.4 實現單章（×N 次，被 2.2 / 2.3 呼叫）** | **`references/CHAPTER-CRAFT.md`** 單一入口 —— 十條原則 / 開工 5 問 / 關係→動作決策樹 / 視覺工具箱 / 時長參考 / 反 AI 味反模式 / 程式碼硬規則（**含 narrations.ts 強制約束**）/ 完工自檢 + 當前主題的 `themes/<id>/theme.json` + 當前章節的 outline.md 段落 + **`article.md` 本章對應段落** + 素材清單 | `references/EXAMPLES/`（結構示意，不是抄襲模板）；`references/THEMES.md` 完整 token 契約 |
| Phase 3 音訊合成 | `references/AUDIO.md`（含 narrations.ts → segments.json → mmx 流程） | —— |
| Phase 4 錄屏 + 後期 | `references/RECORDING.md`（含 `?auto=1` 自動錄屏） | —— |
| 選 / 造 / 切主題 | —— | `references/THEMES.md` |

> **寫章節時只讀一份 `CHAPTER-CRAFT.md`**。十條原則 / 開工 self-prompting /
> 決策樹 / 反 AI 味反模式 / 完工自檢全部併入這一份單一入口。`EXAMPLES/`
> **不是必讀** —— 先按內容自由設計，卡殼才翻（按 anchor 翻"形"，不要照搬）。
> `CHAPTER-CRAFT.md` 也是頁碼定址規則、字幕條約定、安全區 1600×900、self-check 紅線等
> 章節作者落地細則的單一真相源。

---

## Phase 1 —— 內容編寫（一次產出）

### 1.1 識別使用者輸入

| 使用者給的東西 | 該做的 |
|---|---|
| 原始文章（書面語 / 公眾號 / 論文 / 部落格） | 一次產出 `script.md` + `outline.md`（1.2），過 Checkpoint Plan |
| 直接的口播稿 / 影片指令碼 | 落盤成 `script.md`，一次產出 `outline.md`（1.2 簡化版），過 Checkpoint Plan |
| 啥都沒有，只說"幫我做個 X 主題的影片" | **反問**：先給一段素材或大綱。Skill 不替使用者構思內容 |

### 1.2 一次產出 script.md + outline.md

**兩份產出物在一次思考中完成**：

1. **生成 `script.md`**：按 [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md)
   的規則把 article 轉 B 站風口播稿。**保留 `article.md` 不刪**——它是
   outline 寫資訊池和章節實現畫面時的細節源（雙源原則）。
2. **生成 `outline.md`**：按 [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md)
   規則切章節 + 切 step + 每章首段抽**資訊池**。

**outline 的邊界**（關鍵）：

| outline 必須寫 | outline 不要寫 |
|---|---|
| 章節切分 / 每章 step 數 / 估時 | 具體動畫型別（blur clear / wipe / 彈簧） |
| 每步螢幕內容（hero / 資料 / 標語 / 列表項） | CSS 實現手段（filter / SVG / clip-path） |
| 章節級**資訊池**：從 article 抽的數字 / 引用 / 案例 / 標籤 | 時長數值（不寫 ~2.5s / 80~120ms） |
| 步級關係名字首（"反差對照" / "遞進列表" / "金句" 等可選 hint） | 持續微動 / 錯峰量等微觀節奏 |

> **outline 不寫動畫的理由**：寫死動畫 = chapter agent 退化為翻譯機；
> 留白讓 chapter agent 在每步開工時按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
> 的"內容驅動決策樹"自由設計，才有真正的影片感。詳見
> [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) Part 0 原則 7。

**落盤後必須先走自檢再進 Checkpoint Plan**：按上文「硬性自檢協議」分別
對 `script.md` / `outline.md` 執行（優先 Agent Teams → subAgent → 自檢），
按結論修復完成後再進入 Checkpoint Plan。

---

## Checkpoint Plan —— 5 件事一次對齊（**硬節點**）

`script.md` + `outline.md` 寫完後必須停下來。**使用者在這一個節點同時確認
5 件事**。

### agent 此時要做的預備工作

1. 讀所有 `themes/*/theme.json` 拿 `nameZh` / `descriptionZh` / `bestFor`
   / `mood` —— **不要硬編碼清單**
2. 根據 `script.md` 的內容型別 / 關鍵詞 / 語氣，**主動**從主題裡挑 2~3
   套**最匹配的推薦**（匹配 `bestFor` 欄位）
3. 掃一遍 `outline.md` 末尾"素材清單"部分

### 總結模板（骨架，agent 按情況填充）

```
內容計劃寫完，產出檔案：
  📄 article.md     {若使用者給原文則保留}
  📄 script.md      {X} 字 / ~{T} 分鐘
  📄 outline.md     {N} 章 / {M} 步 + 每章資訊池 + 末尾素材清單

章節速覽：
  1. <id>     <章節標題>    <S> 步 ~<T>s
  2. ...

接下來一次對齊 5 件事：

  1. 稿子 (script.md) 要不要改？
     可以直接編輯檔案，或口頭告訴我修改方向。

  2. 開發計劃 (outline.md) 要不要改？重點看：
     - 章節切分 / step 數 / 估時是否合理（合理判斷：每章 30~60s）
     - 每步螢幕內容是否清晰
     - 每章首段「資訊池」是否有足夠的 article 細節供畫面掛
     - 末尾素材清單是否完整

  3. 選哪個主題？我的推薦：
     ★ <推薦 1：nameZh (id)> — 因為 <bestFor 命中>；<descriptionZh 摘要>
     ★ <推薦 2 / 推薦 3>
     其它可選：<剩餘主題，nameZh + 一句話>
     也可以讓我幫你做新主題（詳見 references/THEMES.md）。

  4. 真素材怎麼準備？粗看本影片要的圖：<列粗略清單>
     a) 我從 <現有素材路徑> 幫你挑   b) 你自己提供   c) 全部 placeholder

  5. 開發模式選哪個？

     **第 1 章無論哪種模式都必須主執行緒做完 + 使用者驗收**（強制 anchor）。
     差異在第 2 章及之後：

     A) 預設 · 逐章確認（推薦）
        每章做完都暫停驗收 → 風險可控 / 節奏最穩
     B) 第 1 章後順序開發（不併行）
        第 2~N 章主執行緒順序做完後統一驗收 → 速度中 / 適合 agent 不支援並行
     C) 第 1 章後並行開發（subagent）
        第 2~N 章用 subagent 並行 → 最快 / 使用者控並行數（一次幾章）
        ⚠️ 風格各章會有差異（這是預期，主題禁區兜底）
```

收到反饋後：
- 稿子 / outline 要改：直接編輯檔案，編輯完 ping 一次（或口頭描述 agent 改）
- **主題必須明確**才進入 Phase 2。使用者說"主題你幫我選" → 取你推薦的第 1 個，
  **告訴使用者你選了什麼、為什麼**，給反悔機會
- 模式選定 → 進 Phase 2

---

## Phase 2 —— 網頁開發

### 2.1 腳手架

```bash
bash <path-to-web-video-v2>/scripts/scaffold.sh \
  ./presentation \
  --theme=<使用者選的主題 id>

bash <path-to-web-video-v2>/scripts/scaffold.sh --list-themes
```

> 自定義主題 → 先按 [`references/THEMES.md`](references/THEMES.md)
> "創作新主題"流程做一個 `themes/<my-theme>/`，再 `--theme=<my-theme>`。

腳手架帶一個 `01-example` demo。在寫第一章真實內容前**刪掉**：

```bash
rm -rf presentation/src/chapters/01-example
```

並把 `presentation/src/registry/chapters.ts` 裡 `EXAMPLE_CHAPTER`
的 import 和陣列項移除。

### 2.2 第 1 章 —— 主執行緒 + 強制驗收

**核心**：第 1 章 = 完整版本一次到位（節奏 + 視覺 + 真素材齊全）。
**沒有"骨架版"概念** —— 第一章就要做出**使用者能直接驗收**的樣板。

為什麼第 1 章必須主執行緒：

- 它是 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 這套指引在**當前
  主題 + 當前題材**下的第一次落地
- 如果指引有盲區 / 主題顏色 / 字型 token 不夠用，第 1 章一定會暴露 ——
  這時候有人類反饋就能修指引 / 調主題，**早改成本最低**
- 後續章節（無論順序 / 並行）都要參考第 1 章的程式碼模式，所以第 1 章 =
  當次專案的"風格錨點（不強求章節間一致，但單章自身得有完整說服力）"

**做完第 1 章後必須停下來**等使用者驗收：

```
第 1 章 <id> 做完了，dev server 在 localhost:5173 執行。

驗收重點：
  □ 視覺氣質對不對？符合 <theme nameZh> 的預期嗎？
  □ 節奏對不對？某些步太快 / 太慢 / 資訊太薄？
  □ 內容驅動動畫是否到位？還是有幾步是無腦入場動畫？
  □ 雙源原則：螢幕畫面有沒有"口播沒念但 article 能掛"的細節？
  □ 反 AI 味檢查：紫粉漸變 / 圓角彩色邊框 / 假插畫 / emoji 是否有？

問題告訴我，我針對性改。OK 了告訴我"繼續"，我按選定模式做第 2 章及之後。
```

### 2.3 第 2~N 章 —— 按選定模式

**所有模式下的共同規則**：每章獨立按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
開發。**風格不強求章節間完全一致** —— 主題顏色 / 字型 token 兜底視覺
統一，動畫 / 節奏 / 視覺演示由章節自由發揮是設計預期。

#### 模式 A · 預設 · 逐章確認

第 2 章做完 → 暫停驗收 → OK → 第 3 章 → 暫停 → ... → 第 N 章。**每章
獨立驗收**，問題隨時改，**風險最低，節奏最穩**。**使用者不明確選模式時
預設走這個**。

#### 模式 B · 第 1 章後順序開發

第 2 章 → 第 3 章 → ... → 第 N 章 **主執行緒順序做完，最後統一驗收**。
速度中等，適合 agent 不支援並行任務的環境。

#### 模式 C · 第 1 章後並行開發（subagent）

用 subagent 把第 2~N 章並行做完，最大並行數由使用者控制（"一次 4 章"
/ "一次 2 章"）。**最快，但風格各章會有差異** —— 這是預期，因為：

1. 每個 subagent 看不到別的 subagent 產出，無法機械對齊
2. 章節程式碼物理分離（每章一個資料夾 / 自己的 CSS 字首），不會互相
   破壞
3. 主題 token 兜底視覺統一（顏色 / 字型 / hero 數字 / 卡片 / 分割線
   性格 / 裝飾），氣質不會跑偏
4. **風格不一致 = 人手寫影片的呼吸感**（多 voice / 多視角）

並行 subagent 的 prompt 必須包含：

- 當前章節 outline 段落（含資訊池）
- `references/CHAPTER-CRAFT.md` 的路徑（**單一必讀** —— 視覺演示要求 +
  逐步揭示 + 雙源原則 + 反 AI 味 + 程式碼紅線 + 完工自檢全部在這一份裡）
- 當前主題 `theme.json` 的 `descriptionZh` / `mood` / `bestFor`（參考氣質
  即可，動畫 / 時長 / 字號 / emoji 由 chapter agent 自由決定）
- **第 1 章程式碼作為"程式碼風格"參考**（不是"視覺抄襲物件"）
- 硬規則：每章獨立 CSS 字首（`.cd-` / `.mg-` / `.pm-` / ...）；
  不修改 `chapters.ts`；完工跑 `npx tsc --noEmit`

**重要**：無論選哪種模式，**使用者隨時可以中途切換模式**。第 2 章 OK
後使用者說"剩下的並行" / "剩下的逐章" 都行。

### 2.4 實現單章（每章必走）

詳細指引見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) ——
**單一必讀入口**，覆蓋：視覺演示要求 / 逐步揭示 / 內容取捨 / 雙源原則
/ 影片演示基本審美 / 反 AI 味 / 程式碼紅線 / 完工自檢。

**核心要點**（CHAPTER-CRAFT.md 詳述）：

- **每章必須有 CSS / SVG / Canvas / JS 視覺演示**，禁純文字章節
- **逐步揭示**：清單 / 列表必須 1 項 = 1 step，禁一次全展示
- **雙源原則**：節奏跟口播稿（順序不能亂），細節回原文章抽（資訊池 +
  本章 article 段落）
- **完工自檢逐項過**，不達標回去改 —— 按上文「硬性自檢協議」執行
  （優先 Agent Teams → subAgent → 自檢），**改完再向使用者彙報本章交付**
- **完工自檢含 self-check**：在 `presentation/` 目錄跑 `npm run self-check`，
  確認無紅線級警告（< 16px / 文字溢出 stage）。詳見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
  的「完工自檢」段以及下文「對話定址」段所配的 self-check 流程。

### 2.4.5 對話定址 —— 用頁碼點名修改

第 1 章驗收後（無論選定哪種模式），使用者隨時可以用 **`{chapter}.{step}`** 編碼指向任一頁要求修改，例如：

| 使用者說 | agent 對應動作 |
|---|---|
| 「重寫 **2.3** 的視覺」 | 開啟 `src/chapters/02-<id>/Chapter.tsx`，找到 `if (step === 2) return ...` 那一支，重做這一步視覺；**順手檢查同章 `narrations[2]` 是否仍與新視覺對齊** |
| 「把 **3.1** 的口播改短一點」 | 改 `src/chapters/03-<id>/narrations.ts` 的 `[0]` 項；若該 step 的動畫時長因此超出口播時長，**也要同步調短動畫**（Auto 模式不等動畫） |
| 「**1.4** 字幕在底部蓋住了內容」 | 開 `src/chapters/01-<id>/Chapter.tsx` 看 step 3 的版面，把底部視覺往上推 / 留出 8vh 字幕條空間 |

頁碼定址規則由腳手架內建的 PageNumber 元件保證：使用者 hover Stage 任一處即可看到右下「`2.3`」這種編碼，**對話前不需要 agent 解釋編碼系統**。詳細語法見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 的「頁碼定址規則」段。

> **頁碼從 1 起算（人類視角）**，內部 `chapterIdx` / `step` 仍從 0 起算（程式碼視角）。`2.3` 對應 `chapters[1]` 的 `step === 2` —— **agent 寫程式碼時記得扣 1**。

### 2.5 大改後 bump STORAGE_KEY

改動 `chapters.ts`（增加 / 刪除 / 重排章節，或某章 `narrations.ts`
長度變化）後，**bump** `presentation/src/hooks/useStepper.ts` 的
`STORAGE_KEY`（如 `v4` → `v5`），避免持久化遊標落到不存在的 step 上。

---

## Checkpoint Audio —— 是否合成音訊（**硬節點**）

Phase 2 結束後必須停下來，問使用者：

```
網頁做完，{N} 章 {M} 步，dev server 在 localhost:5173 跑著。

要不要合成音訊做"自動播放錄屏"？
  ✓ 合成 → 掃所有章節的 narrations.ts 出 audio-segments.json，
           預設用本機 IndexTTS2 合成（GPU 跑、無 API 費用）；
           沒裝 indextts2-tts 會退到 MiniMax mmx-cli；兩個都沒裝會問你
           用什麼 TTS。輸出每步一個 mp3 到 public/audio/。
           合成完後用 ?auto=1 模式可以一鏡到底錄屏（音影片天然同步）。
  ✗ 不合成 → 跳過 Phase 3，直接 Phase 4 用手動錄屏 + 後期配音。
```

要合成 → Phase 3。不合成 → 直接 Phase 4。

---

## Phase 3 —— 音訊合成（可選）

詳細流程見 [`references/AUDIO.md`](references/AUDIO.md)。簡版：

```bash
cd presentation
npm run extract-narrations   # 掃所有 narrations.ts → audio-segments.json
# 讓使用者掃一眼 audio-segments.json 確認文字對
npm run synthesize-audio     # 調 mmx 序列合成；增量、跳過已存在
```

合成完告訴使用者：輸出位置 / 總段數 / 哪些段時長異常（太長 = 該 step 拆
分；太短 = 文案太薄）—— 給最後一次校準節奏的機會。然後進入 Phase 4。

---

## Phase 4 —— 錄屏 + 後期

詳見 [`references/RECORDING.md`](references/RECORDING.md)。兩種路徑：

| 場景 | 推薦路徑 |
|---|---|
| Phase 3 已合成音訊 | **Auto 模式一鏡到底**：瀏覽器開 `localhost:5173/?auto=1` → 按 SPACE → 整片自動播完 → 停錄 → 裁頭尾即成片，**無需後期對音軌** |
| Phase 3 跳過 | 預設 Manual 模式手動點選推進 → 後期任意剪輯工具配音 |

> agent 在 Phase 3 / Checkpoint Audio 後**主動告訴使用者**適合的錄屏路徑。

---

## 十條原則（一句話清單）

完整展開見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 0 —— **寫章節時回那裡查**，下面只是索引。

| # | 原則 | 一句話 |
|---|---|---|
| 1 | 16:9 固定舞臺 | 內容 1920×1080 + transform scale，沒有響應式 |
| 2 | 全域性 step 計數器 | 章節是 step 的純函式，無定時器 |
| 3 | 每步獨佔整屏 | `if (step === N) return <FullScene />` |
| 4 | 口播節拍 = step | 一節拍 = 一 step = 一聚焦想法 |
| 5 | 隱藏的邊角控制元件 | 進度條 / 翻頁器預設 opacity 0 |
| 6 | 舞臺無 chrome | 沒有 header / footer / 頁碼 / 品牌條 |
| 7 | **內容驅動動畫** | 先找內在動作，找不到才入場動畫兜底；持續微動慎用 |
| 8 | 多點逐個揭示 | 1 項 = 1 step，禁同步 stagger 上 N 項 |
| 9 | 整片同一主題 | 章節間不翻表面色；**顏色 / 字型走 token**，其它尺度章節自由 |
| 10 | 雙源原則 | script 定節拍，**article 定畫面密度**（落到資訊池） |

---

## 原則 1 / 5 / 6 細則（Manual / 錄屏雙態 + 全螢幕無黑邊）

十條原則中的 1（16:9 固定舞臺）/ 5（隱藏的邊角控制元件）/ 6（舞臺無 chrome）有額外規格 —— 因為本 Skill 同時支援「錄屏（最乾淨）」與「互動演講 + PDF 簡報 + 對話定址（給講者 + 觀者控制權）」兩種使用態。**寫章節時遇到原則 1 / 5 / 6 一律以本節為準**，CHAPTER-CRAFT.md「框架已經搭好的部分」段的對應條目也已同步並反向交叉引用本節。

| 原則 | 細則 | 落地位置 |
|---|---|---|
| **原則 1 · 16:9 固定舞臺** | 內容**仍**在 1920×1080 設計，**動畫 / 字級 / 留白照舊**。Stage 外層有 `fit` 策略：**預設 `contain`**（保比例 + letterbox 黑邊，任何 viewport 下都不裁切）；`?fit=cover` opt-in 切到全螢幕無黑邊模式（內容填滿 viewport，必要時對稱裁切兩側 / 上下）。章節作者依然只寫 1920×1080，**不需要處理響應式**。**僅當使用者選用 `?fit=cover`** 時才需要遵守「**安全區**」—— 核心視覺集中在中央 1600×900 內，超出區只放裝飾性元素；contain 預設下無此約束。 | `components/Stage.tsx` + `hooks/useViewportFit.ts` |
| **原則 5 · 隱藏的邊角控制元件** | 三個邊角元件 **TopMenu / PageNumber / SubtitleBar** 全部遵循「**平時隱形 / 進入互動才顯示**」變體：TopMenu 進入頂部 5vh hover 區後 200ms 漸顯、離開 600ms 漸隱；PageNumber 滑鼠進入 Stage 任意處 200ms 漸顯、離開 600ms 漸隱；SubtitleBar 可整體開關（鍵盤 `S` / URL `?subs=off`）但**預設顯示**——因為字幕本身就是錄屏要保留的內容。 | `components/{TopMenu,PageNumber,SubtitleBar}.tsx` |
| **原則 6 · 舞臺無 chrome** | 精確規格是「**錄屏時無 chrome**」。`mode === 'auto' \| 'section'` 或 `?recording=1` 時**強制隱藏** TopMenu + PageNumber；Manual 模式下這些可 hover 顯示。**SubtitleBar 例外**：錄屏模式預設仍顯示（字幕屬於成片內容），只有 `?subs=off` 或使用者按 `S` 才隱藏。 | 各元件讀 `useAutoMode().mode` + URL flag |

**設計動機**：「整片無 chrome、無響應式」適合「乾淨錄屏一鏡到底」單一情境；本 Skill 把使用情境擴張到「錄屏 + 互動演講 + PDF 簡報 + 對話定址」之後，必須區分「錄屏態（最乾淨）」與「互動態（給講者 + 觀者控制權）」兩個態，並讓字幕從 chrome 升格為內容。URL 參數總清單見 [`references/URL-PARAMS.md`](references/URL-PARAMS.md)。

---

## 常見使用者反饋速查

簡化表見 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 8「常見反饋速查」。**關鍵**：先定位是哪一層（節奏 / 視覺 / 內容
/ 程式碼），再改最小切片，**不要重做整章**。

---

## 相關資源

按"何時讀"標註，避免一次性全讀：

| 檔案 | 何時讀 | 內容 |
|---|---|---|
| [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) | Phase 1.2 必讀 | 文章 → 口播稿規則、平臺變體 |
| [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) | Phase 1.2 必讀 | outline.md 欄位 spec、命名約定、章節切分、資訊池 |
| [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) | **Phase 2.4 每章單一必讀入口** | 十條原則 / 開工 5 問 / 關係→動作決策樹 / 視覺工具箱 / 時長 / 反 AI 味反模式 / 程式碼硬規則 / 頁碼定址 / 字幕條約定 / 安全區 / self-check 紅線 / 完工自檢 |
| [`references/URL-PARAMS.md`](references/URL-PARAMS.md) | 錄屏、調試、深連結時 | 全部 URL 參數總表（`?auto=1` / `?fit=contain` / `?subs=off` / `?recording=1` / `?chapter=N&step=M`） |
| [`references/EXAMPLES/`](references/EXAMPLES/) | **可選** —— 看結構 | 章節結構示意（hook / list-reveal / case-tech-review）；**不是抄襲模板** |
| [`references/THEMES.md`](references/THEMES.md) | 選 / 造 / 切主題時 | 完整 token 契約 + 內建主題清單 + 創作流程 |
| [`references/AUDIO.md`](references/AUDIO.md) | Phase 3 才讀 | MiniMax CLI、TTS 退化路徑、故障排查 |
| [`references/RECORDING.md`](references/RECORDING.md) | Phase 4 才讀 | 錄屏工具 + 後期合成 |
| [`themes/`](themes) | Checkpoint Plan / Phase 1.2 時翻 | 內建主題（每個含 `theme.json` + `tokens.css`） |
| [`scripts/scaffold.sh`](scripts/scaffold.sh) | Phase 2.1 跑一次 | 一鍵專案腳手架 |
