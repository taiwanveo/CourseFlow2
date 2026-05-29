# 主題系統

每個演示從頭到尾跑**一個主題**。我們**不**在章節間翻轉明暗 —— 那會
打斷影片的視覺連貫性，錄屏時看起來像很硬的剪輯。如果想要"暗一點的氛圍"
段落，請在**同一調色盤內**降對比、收聚光，而不是翻轉表面色。

主題 = 一組 CSS 設計 token + 一個 `theme.json` 後設資料。

**章節對 token 的消費分兩層**：

1. **必須用 token 的**（換主題不破的底線）—— 顏色 + 字型家族
2. **章節自由發揮的**（按內容設計）—— 字號 / 間距 / 動畫時長 / 緩動 /
   邊框寬度 / 一般圓角 / 字距等都可硬編碼

主題**不只管**顏色和字型，但其他維度（hero 數字、分割線、卡片、舞臺
裝飾）透過 **primitive class**（`.hero-num` / `.rule` / `.card` /
`.stage-frame`）自動接入，章節用 class 即可，不需要手動 `var()`。

主題管的維度：

| 維度                       | 主題怎麼管                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| **調色盤**                 | shell / surface 階梯、text 階梯、accent + 透明度衍生              |
| **字型**                   | 中文 / 英文 / body / 等寬家族 + OpenType 特性集                     |
| **舞臺 padding 密度**      | `--stage-pad-x/y` —— 精煉主題 140×100，密集主題 80×60              |
| **圓角性格**               | `--r-card` —— sharp (0) / refined (4) / soft (16) / keynote (32)  |
| **分割線性格**             | `--rule-w` + `--rule-style` —— 細/粗 × 實/虛                       |
| **hero 數字風格**          | `--hero-num-*` —— 編輯級斜體 / 終端等寬 / 粗黑 / 手寫              |
| **舞臺 / 卡片陰影**        | `--shadow-stage` / `--card-shadow` —— 紙浮 / 偏移實色 / 內陰影     |
| **裝飾層**                 | `--surface-pattern*` / `--surface-vignette` / `--text-shadow`     |
| **動效基線**               | `theme.json` 的 `mood` —— 電影感慢 / 彈簧 / 利落 / 安靜            |

> **`mood` 不寫時長數值**。具體 ms / 緩動由 chapter agent 看 `mood`
> 自己拍板（慢主題別寫 200ms 快動畫，僅此而已）。

每個主題約 25~35 個 token。完整契約見下方。

---

## 內建主題

10 套初始主題，每個都有**獨立的設計 DNA** —— 不是簡單的換色版。挑一個
匹配你主題情緒的，或者作為你自己主題的起點。

### 深色主題

| id                | 性格                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `midnight-press`  | 電影感編輯級深色。暖色 espresso（不是純黑）+ 火熱橙。Instrument Serif italic 英文 vs Noto Serif SC 中文。hero 數字：斜體襯線。慢速電影感節奏（1.6s 揭示）。140×100 padding。只有 vignette，沒有顆粒。            |
| `chalk-garden`    | 深石板黑板。Patrick Hand 全場手寫，粉筆黃 accent。**2px 虛線 rule** 是簽名。film grain（overlay）+ vignette。襯線帶 chalk text-shadow。手繪節奏。                                                                |
| `terminal-green`  | 80 年代磷光終端。純黑 + JetBrains Mono only + 0px 直角。**CRT 掃描線**貼在舞臺上。文字帶磷光 text-shadow。利落線性動效（180/400/650ms）。hero 數字：等寬頻發光。                                                  |
| `blueprint`       | 工程藍圖。深海軍藍 + 繪圖青 + IBM Plex Mono。**2px 虛線青色 rule + 60px 製圖網格**是簽名。hero 數字：等寬青色。等寬配對營造技術 / 藍圖感。                                                                       |

### 淺色主題

| id                  | 性格                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paper-press`       | midnight-press 的白天孿生兄弟。暖奶油 + 紙紋（multiply blend）。火熱橙。hero 數字：斜體編輯級襯線。慢速電影感節奏。140×100 padding。                                                                              |
| `warm-keynote`      | 現代 SaaS keynote。奶油 + 棕褐墨 + 青綠 + Inter。**大圓角（32px）glass slab** 配 backdrop blur。**粗黑 font-black hero 數字**。舞臺上 40px 暖色網格。彈簧動效。                                                  |
| `newsroom`          | NYT 報刊。報紙奶油 + 墨黑襯線 + 旗紅。Playfair Display + Noto Serif SC。**0 圓角**（報紙不會圓角）。hero 數字：超大斜體顯示襯線。安靜的印刷節奏。淡紙紋。                                                        |
| `bauhaus-bold`      | 現代主義宣言。米白 + 墨黑 + 原色藍。Archivo Black + Inter。**0 圓角 + 4px 實色厚邊 + 4px 黑色畫框包住舞臺 + 偏移實色陰影**。hero 數字：font-weight 900 巨字。利落快速動效。無裝飾。                              |
| `sunset-zine`       | 獨立 risograph zine。暖桃 + riso 洋紅 + Fraunces。**虛線剪貼線 + 偏移桃色陰影**。hero 數字：斜體 Fraunces。粗 riso 紙紋。彈簧 overshoot 動效。                                                                  |
| `monochrome-print`  | 安靜精煉的印刷雜誌 —— Monocle / Wallpaper / MIT Press。米白 + 墨黑襯線 + 墨藍 accent。Source Serif。**只有 1px 實線髮絲、4px 精煉圓角**。hero 數字：斜體 tabular figures。**無裝飾** —— 極簡純粹。極靜節奏（1.7s 揭示）。 |

隨時列出可用主題：

```bash
bash <path-to-web-video-v2>/scripts/scaffold.sh --list-themes
```

---

## 腳手架時挑一個主題

```bash
# 預設（midnight-press）
bash scripts/scaffold.sh ./presentation

# 顯式指定
bash scripts/scaffold.sh ./talk --theme=newsroom
```

腳手架會把所選主題的 `tokens.css` 拷到 `<project>/src/styles/tokens.css`，
並把主題 id 寫到 `<project>/.theme`，方便以後看是從哪個主題開始的。

---

## 之後切換主題

切換 = 一次檔案覆蓋：

```bash
cp <path-to-web-video-v2>/themes/newsroom/tokens.css \
   presentation/src/styles/tokens.css
```

重新整理 dev server。完成。章節程式碼一行沒動。

如果切換後某章節看起來有問題，那是該章節在某處硬編碼了顏色 / 字型 /
尺寸，而不是用語義 token。去找出來 —— bug 在章節裡，不在主題裡。

---

## 完整 token 契約

`base.css` 給**性格 token 都準備了合理的預設值**。主題的 `tokens.css`
只需要覆蓋**調色盤 + 字型 + 性格旋鈕 + 裝飾**這四類。

> **base.css 裡的字號 / 間距 / 時長尺度只供 primitive class 自己用**
> （`.label-mono` / `.kicker` / `.scene-pad` 等）。**不是**章節必須消費
> 的契約——章節這一層要不要 `var(--t-h1)` 還是直接寫 `font-size: 96px`
> 完全自由。

### 必填（主題必須定義）

#### 表面色（4 個）

| token         | 作用                                                |
| ------------- | --------------------------------------------------- |
| `--shell`     | letterbox / 舞臺外的頁面背景                        |
| `--surface`   | 舞臺主背景                                          |
| `--surface-2` | 凸起 —— 卡片、程式碼塊、嵌入面板                      |
| `--surface-3` | 最裡層 —— surface-2 裡再嵌一層時用                  |

#### 文字（4 個）

| token          | 作用                                  |
| -------------- | ------------------------------------- |
| `--text`       | 主                                    |
| `--text-2`     | 次（副標題、正文）                    |
| `--text-mute`  | 靜音 —— 標籤 / 後設資料                 |
| `--text-faint` | 三級 —— 提示 / 禁用                   |

#### 線條（1 個）

| token    | 作用              |
| -------- | ----------------- |
| `--rule` | 髮絲分割線顏色    |

#### Accent（3 個）

| token           | 作用                                          |
| --------------- | --------------------------------------------- |
| `--accent`      | accent 本體（一個品牌強色）                   |
| `--accent-soft` | 低透明度疊層 —— pill 背景、懸浮光暈            |
| `--accent-glow` | 中透明度疊層 —— text shadow、圓點發光          |

#### 字型家族（4 個）

| token               | 作用                                       |
| ------------------- | ------------------------------------------ |
| `--font-display-cn` | 中文顯示家族                               |
| `--font-display-en` | 拉丁顯示家族（斜體強調聲音）               |
| `--font-body`       | 正文 / 段落家族                            |
| `--font-mono`       | 等寬家族（終端、mono caps、badge）          |

### 可選的性格覆蓋（主題應該定義來表達自己的性格）

這些有 base 預設值；主題重新定義來表達性格。

| token              | base 預設           | 作用                                                  |
| ------------------ | ------------------- | ----------------------------------------------------- |
| `--font-features`  | `"tnum","ss01"`     | body 上的 OpenType 特性棧                             |
| `--r-card`         | `--r-md`            | 預設卡片圓角（sharp / refined / keynote）              |
| `--r-stage`        | `0`                 | 直接加在舞臺本身的圓角                                 |
| `--rule-w`         | `1px`               | rule 粗細（1=髮絲，2=中等，4=厚重）                    |
| `--rule-style`     | `solid`             | rule 樣式（`solid` / `dashed` / `dotted`）             |
| `--hero-num-font`  | `--font-display-en` | `.hero-num` 用什麼字型（主題決定性格）                 |
| `--hero-num-style` | `italic`            | `italic` / `normal`                                   |
| `--hero-num-weight`| `400`               | 400（編輯級）/ 500（等寬）/ 900（粗黑）                |
| `--hero-num-track` | `--track-tight`     | hero 數字的字距                                       |
| `--stage-pad-x`    | `96px`              | 舞臺橫向內邊距（密度旋鈕）                            |
| `--stage-pad-y`    | `80px`              | 舞臺縱向內邊距                                        |
| `--card-shadow`    | none                | `.card` 的 box-shadow                                 |
| `--card-glass-bg`  | `rgba(255,255,255,0.06)` | `.card-glass` 的背景                            |
| `--card-glass-border` | `rgba(255,255,255,0.12)` | `.card-glass` 的邊框                            |
| `--shadow-stage`   | dark drop           | 舞臺的 box-shadow                                     |
| `--stage-border`   | `none`              | 舞臺的可選邊框（Bauhaus 用 `4px solid black`）         |

### 可選的裝飾層（主題可選用，給質感加簽名）

這些預設是 no-op；主題選擇性啟用。裝飾畫**在舞臺上**（pattern 用
`stage-frame::after`，vignette 用 `stage-frame::before`），所以會被螢幕
錄製器捕捉到。

| token                        | 作用                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--surface-pattern`          | 疊在舞臺上的 `background-image`。SVG 噪聲 / 網格 / 掃描線。                                                |
| `--surface-pattern-size`     | 配套的 `background-size`。可平鋪漸變必填。                                                                  |
| `--surface-pattern-blend`    | pattern 層的 `mix-blend-mode`（`normal` / `multiply` / `overlay`）。                                       |
| `--surface-pattern-opacity`  | pattern 層的整體透明度乘子。                                                                                |
| `--surface-vignette`         | vignette 疊層的 `background`（黑板 / 電影感邊角的徑向漸變）。                                              |
| `--text-shadow`              | 應用在 `.serif-cn` / `.serif-it` / `.display-en` 上。如粉筆暈 / 磷光輝。                                    |

如果你需要的裝飾找不到對應槽位，那就跨過"主題契約"邊界進入"章節自定義
CSS"領域 —— 在那裡解決，別擴主題契約。

---

## 創作新主題

### 1. 複製一個最接近的作為起點

挑一個**最接近**你目標氣質的：

| 目標情緒                            | 起點               |
| ----------------------------------- | ------------------ |
| 陰鬱、電影感、編輯級                | `midnight-press`   |
| 編輯級 - 淺色                       | `paper-press`      |
| 現代 keynote / SaaS                 | `warm-keynote`     |
| 教室 / 解說                         | `chalk-garden`     |
| 終端 / 駭客 / 賽博                  | `terminal-green`   |
| 紀錄片 / 嚴肅 / 新聞                | `newsroom`         |
| 工程 / 藍圖 / 技術                  | `blueprint`        |
| 現代主義 / 布魯塔利斯特 / 宣言      | `bauhaus-bold`     |
| 獨立 / 玩味 / zine                  | `sunset-zine`      |
| 精煉 / 安靜 / 印刷                  | `monochrome-print` |

```bash
cd <path-to-web-video-v2>/themes
cp -r monochrome-print my-theme
```

### 2. 改 `my-theme/tokens.css`

按契約自上而下走一遍：調色盤 → 字型 → 性格旋鈕（`--r-card` /
`--rule-*` / `--hero-num-*` / `--stage-pad-*`）→ 陰影 → 裝飾。
**不要**碰字號 / 間距 / 時長尺度 —— 那些是 base.css 給 primitive class
用的內部預設值，不是主題契約的一部分。

**幾條不那麼顯而易見的規則：**

- 深色主題裡 `--shell` **比 `--surface` 更深 / 更飽和**；淺色主題裡
  `--shell` **比 `--surface` 略灰一點** —— 這樣舞臺讀起來是"主體"，
  外圍會退後。
- 維持 `--text` 與 `--surface` **至少 4.5:1 對比度**。96px+ 的標題
  可以放寬到 3:1，body / cue 必須 ≥ 4.5:1。
- `--accent` 是**唯一的**飽和色。第二個飽和色會跟第一個打架。
- `--accent-glow` 和 `--accent-soft` 是 `--accent` **同色相的透明度
  疊層**，永遠不要用別的色相。
- `--text-faint` 在 `--surface` 上 13px 大寫時**仍然要可讀**。
- 挑**一個設計簽名**重重發力：虛線 rule、粗黑邊、掃描線、紙紋、glass
  slab。別同時疊三個。

### 3. 改 `my-theme/theme.json`

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "nameZh": "我的主題",
  "description": "一句英文描述它的氣質。",
  "descriptionZh": "一句中文描述它的氣質。",
  "mood": ["dark", "moody", "futuristic"],
  "bestFor": ["<匹配場景 1>", "<匹配場景 2>"],
  "preview": {
    "shell": "#080808",
    "surface": "#101010",
    "text": "#f0f0f0",
    "accent": "#ffd54a"
  }
}
```

`id` 必須等於目錄名。

### 主題後設資料欄位說明

| 欄位 | 必填 | 取值 | 決定什麼 |
|---|---|---|---|
| `id` / `name` / `nameZh` | ✓ | 字串 | 主題標識 |
| `description` / `descriptionZh` | ✓ | 一句話 | Checkpoint Plan 列清單時的簡介 |
| `mood` | ✓ | 標籤陣列 | 模糊匹配用 |
| `bestFor` | ✓ | 場景陣列 | Checkpoint Plan 智慧推薦時的命中點 |
| `preview` | ✓ | 4 色物件 | Checkpoint Plan 列清單時的視覺預覽 |

> **主題不再約束動畫選型 / 時長 / 字號 / emoji**。視覺風格由 `tokens.css`
> 的顏色 / 字型 / 字號 token 決定，動畫 / 節奏 / 視覺演示完全交給 chapter
> agent 在每章實現時按內容自由發揮，避免主題欄位過早限制創造力。
>
> 風格審美約束（不要紫粉漸變、不要 emoji 裝飾、不要假資料等）由
> [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 統一規定，與具體主題無關。

### 4. 用所有 demo 章節測試一遍

```bash
bash scripts/scaffold.sh /tmp/test-theme --theme=my-theme
cd /tmp/test-theme
npm run dev
```

把 demo 每一步點完。檢查：

- 標題襯線在舞臺上很清晰。
- accent 圓點在發光但不爆。
- 斜體強調有可讀的背景。
- 進度條（懸浮底邊）能看到，是 accent 色。
- masthead 行（`.masthead`）讀起來像編輯 chrome，不像 navbar。
- hero 數字（`.hero-num`）感覺**和整體字型同源**，不像貼上去的。
- 卡片（`.card`）感覺是合適的材質（紙 / 玻璃 / cell）。
- 裝飾**被注意到一次然後被忘掉** —— 永遠不打擾。

哪裡不對就改 `tokens.css`，重新整理即可。無需重新構建。

### 5. 加到檔案裡

在本檔案頂部"內建主題"表裡追加一行。

---

## 反模式

- **章節 CSS 硬編碼 hex 顏色 / 字型名** —— 缺哪個色彩 / 字型語義就在
  契約裡補一個，給所有主題加上（注意：**字號 / 間距 / 時長**硬編碼不算
  反模式，章節按內容自由設計）
- **演示中途切換主題** —— 選一個，一以貫之
- **第二個 accent 色** —— 只能有一個。用尺度 + 字重做層級
- **在元件層 override 主題 token**（顏色 / 字型 / 性格簽名）—— 只在
  `:root` 裡覆蓋。一次性的顏色需求 = 提一個派生 token，讓所有主題都
  提供自己的值
- **依賴主題的 TSX 條件分支** —— 章節必須主題無關。佈局依賴明 vs 暗
  = 佈局脆弱，修佈局
- **一個主題疊三個設計簽名** —— 選 ONE 個（虛線 rule / 掃描線 /
  glass slab / 紙紋 / 粗邊），三個會自己打架
