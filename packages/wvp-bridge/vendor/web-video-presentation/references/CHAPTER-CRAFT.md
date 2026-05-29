# 章節開發指引（每章開發必讀）

---

## 這是影片，不是 PPT

正在做的是**影片網頁** —— 講者點選 + 口播 + 錄屏發出去給觀眾看。
判斷每一步做對沒有，標準非常樸素：

- **不像 PPT** —— 觀眾感覺是在看影片，不是在看翻頁幻燈（頁面中不得包含頁首頁尾，突出主視覺元素）
- **看起來舒服** —— 配色、字型、節奏都讓人放鬆，不得出現大量的純文字、不得出現字型太小的文字
- **有視覺衝擊** —— 畫面在演事情，不只是文字堆砌，不得一次性全部羅列所有元素，關鍵元素隨進度逐步推進展現

---

## 必須用 CSS / SVG / Canvas / JS 大膽繪製視覺演示

> **這是底線。**
>
> 每一章都至少要有 1~2 處"動起來的圖 / 演示元素"。
> **整章只有純文字 = 驗收不過 = 回去重做。**

影片感最強的來源 —— 使用者**看見**了被講解的東西在螢幕上演給他看：

- 數字在遞增 / 橫條在生長 / 排名在交換
- 流程節點依次點亮 / 連線自繪
- 對比被一刀切開 / 聚光燈掃過 / 形狀在變形
- 粒子聚攏成形 / 噪聲背景流動 / 字元雨下落
- 模擬終端互動
- 模擬 AI 對話視窗
- 模擬檔案目錄樹

**怎麼組合發揮都行 —— 但每章必須用，不允許整章純文字。**

---

## 逐步揭示，禁止一次全展示

整頁內容由**全域性 `step` 計數器**驅動 —— 點選空白處或按 → 鍵推進
一步。設計每一步時心裡要默唸：**這一步演什麼，下一步演什麼**。

**最重要的一條**：

> 當口播在說"第一是 X、第二是 Y、第三是 Z"這種**清單 / 列表**時，
> **嚴禁**一個 step 把 X / Y / Z 全部 stagger 上來。

正確做法：

- 一項 = 一個 step
- X 只在它自己的 step 裡獨自亮起
- 講到 Y 時，X 灰化保留作上下文 + Y 亮起
- 講到 Z 時，X / Y 都灰化 + Z 亮起

**判斷標準**：講者會一個一個念出來嗎？會 → 必須逐個揭示。

---

## 內容取捨：抓重點，不要原文搬運

影片是**音 + 畫**：

- **口播**負責把資訊線性講清楚
- **畫面**負責把節拍重點放大、節奏感拉出來

每個 step 螢幕上只掛這個節拍**最值得放大的 1~3 個東西** —— 一個
hero 標語 / 一個數字 / 一組對比 + 必要的視覺演示。

不要試圖把原文每個字都搬上去。那是論文閱讀，不是影片。

---

## 雙源：節奏跟口播稿，細節回原文章

> **節奏 / 順序 / 節拍切分** 跟 **`script.md` 口播稿** —— **關鍵順序不能亂**。
> **畫面細節 / 資料 / 引用 / 案例** 回 **`article.md` 原文章**抽。

`outline.md` 已經在每章首段抽了「資訊池」做參考。但**實現章節時
也必須回去翻 `article.md` 本章對應段落** —— 那裡有比口播稿多得多的
細節（具體數字、引用原話、案例維度、出處時間）。把這些掛到畫面上，
讓**畫面資訊密度 > 口播資訊密度**。

> **如果你只用了口播稿的內容做章節** —— 螢幕等於把口播打字打了一遍
> —— 那就是 PPT，不是影片。
>
> 章節實現一定要回原始文章抽細節，不要嫌麻煩。

---

## 字型 / 配色 / 動畫 / 留白 —— 影片演示基本審美

影片觀眾離螢幕遠、注意力浮動，所以：

- **字號要大** —— hero 文字至少 80px 起，遠觀也能看清
- **留白要多** —— 舞臺四邊都要讓出大留白，畫面不要塞滿
- **配色要舒服** —— **顏色和字型家族必須用主題 token**（保證換主題不破）；
  字號 / 間距 / 時長這些章節按內容自由發揮（詳見下方「程式碼層最小約束」）
- **動畫要舒服 + 炫酷** —— 出現得乾淨利落，停下來不搶戲；炫酷靠
  **設計巧思**（內容驅動的演示動畫），不靠**速度暴力**或**密集閃爍**

---

## 避免 AI 味

AI 生成的網頁有幾種共有的"視覺指紋"，**全部不要**：

- 紫粉 / 藍紫對角漸變背景
- 圓角卡片 + 彩色左邊框裝飾
- 漸變按鈕 + 大圓角藥丸
- emoji 當圖示用
- 假資料 / 假 logo / 假"X 萬使用者"
- 整章 N 步用同一種入場動畫（全場 fade / 全場 blur）
- 每步都掛 ken burns / 光暈呼吸 / 持續閃爍
- 每屏右下角都掛 mono 角標 / 序號

缺的東西**承認缺** —— 用 placeholder 佔位卡（一張寫著"image · 16:9
描述"的卡片，按真實比例留位）。**不要**用 emoji 湊、不要找無關圖湊、
不要編數字。**沒有就承認沒有**，比 fake 強一百倍。

---

## 框架已經搭好的部分（理解就好，不需重寫）

- **16:9 固定舞臺**：內容在 1920×1080 設計，**動畫 / 字級 / 留白照舊**——
  章節作者不需要處理響應式。Stage 外層的 `fit` 策略：**預設 `contain`**
  （保比例 + letterbox 黑邊，任何 viewport 下都不裁切）；`?fit=cover`
  opt-in 切到「填滿 viewport、必要時對稱裁切兩側 / 上下、無黑邊」模式。
  → **僅當使用者選用 `?fit=cover`** 時，每章必須遵守「**安全區**」：核心
  視覺集中在中央 1600×900 內，超出區只放裝飾性元素，避免 cover 模式下被
  對稱裁切。**預設 contain 下無此約束**，1920×1080 整個畫面都完整顯示。
  詳見 SKILL.md「原則 1 / 5 / 6 細則」段。
- **舞臺居中 + 大留白**：上下左右四邊都讓出至少 80px 的安全區
- **隱形進度條 + 隱形邊角控制元件**：除了底部的隱形進度條外，**TopMenu
  （頂部 5vh hover 區）** / **PageNumber（右下 hover 顯示）** /
  **SubtitleBar（底部字幕條）** 皆遵循「平時隱形 / 進入互動才顯示」變體
  （TopMenu / PageNumber 200ms 漸顯、600ms 漸隱；SubtitleBar 由鍵盤 `S`
  與 `?subs=off` 控制，**預設顯示**）。**章節程式碼不需要動這些元件** ——
  它們由 App.tsx 統一掛載，會自動感知 `useAutoMode().mode` 與 URL 參數。
  詳見 SKILL.md「原則 1 / 5 / 6 細則」段。
- **錄屏時無 chrome / 互動時可 hover 顯示 chrome**：精確規格是「**錄屏時
  無 chrome**」。`mode === 'auto' \| 'section'` 或 `?recording=1` 時
  **強制隱藏** TopMenu + PageNumber；Manual 模式下這些可 hover 顯示。
  **SubtitleBar 例外**：錄屏模式預設仍顯示（字幕屬於成片內容），只有
  `?subs=off` 或使用者按 `S` 才隱藏。
  → 因此章節作者**仍然**禁止在 `.scene` 內部自寫頁首頁尾 / 品牌條 /
  頁碼 —— 那是框架的職責。詳見 SKILL.md「原則 1 / 5 / 6 細則」段。
- **全域性 step 驅動**：點選舞臺空白處 / 鍵盤 ←/→ 推進；章節是 `step`
  的純函式，沒有定時器、沒有命令式狀態

> **章節作者必須知道的約定**：
> - **頁碼定址**：每個 step 的對話定址格式為 `{chapterIdx+1}.{step+1}`，
>   例如「重寫 2.3」= 重寫第 2 章的 step=2 分支（含視覺 + narrations[2]）。
> - **字幕條 = `narrations[step]` 直接顯示**：`narrations: string[]`
>   結構是音訊管線的真相源；字幕條只是讀同一個陣列。使用者寫什麼語言就
>   顯示什麼，本 Skill **不做語言切換 UI**，也不動 extract-narrations /
>   音訊管線。
> - **完工自檢含 self-check**：跑 `npm run self-check`（Playwright 巡所有
>   step、量字級、查溢出）必須無紅線級警告（< 16px）；< 24px 警告允許但
>   需在 progress 中註記。

---

## 章節作者落地細則

上一節「章節作者必須知道的約定」block 是速查；本節給出**詳細規則 + 使用範例**，第一次寫章節時請完整讀一次。所有 URL 參數見 [`URL-PARAMS.md`](URL-PARAMS.md)，原則 1 / 5 / 6 的「Manual / 錄屏雙態」設計見 [`../SKILL.md`](../SKILL.md) 的「原則 1 / 5 / 6 細則」段。

### 頁碼定址規則 `{chapterIdx+1}.{step+1}`

PageNumber 元件在 Stage 右下角顯示 `2.3` 這樣的編碼。使用者**只在對話中**用這個編碼點名修改某一頁，**程式碼裡仍用 0-based 索引**。

**解碼表**：

| 使用者說 | 內部對應 | 章節作者要動的檔 |
|---|---|---|
| 「重寫 **2.3**」 | 第 2 章（`chapters[1]`）的 `step === 2` 分支 | `src/chapters/02-<id>/Chapter.tsx` 對應 `if (step === 2)` 那一支 |
| 「**2.3** 的口播改短」 | 同上的 `narrations[2]` | `src/chapters/02-<id>/narrations.ts` 的 `[2]` 項 |
| 「**3.1** 字幕擋到內容」 | 第 3 章（`chapters[2]`）的 `step === 0` 分支 | `src/chapters/03-<id>/Chapter.tsx` 的 `step === 0` 視覺往上推、留出底部 8vh 給字幕條 |

> **記住 -1 規則**：使用者說的 `X.Y` → 程式碼裡是 `chapters[X-1]` 的 `step === Y-1`。**第一次定址前先在內部確認過再動手**。

**對話定址的順手檢查**：每次按使用者指令改完 `X.Y`，**最少順手檢三件事**：
1. `narrations[Y-1]` 文字是否仍與新視覺對齊（口播沒念到的細節別亂加；念到的關鍵詞畫面要有）。
2. 新視覺的動畫時長是否 ≤ 該 step 口播時長（口播 `字數 ÷ 4 ≈ 秒數`）。
3. 該 step 的視覺有沒有超出**安全區 1600×900**（見下一節）。

### 字幕條約定（`narrations[step]` 直接顯示為字幕）

**核心決策**：本 Skill **不引入語言切換 UI**，也**不改 narrations 資料結構**。SubtitleBar 元件只做一件事 —— 把 `narrations[step]` 字串原樣畫到底部 8vh 條上。

| 場景 | 字幕條怎麼處理 |
|---|---|
| 使用者寫中文 narration | 字幕條顯示中文 |
| 使用者寫英文 narration | 字幕條顯示英文 |
| 使用者希望雙語錄屏 | 在 `narrations[step]` 寫雙行字串（`"中文。\nEnglish."`），字幕條自然換行（**不要**做語言切換 UI） |
| 過場 step（`narrations[step] === ""`） | 字幕條 fade out（不顯示空條） |
| 使用者按 `S` 鍵 / `?subs=off` | 字幕條整體隱藏；錄屏模式 `?recording=1` **不會**自動隱藏字幕（字幕是內容） |

**章節作者的責任**：

- **寫 `narrations[step]` 時，字數要與動畫節奏匹配** —— 字幕條一次能舒服讀完約 18~24 個漢字 / 40~60 個英文字元；過長會被裁切、過短會 fade out 太快。Auto 模式按音訊時長推進，所以**動畫長度 ≤ `narrations[step]` 口播時長**（字數 ÷ 4 ≈ 秒數）這條紅線必須遵守。
- **字幕條會佔據底部 8vh 高度** —— 視覺設計時，**核心元素不要貼到 viewport 底部**，至少給字幕條讓出 ~10vh 緩衝（cover 模式下底部裁切已扣掉部分，但仍要留）。
- **不要在 `.scene` 裡自寫底部字幕** —— SubtitleBar 是框架元件，自寫會雙顯。

### 安全區 1600×900（**僅 `?fit=cover` opt-in 時相關**）

> **此規則對應原則 1 的「Manual / 錄屏雙態」設計**：見 [`../SKILL.md`](../SKILL.md) 「原則 1 / 5 / 6 細則」段表格第一列，以及本檔上文「框架已經搭好的部分」段第一條（「16:9 固定舞臺」）。本節是該規則在章節作者視角的詳細落地。
>
> **預設 contain 模式下無此約束** —— 1920×1080 整個畫面都完整顯示在 letterbox 框內，章節作者可以放心把 corner label 放在 top:64px、hero 標題貼近邊緣，全部都看得到。本節只在使用者明確 `?fit=cover` opt-in 時生效。

**為何 cover 需要安全區**（opt-in 行為）：

當使用者選用 `?fit=cover`，`hooks/useViewportFit.ts` 算 `scale = max(vw/1920, vh/1080)`，會**對稱裁切兩側或上下**讓內容填滿 viewport（body 上掛 `.fit-cover` class）。預設不加 `?fit=cover` 時是 contain 行為（`scale = min(...)` + letterbox 黑邊，body 上掛 `.fit-contain` class）。因此在 21:9 / 16:10 / 4:3 等非 16:9 viewport 下，**16:9 設計畫面的邊緣會在 cover 模式被裁掉一截** —— 若章節要支援 cover 錄屏 / 投影使用，章節作者就必須把核心視覺都放進中央安全區，否則觀眾會看到「半個 hero 數字」這種尷尬畫面。

**安全區 vs 緩衝區規約**：

| 安全區（中央 1600×900） | 緩衝區（外圈 1920×1080 ~ 1600×900） |
|---|---|
| 核心視覺：hero 標語 / 主數字 / 關鍵卡片 / 主對比圖 / 主流程節點 | **只放裝飾性元素**：背景紋理 / 邊角 micro-label / vignette / 留白 / 延伸出視窗的圖形拖尾 |
| 文字必須整段在內 | 大字標題可以**部分**超出（觀眾仍能讀懂前半段） |
| 互動觸發 / 按鈕（不應該有，但若有） | 純視覺修飾 |

**反例（cover 模式下被裁的悲劇）**：
- 把第二行小字標題貼在 y=80px → 觀眾 16:10 / 21:9 viewport 直接看不到。
- hero 大數字滿屏置中但邊緣字元剛好踩在 1920 邊上 → 16:10 viewport 看到「半個 8」。

**正例**：
- hero 數字置中、字身 ~600px、四邊各留 660px → 安全。
- 卡片陣列 4 張、每張 320×500、整列寬 1400 置中 → 安全。
- 背景圖案 / vignette 鋪滿 1920×1080 → 裁切無感（裝飾性）。

> **驗證手段**：跑 `npm run self-check`（見下一節），Playwright 會用 21:9 / 16:9 / 16:10 / 4:3 多比例截圖；若主視覺元素在某些比例下被裁就會在報告裡標警告。

### 自檢紅線（`npm run self-check`）

每章寫完進入「完工自檢」前，在 `presentation/` 目錄跑：

```bash
npm run self-check
```

Playwright 會：

1. 起 dev server，遍歷 `chapters.ts` 註冊的所有 `(chapter, step)` 組合。
2. 用 `localhost:5173/?chapter=N&step=M&recording=1` 開頁，等載入完。
3. 對每一頁截圖 + 量主視覺字級 + 查文字溢出 stage。
4. 額外驗 PageNumber 的位置（hover 觸發後在右下 24px 內距）與 SubtitleBar 的文字（= `narrations[step]`，`?subs=off` 模式下不渲染）。
5. 產出 `self-check-report.html`（人類審 + 縮圖）和 `self-check-report.json`（CI / agent 解析）。

**紅線判定**：

| 等級 | 判定 | 處置 |
|---|---|---|
| 🟥 **紅線** | 主視覺字級 < **16px**；任一文字 `scrollWidth > offsetWidth` 或 `scrollHeight > offsetHeight`（溢出 stage） | **必修**，修完重跑 self-check 直到無紅 |
| 🟧 警告 | 主視覺字級 < **24px**；某 (chapter, step) 在某比例下安全區被裁 | 允許保留，但**在 progress.md 註記** + 跟使用者報告 |
| 🟩 通過 | 上述兩項都不觸發 | 進入下一步「完工自檢」清單 |

**self-check 跑不過時的常見修法**：

| 報告問題 | 修法 |
|---|---|
| 字級 < 16px 紅線 | 把對應元素字級加大，或者改用 hero 級結構（`.hero-num` / h1） |
| 文字 scrollWidth 溢出 | 換行 / 縮短文字 / 加大容器寬 |
| 文字 scrollHeight 溢出 | 拆 step（一頁太擠） |
| PageNumber 不在右下 | 檢查是否被章節 CSS 蓋住 z-index |
| SubtitleBar 文字不對 | `narrations[step]` 字串對齊 script.md |

> **流程位置**：self-check 應在 `npx tsc --noEmit` 之**前**或之**後**任意順序執行，但**兩個都必須通過**才能向使用者彙報「做完了」。詳見下方「完工自檢」段。

---

## 程式碼層最小約束

不能踩的紅線，其它怎麼寫都行：

### 必須用 token（換主題不破的底線）

- **顏色**：`--shell` / `--surface` / `--surface-2` / `--surface-3` /
  `--text` / `--text-2` / `--text-mute` / `--text-faint` / `--rule` /
  `--accent` / `--accent-soft` / `--accent-glow` ——
  **禁硬編碼 hex / rgb / 顏色名**
- **字型家族**：`--font-display-cn` / `--font-display-en` / `--font-body`
  / `--font-mono` —— **禁硬編碼字型名**
- **主題性格簽名**透過 primitive class 自動接入，**不要在章節 CSS 裡
  重定義它們**：
  - `.hero-num`（hero 數字風格 —— 主題決定襯線 / 等寬 / 粗黑）
  - `.rule`（分割線 —— 主題決定 1px 實線 / 4px 實線 / 2px 虛線）
  - `.card`（卡片 —— 主題決定圓角 + 陰影性格）
  - `.stage-frame`（舞臺底色 / 圓角 / 陰影 / 裝飾圖案 / vignette
    全自動，章節什麼都不用做）

### 可硬編碼 / 可 token，按內容自由（解鎖章節自由設計）

- **字號**：想要 80px 就寫 80px，想用 `var(--t-h1)` 也行
- **間距 / padding / margin**：按畫面節奏寫具體值
- **動畫時長 / 緩動 / keyframe**：按動畫意圖寫具體值
  （**節奏氣質**參考 `theme.json` 的 `mood` —— 慢主題別寫 200ms 的快動畫）
- **邊框寬度 / 非性格圓角 / 字距**：隨手寫
- **gap / grid 佈局尺寸**：按畫面構圖寫

### 章節動畫要跟著播放速度

TopMenu 內的「播放速度切換」按鈕（1× / 1.25× / 1.5× / 2×）會把 `audio.playbackRate` 同步成 cycle 值，也會把這個值寫到 `<html style="--speed: 1.5">` 給 CSS 用。**章節動畫要跟著加速**，否則 1.5× 唸完口播動畫還在 reveal，下一 step 跳過去視覺被截。

**規則**：

- **動畫時長 / 延遲用 `--anim-*` 系列 token**（base.css 內定義）：
  - `--anim-quick`   ≈ 280ms ÷ speed
  - `--anim-base`    ≈ 600ms ÷ speed
  - `--anim-slow`    ≈ 900ms ÷ speed
  - `--anim-cinematic` ≈ 1400ms ÷ speed
- **要自寫具體毫秒**也行，用 `calc(<ms> / var(--speed))` 包：
  ```css
  .my-fade-up {
    animation: my-fade-up calc(700ms / var(--speed)) var(--ease-quart) both;
    animation-delay: calc(1200ms / var(--speed));
  }
  ```
- **stagger 間距也要除 `var(--speed)`**：
  ```css
  .my-pill-1 { animation-delay: calc(800ms  / var(--speed)); }
  .my-pill-2 { animation-delay: calc(1100ms / var(--speed)); }
  .my-pill-3 { animation-delay: calc(1400ms / var(--speed)); }
  ```
- **無限循環裝飾動畫**（caret blink / pulse halo / 持續微動）**不要** divide by speed —— 它們是裝飾性循環，跟敘事節奏無關，加速反而會閃到刺眼：
  ```css
  .my-caret { animation: caret-blink 900ms steps(1) infinite; }  /* 對 */
  .my-pulse { animation: pulse-halo 1400ms ease-in-out infinite; }  /* 對 */
  ```

**反例**：

```css
/* ✗ 寫死毫秒不包 calc，1.5× 下動畫播完前下一 step 已切走 */
.my-bar-fill { animation: bar-grow 900ms var(--ease-quart) 400ms both; }

/* ✓ 用 calc(/var(--speed)) 包 */
.my-bar-fill {
  animation: bar-grow calc(900ms / var(--speed)) var(--ease-quart)
             calc(400ms / var(--speed)) both;
}
```

**chrome 元件（hover reveal、頁面切換的 chrome 動畫）保留 `--dur-*` 或 fixed ms**，**不要**改用 `--anim-*` —— 我們不希望 TopMenu 在 2× 下一閃而過。

### 其它工程紅線

- 不用 `setTimeout` / `setInterval` 驅動動畫 —— 用 CSS keyframes
- 章節內的可互動元素（按鈕 / 自定義控制元件）加 `data-no-advance`，
  否則點了會被舞臺誤推進 step
- 章節程式碼物理隔離：每章獨立資料夾、獨立 CSS 類字首，不跨章 import
- **章節根 div 用 `<div className="xx-scene scene-pad">`**（不是只 `xx-scene`）。
  `.scene-pad`（base.css 提供）已經包含 `position: absolute; inset: 0; padding:
  var(--stage-pad-y) var(--stage-pad-x); display: flex; flex-direction:
  column;` —— **任何撐滿 stage 1920×1080 / padding / flex column 行為都靠它**，
  章節自己 **不要重寫**這些屬性。常見踩雷：在 `.xx-scene { position: relative }`
  覆寫掉 `.scene-pad` 的 absolute（兩 class 同 specificity，chapter CSS 後載勝
  出），結果 root div 收縮成 content 高度，內部 `position: absolute; inset: 0`
  子元素也跟著縮，文字溢出 stage 上邊緣。**`.xx-scene` 只放章節級顏色 / 文字
  屬性**（`color`、`background`、`text-shadow` 等），layout 屬性（position /
  display / flex / inset / padding / width / height）一律不寫
- **每章必須有 `narrations.ts`**（與 `<Chapter>.tsx` 同目錄）：
  - 陣列長度 **=** 章節程式碼裡 `if (step === N)` 出現的最大 N + 1
  - 每個元素 = 一個 string，該 step 要播的口播文字（來自 `script.md`
    對應段，**語義一致**——可微調標點 / 斷句以適配 TTS，但不能漏關鍵短語）
  - 完全無音訊的過場 step 用空串 `""`，Auto 模式會按字數估時撐過
  - 這是**音訊合成 + Auto 模式自動推進的唯一真相源**，寫錯或漏寫
    會讓錄屏對不上嘴
- **動畫時長必須 ≤ 該 step 的口播時長**——Auto 模式嚴格按音訊結束推進，
  沒有"等動畫跑完"的兜底。動畫太長 → 三選一：**寫更長口播 / 拆 step
  / 調動畫速度**。詳細機制見 [`AUDIO.md`](AUDIO.md)

---

## 完工自檢（寫完每章**強制**執行，不可跳過）

> ⚠️ **硬性流程**：章節實現完成後**必須**走完下面的自檢 → 修復 → 彙報
> 三步。**禁止**"實現完成 → 直接彙報給使用者"。
>
> **執行方式**（按能力降級）：
>
> 1. **優先 Agent Teams**：開一個獨立的 reviewer agent，傳入本章程式碼路徑
>    + 本檔案 Part「完工自檢」清單，讓它**逐項核查 + 出結論**（哪幾條
>    pass / 哪幾條 fail + 證據）。
> 2. **其次 subAgent**：當前 agent 沒有 Teams 能力但能開 subagent，用 subagent
>    走同樣的流程。
> 3. **都沒有**：當前 agent 自己**嚴格逐項**核查，不允許目測一遍就放行。
>
> **拿到自檢結論後**：先按 fail 項**改完程式碼**，然後再向使用者彙報"做完
> 了 + 自檢結論 + 改了什麼"。**直接拿原始結論彙報但不修復 = 違規**。

寫完一章 + 在瀏覽器點完一遍後逐項過：

- [ ] **每章至少 1~2 處 CSS / SVG / Canvas / JS 視覺演示** —— 沒有 = 回去補
- [ ] **不同 step 的主導動作不一樣** —— 全章一種動畫 = 回去重做
- [ ] 字號大、留白舒服、配色舒服
- [ ] 清單 / 列表逐個揭示，**1 項 = 1 step**
- [ ] 畫面資訊比口播稿多（回了原文章抽細節掛上來）
- [ ] 沒有紫粉漸變 / 圓角彩色邊框 / emoji / 假資料 / 假 logo
- [ ] 缺的素材用 placeholder，不是 fake
- [ ] **顏色和字型家族全部走 token**（無硬編碼 hex / 字型名）；hero 數字
      / 卡片 / 分割線 / 舞臺用 primitive class 接入主題性格 —— 這兩條不
      達標 = 換主題就破
- [ ] 章節交付時**主動告訴使用者**："本章還缺這些素材"
- [ ] 禁止出現小號字型，大量純文字（出現後必須回去改）
- [ ] 禁止出現任何形式的頁首頁尾，僅展示關鍵內容（出現後必須回去改）
- [ ] **`npx tsc --noEmit` 透過** —— 不透過禁止彙報"做完了"
- [ ] 章節程式碼物理隔離：獨立 CSS 類字首（`.cd-` / `.mg-` / ...），
      未跨章 import，未修改 `chapters.ts` 之外的共享檔案
- [ ] **`narrations.ts` 存在**且 `narrations.length` === 章節程式碼裡
      `if (step === N)` 用到的最大 N + 1（不一致 = Auto 模式錄屏會錯位）
- [ ] **每條 narration 文字與 `script.md` 對應段落語義一致**（關鍵短語 /
      數字 / 引用全部保留，可為 TTS 微調標點斷句）—— 錄屏畫外音應當能被
      觀眾聽成同一段稿子
- [ ] **每個 step 的視覺動畫時長 ≤ 口播時長**（口播 `字數 ÷ 4` ≈ 秒數）—— 
      超出會被 Auto 模式當場切斷，動畫演到一半就跳下一步
- [ ] **核心視覺都在中央 1600×900 安全區內** —— 超出區只放裝飾
      （見上文「章節作者落地細則」的「安全區」段）；cover 模式
      在 21:9 / 16:10 / 4:3 viewport 下不能裁掉主文字 / 主數字
- [ ] **`npm run self-check` 跑通且報告無紅線** —— 紅線 = 主視覺
      字級 < 16px 或文字溢出 stage；< 24px 警告允許但需在 progress 註記，
      並向使用者主動報告。報告位置：`self-check-report.html`
- [ ] **字幕條文字 = `narrations[step]`** —— self-check 會自動驗，
      但章節作者**不要**在 `.scene` 內部自寫底部字幕、不要動 SubtitleBar
      元件

任一未過 → 回去改。**不要**"先放著以後修"。
