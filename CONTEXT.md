# CourseFlow v2 — 專案脈絡（CONTEXT）

> 給接手工程師與 AI Agent 的快速地圖。完整上手請讀 [docs/HANDOVER.md](docs/HANDOVER.md)。

## 這是什麼

**CourseFlow v2** 把 [Web Video Presentation（WVP）](skills/web-video-presentation/SKILL.md) 方法論產品化：使用者從文章產出口播稿與大綱 → 在工作室完成章節動畫與配圖 → TTS → 16:9 互動預覽與 MP4 匯出。

- **Repo**：[taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2)
- **與 v1**：綠地重寫，**不共用** Supabase / Redis / Render（見 [docs/INFRA-ISOLATION.md](docs/INFRA-ISOLATION.md)）

## 領域詞彙

| 詞 | 意義 |
|----|------|
| **Composition** | 專案內「文稿結構」JSON：章節、步驟、口播、螢幕內容 |
| **WVP 章節** | 一個可播放單元，對應 `chapter_craft` 一列 + `presentation/src/chapters/*` |
| **Craft** | AI／模板產生的章節 React 元件（`Chapter*.tsx` + `narrations.ts`） |
| **螢幕內容** | 畫面短標（`screenContent`），優先於口播顯示在畫面上 |
| **配圖工作室** | Craft 階段每步的 AI 生圖／上傳（`stepIllustrations`） |
| **試執行第 1 章** | 僅打包第 1 章預覽，驗證風格錨點（`anchorChapterTrial`） |
| **visual-mix** | 宣告式圖表／表格／CSS 動畫版型；**有步驟配圖時不應蓋掉圖片版型** |

## 程式碼哪裡找什麼

| 需求 | 位置 |
|------|------|
| 產品 UI 五階段 | `apps/web/src/app/projects/[id]/{content,craft,audio,publish}/` |
| WVP 預覽 iframe | `wvp-play`、`wvp-embed` 路由 |
| 章節產生／試跑 | `apps/web/src/lib/wvp-chapter-craft.ts` |
| 打包與 dist 建置 | `apps/web/src/lib/wvp-presentation-sync.ts` |
| 配圖上傳／同步 | `apps/web/src/lib/wvp-craft-illustrations.ts`、`wvp-illustration-sync.ts` |
| 章節 TSX 模板 | `packages/presentation/src/codegen/` |
| WVP 播放元件 | `packages/wvp-bridge/vendor/.../templates/src/components/` |
| 階段鎖 | `packages/core`（`WvpPhaseLocks`）、`wvp-locks.ts` |
| LLM 提示詞 | `packages/llm`、`packages/craft-agent` |
| 宣告式視覺 JSON | `packages/visual-config` |

## 本機資料目錄

| 路徑 | 內容 |
|------|------|
| `data/presentations/<projectId>/presentation/` | 每專案 Vite WVP 工作區 |
| `.../public/images/<wvpChapterId>/01.jpg` | 步驟配圖（副檔名可為 gif/png） |
| `.../public/audio/` | TTS 輸出 |
| `.../dist/` | `pnpm` 建置後的預覽靜態檔 |

環境變數 `COURSEFLOW_PRESENTATION_ROOT` 可改工作區根目錄。

## 必讀文件（優先順序）

1. [docs/HANDOVER.md](docs/HANDOVER.md) — 接手總指南  
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架構與資料流  
3. [docs/WVP-ILLUSTRATIONS.md](docs/WVP-ILLUSTRATIONS.md) — 配圖管線（常見踩雷）  
4. [skills/web-video-presentation/SKILL.md](skills/web-video-presentation/SKILL.md) — 產品方法論  
5. [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) — 部署  
