# Template 腳手架與版型調整清單

這份文件整理 CourseFlow v2 用來產生成品 presentation 的模板腳手架來源、版型檔案與主要可調整位置。

用途：未來如果你要客製化某種版型，或是修改標題字級、色彩、字距、行距、位置座標，可以先照這份文件找檔案，再看檔內我已經補好的維護註解。

## 1. 腳手架入口

| 檔案 / 目錄 | 用途 | 你通常何時要改 |
| --- | --- | --- |
| `packages/presentation/src/scaffold.ts` | 把 vendor template 複製成一個新的 `presentation/` 成品工程 | 想改新專案會帶哪些檔案、預設 theme、腳手架結構 |
| `packages/presentation/src/vendor-paths.ts` | 定位 vendor template 與 theme token 的來源路徑 | 想釐清模板檔案實際從哪裡被複製 |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/` | Vite 成品模板來源根目錄 | 想直接改全專案共用模板 |
| `packages/wvp-bridge/vendor/web-video-presentation/themes/` | 各主題 token 定義 | 想改全域顏色、字體、主題氣質 |

## 2. 成品模板入口檔

| 檔案 | 用途 | 重要性 |
| --- | --- | --- |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/main.tsx` | Vite 掛載入口 | 很少改；除非你要更換 root provider |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/App.tsx` | presentation 根播放器 | 管總章節、音訊、字幕、自動播放、PDF 匯出 |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/styles/base.css` | 全域字級、spacing、stage padding、基礎 primitive | 想全域一起調大小、間距時先看這裡 |
| `packages/wvp-bridge/vendor/web-video-presentation/themes/midnight-press/tokens.css` | 範例主題 token | 想改主題色彩、字體、陰影、全域邊距時看這裡 |

## 3. 版型 codegen 檔

這些檔案決定「某一章最後會被生出什麼 TSX / CSS 結構」。

| 檔案 | 版型 / 角色 | 主要控制內容 |
| --- | --- | --- |
| `packages/presentation/src/codegen/templates/list-reveal.ts` | 清單揭示版型 | 決定 intro / item 資料如何餵給 `ListRevealGrid` |
| `packages/presentation/src/codegen/templates/flow.ts` | 流程圖版型 | 決定節點資料與右側配圖如何餵給 `FlowDiagram` |
| `packages/presentation/src/codegen/templates/hook.ts` | Hook 多圖開場版型 | 決定 slide 數量、takeover、close scene |
| `packages/presentation/src/codegen/templates/magazine.ts` | editorial / magazine 版型 | 內嵌大量 CSS，是少數直接在 codegen 檔中調樣式的版型 |
| `packages/presentation/src/codegen/templates/visual-mix.ts` | 宣告式視覺版型 | 將 `stepVisuals` 配置交給 `VisualBlock` |

### codegen 與 CSS 的分工

- `list-reveal.ts` / `flow.ts` / `hook.ts` 主要決定資料結構與元件組裝。
- 這三種版型真正的標題大小、間距、位置，多半在對應的 vendor CSS。
- `magazine.ts` 比較特別，很多字級與欄寬直接寫在它回傳的 CSS 字串裡。

## 4. 主要版型 CSS 調整點

| 檔案 | 主要負責 | 你最常改的設定 |
| --- | --- | --- |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/ListRevealGrid.css` | list-reveal 版型 | 封面大標、揭示卡主標、卡片內文、圖片尺寸 |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/FlowDiagram.css` | flow 版型 | 左右欄比例、導言大標、節點說明字級、右側圖片框 |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/HookImageStrip.css` | hook 版型 | 圖片網格欄數、單圖寬度、takeover 主標、close quote |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/ChapterFigure.css` | 共用章節圖片框 | 圖片框寬度、高度、object-fit、佔位區樣式 |
| `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/VisualBlock.css` | visual-mix 主標區 | headline 大小與標題下方距離 |

## 5. 全域優先級：到底要改哪一層？

### 情境 A：我想所有版型一起變大 / 變小

先看：

- `packages/wvp-bridge/vendor/web-video-presentation/templates/src/styles/base.css`

優先調整：

- `--t-display-1`
- `--t-display-2`
- `--t-h1`
- `--t-h2`
- `--t-body`
- `--t-cue`
- `--stage-pad-x`
- `--stage-pad-y`

### 情境 B：我只想改某一種版型的標題位置或大小

先看對應版型 CSS：

- list-reveal → `ListRevealGrid.css`
- flow → `FlowDiagram.css`
- hook → `HookImageStrip.css`
- visual-mix → `VisualBlock.css`
- magazine → `packages/presentation/src/codegen/templates/magazine.ts`

### 情境 C：我想整個主題換色、換字體、改整體氣質

先看：

- `packages/wvp-bridge/vendor/web-video-presentation/themes/<theme-id>/tokens.css`

代表檔：

- `packages/wvp-bridge/vendor/web-video-presentation/themes/midnight-press/tokens.css`

## 6. 特別提醒：magazine 版型

magazine 是最容易漏找的地方，因為它不像其他版型一樣主要靠獨立 CSS 檔。

真正常用的可調點直接寫在 `packages/presentation/src/codegen/templates/magazine.ts` 內的 CSS 字串裡，例如：

- `.${prefix}-divider-title`：章首大標字級 / 行高 / 寬度
- `.${prefix}-cover-h, .${prefix}-split-h, .${prefix}-quote`：主標群組大小
- `.${prefix}-headline-short/mid/long`：依字數切換的標題級距
- `.${prefix}-body`：內文字級與行高
- `.${prefix}-split` / `.${prefix}-figure-first-grid`：左右欄比例與 gap

## 7. 建議閱讀順序

若你的目標是「快速找到可改字級/顏色/位置的地方」，建議這樣讀：

1. `packages/presentation/src/scaffold.ts`
2. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/styles/base.css`
3. `packages/wvp-bridge/vendor/web-video-presentation/themes/midnight-press/tokens.css`
4. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/ListRevealGrid.css`
5. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/FlowDiagram.css`
6. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/HookImageStrip.css`
7. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/ChapterFigure.css`
8. `packages/wvp-bridge/vendor/web-video-presentation/templates/src/components/VisualBlock.css`
9. `packages/presentation/src/codegen/templates/magazine.ts`

## 8. 修改原則

- 想改局部版型，不要先改 theme token；先看該版型 CSS。
- 想改全部章節一起變化，再回頭動 `base.css` 或 theme token。
- 若改完模板後發現只有新專案生效，代表你改的是 scaffold 來源；舊有 `data/presentations/<id>/presentation` 不會自動回補，需要另外同步。