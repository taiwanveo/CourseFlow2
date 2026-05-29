# Video Outline

> **主題**：`newsroom`（新聞編輯室）—— 報頭襯線字型 + 報紙米色底 + banner 紅強調，嚴肅安靜
> **總時長**：約 3 分 20 秒（口播 ~1312 字 ÷ 4 字/秒 ≈ 200s）
> **章節數**：5 章 / 33 步

---

## 1. hook — 文章能變影片？（6 steps · ~32s）

**資訊池**（chapter agent 按需掛角標 / 副標 / pull-quote / mono cue）：
- 概念：點選驅動的 16:9 網頁演示 —— 來源 article §1 / L7
- 定位：看起來像影片，實際是可互動的網頁 —— 來源 article §1 / L5
- 場景：錄屏教學、產品 demo、B 站 / YouTube 影片 —— 來源 article §1 / L7
- 對比：不是 PPT 翻頁，是有節奏有動效的影片感 —— 來源 article §1 / L5
- 輸入：文章或口播稿都可以 —— 來源 article §2 / L12

**開發計劃**：

- step 1 (~5s) — hero 大字提問：「一篇文章能變成影片？」
- step 2 (~5s) — 反差對照：PPT 翻頁（灰底否定）vs 有節奏的影片感網頁（亮底肯定）
- step 3 (~4s) — 揭示一句：「但它其實是一個網頁」
- step 4 (~6s) — 概念卡：「web-video-v2」名稱 + 一句話「文章或口播稿 → 16:9 網頁」
- step 5 (~5s) — 流程卡四格：「點一下 → 畫面推進 → 配口播 → 錄屏成片」
- step 6 (~7s) — 具體場景卡：「比如你講 React Hooks，程式碼一行行浮出來配高亮」

口播節選：
> 你有沒有想過，一篇文章能變成影片？⋯⋯這就是 web-video-v2 在做的事。你丟一篇文章或口播稿給它。它幫你做成 16:9 的網頁。

---

## 2. workflow — 四階段工作流（8 steps · ~46s）

**資訊池**：
- Phase 1 產出：script.md（口播稿）+ outline.md（開發計劃）—— 來源 article §2 / L14-15
- Phase 2 技術棧：Vite + React + TypeScript —— 來源 article §2 / L16
- Phase 3 工具：本機 IndexTTS2 / MiniMax CLI —— 來源 article §2 / L18
- Phase 4 URL 參數：?auto=1 自動播放 —— 來源 article §4 / L43
- Checkpoint：一次對齊 5 件事（稿子/outline/主題/素材/開發模式）—— 來源 article §2 / L22-28
- 第 1 章強制驗收：確認風格後才繼續 —— 來源 article §2 / L16

**開發計劃**：

- step 1 (~4s) — 過場 hero：「四個階段」+ 四段進度條 / 流程線暗示
- step 2 (~8s) — Phase 1 卡片展開：「內容編寫」+ 兩個產出物名稱（script.md / outline.md）
- step 3 (~6s) — script.md 描述卡：「B 站風口播稿・短句・口語・有鉤子」
- step 4 (~5s) — outline.md 描述卡：「開發計劃・章節切分・每步螢幕內容」
- step 5 (~7s) — Phase 2 卡片：「網頁開發」+ Vite + React + TS 標籤 +「逐章實現」
- step 6 (~5s) — 強調一句：「不是 PPT。每步佔滿全螢幕，動畫即時設計」
- step 7 (~6s) — Phase 3 卡片：「音訊合成（可選）」+ IndexTTS2 / MiniMax CLI 雙路徑
- step 8 (~5s) — Phase 4 卡片：「錄屏」+「?auto=1 自動播放」提示

口播節選：
> 整個流程分四個階段⋯⋯第一階段，內容編寫。你把文章丟給 Claude，它會一次產出兩份東西⋯⋯第二階段，網頁開發⋯⋯第三階段，音訊合成⋯⋯第四階段，錄屏。

---

## 3. checkpoint — 一次對齊五件事（5 steps · ~30s）

**資訊池**：
- 五件事清單：稿子 / 開發計劃 / 主題 / 素材 / 開發模式 —— 來源 article §2 / L22-28
- 開發模式三選項：逐章確認 / 順序開發 / 並行開發 —— 來源 article §2 / L28（隱含自 skill）
- 主題選擇：多種視覺風格可選 —— 來源 article §2 / L25
- 第 1 章驗收：確認風格再繼續 —— 來源 article §2 / L16

**開發計劃**：

- step 1 (~5s) — hero 一句：「它會停下來，問你五件事」
- step 2 (~7s) — 五項清單前兩項：稿子行不行？章節切分對不對？
- step 3 (~7s) — 五項清單中間兩項：選哪個視覺主題？有沒有素材？
- step 4 (~6s) — 五項清單最後一項：開發模式—逐章 / 順序 / 並行
- step 5 (~5s) — 收束 hero：「五件事確認完，才進入網頁開發」

口播節選：
> 然後它會停下來，問你五件事⋯⋯這五件事確認完，才進第二階段。

---

## 4. features — 六大內建功能 + URL 參數（10 steps · ~62s）

**資訊池**：
- 字幕條：顯示當前 step 口播文字 —— 來源 article §3 / L31
- 頂部功能表：hover 出現，暫停/播放/自動/速度/PDF —— 來源 article §3 / L32
- PDF 匯出：每步一頁，可當簡報 —— 來源 article §3 / L33
- 頁碼定址：2.3 = 第 2 章第 3 步 —— 來源 article §3 / L34
- Fit 模式：?fit=cover 無黑邊 / contain 保比例 —— 來源 article §3 / L35
- 自動排版自檢：Playwright 巡所有 step —— 來源 article §3 / L36
- URL 參數：?auto=1 / ?fit=cover / ?recording=1 / ?subs=off —— 來源 article §4 / L42-45
- 對話定址示例：「重寫 2.3」「2.1 的字太小」—— 來源 article §5 / L49-51

**開發計劃**：

- step 1 (~4s) — 過場 hero：「產出的網頁還自帶六項功能」
- step 2 (~7s) — 功能 1 示意：底部字幕條區域 +「念到哪步，同步顯示文字」說明
- step 3 (~7s) — 功能 2 示意：頂部控制列區域 +「hover 才出現」+ 按鈕圖示列
- step 4 (~6s) — 功能 3 示意：PDF 導出 +「每步一頁，直接變簡報」
- step 5 (~7s) — 功能 4 示意：頁碼「2.3」大字 +「跟 Claude 說重寫 2.3」對話氣泡
- step 6 (~6s) — 功能 5 示意：contain vs cover 並排對比卡（黑邊 vs 填滿）
- step 7 (~5s) — 功能 6 示意：Playwright 報告卡 +「字太小、溢出都會報」
- step 8 (~7s) — 錄屏參數卡：「?recording=1 藏控制元件」+「?subs=off 藏字幕」
- step 9 (~6s) — 對話定址三例卡：「重寫 2.3」/「2.1 的字太小」/「第 3 章太快」
- step 10 (~7s) — 收束：六功能圖示陣列 +「全部內建，不需額外設定」

口播節選：
> 底部有字幕條⋯⋯右下角有頁碼。2.3 就是第 2 章第 3 步⋯⋯錄屏的時候，加 ?recording=1 能把控制元件全藏起來。

---

## 5. closing — 適合什麼場景（4 steps · ~30s）

**資訊池**：
- 適用場景列表：技術文章→教學影片 / 產品 demo / Conference talk / 課程內容 —— 來源 article §6 / L57-62
- 核心價值：想要影片感但不想開 PR 或 After Effects —— 來源 article §6 / L62
- 一句話定位：一篇文章進去，一支有電影感的影片出來 —— 來源 article §1 / L5

**開發計劃**：

- step 1 (~5s) — 過場 hero：「適合什麼場景？」
- step 2 (~10s) — 四場景卡片：技術教學 / 產品 demo / Conference talk / 課程內容
- step 3 (~8s) — 反差收束：「不想開 PR，不想開 AE」否定卡 + 下方「但要影片感」肯定卡
- step 4 (~7s) — 結尾 hero：「一篇文章或口播稿進去，一支影片出來。這就是 web-video-v2。」

口播節選：
> 技術文章變教學影片。產品 demo。Conference talk⋯⋯一篇文章進去，一支有電影感的影片出來。這就是 web-video-v2。

---

## 素材清單

### 1. hook
- ✓ 全文字 + 對比卡片 + 流程線，純 CSS 可完成
- ⚠️（可選）React Hooks 程式碼片段截圖或 SVG 模擬（placeholder 亦可）

### 2. workflow
- ✓ 四階段流程線 + 卡片，純 CSS / SVG 可完成
- ⚠️（可選）script.md / outline.md 文件預覽截圖（placeholder 亦可）

### 3. checkpoint
- ✓ 五項清單 + 逐項呈現，純 CSS 可完成

### 4. features
- ⚠️ 字幕條 / 功能表 / 頁碼的模擬 UI 示意（建議自繪 SVG mock）
- ✓ fit 模式對比 + PDF 匯出示意 + URL 參數程式碼塊，純 CSS 可完成

### 5. closing
- ✓ 場景卡片 + 反差對比 + hero 文字，純 CSS 可完成

---

**整體素材結論**：本片為工具教程類，90% 以上靠 CSS / SVG / 模擬 UI 完成。唯一可能需要外部素材的是章節 4 的功能示意圖，但自繪 mock 即可優雅表達。
