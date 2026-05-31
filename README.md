# CourseFlow v2

**教學動畫工作室** — 內建 [Web Video Presentation](skills/web-video-presentation/SKILL.md) 方法論：章節級 React 動畫、互動 16:9 預覽、MP4 錄屏匯出。

- **GitHub**：[taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2)
- **與 v1 關係**：本 repo 為綠地 v2；**不**與 v1 共用 Supabase / Redis / Render（見 [docs/INFRA-ISOLATION.md](docs/INFRA-ISOLATION.md)）
- **願景**：[docs/VISION-v2.md](docs/VISION-v2.md)

## 接手本專案？

請從 **[docs/HANDOVER.md](docs/HANDOVER.md)** 開始，並搭配 [CONTEXT.md](CONTEXT.md) 與 [docs/README.md](docs/README.md) 文件索引。  
配圖／試跑問題請直接看 [docs/WVP-ILLUSTRATIONS.md](docs/WVP-ILLUSTRATIONS.md)。

## 架構（M0 已就緒 → M2+ 實作中）

```
apps/web              Studio + API（過渡期仍含 v1 UI，逐步改為 Craft 工作台）
apps/worker           BullMQ：TTS、MP4（Playwright 錄屏規劃中）
packages/presentation WVP 專案路徑與 Storage 約定
packages/craft-agent  章節 Craft 提示詞 + CHAPTER-CRAFT 自檢
packages/core         WvpProject 型別、WVP 五階段鎖
packages/wvp-bridge   主題 token
skills/               web-video-presentation（pnpm sync-wvp）
```

## 快速開始

### 1. 依賴

- Node.js 22+
- pnpm 9+
- **v2 專用** Supabase 專案 + Redis

### 2. 環境變數

複製 [.env.v2.example](.env.v2.example) → `apps/web/.env.local` 與 `apps/worker/.env`。

Storage bucket：**`courseflow-v2-assets`**（私有）。

### 3. 資料庫

```bash
supabase db push
```

至少需包含：

- `20260601000000_v2_wvp_extensions.sql`（`chapter_craft`、`wvp_phase_locks` 等）
- `20260602000000_storage_wvp_dist_mimes.sql`（WVP dist MIME）
- `20260603000000_model_prefs.sql`（`user_api_keys.default_model` / `text_model` / `image_model`）

### 4. 安裝與建置

```bash
pnpm install
pnpm dev
```

`pnpm dev` 會透過 Turbo **先編譯** `@courseflow/*` workspace 套件（輸出到各包的 `dist/`），再啟動 Next.js。

若只跑 `next dev` 而沒建置，會出現 `Can't resolve '@courseflow/shared'`。可改用手動：

```bash
pnpm build:packages
pnpm --filter @courseflow/web dev
```

### 5. WVP Skill

```bash
pnpm sync-wvp
```

## v2 產品階段（Studio UI）

| 階段 | 路由 | 說明 |
|------|------|------|
| 文稿內容 | `/projects/:id/content` | 大綱、口播、螢幕內容 |
| 視覺動效 | `/projects/:id/craft` | 章節 Craft、配圖工作室、試執行第 1 章 |
| 語音生成 | `/projects/:id/audio` | TTS → `public/audio/` |
| 預覽匯出 | `/projects/:id/publish` | 打包 WVP、MP4 |

另含 Checkpoint（主題、素材、生圖風格）。各階段可鎖定（`wvp_phase_locks`）。

## 部署

- **沿用既有 courseflow-web 網址（v1→v2 切換）**：[docs/DEPLOY-CUTOVER-courseflow-web.md](docs/DEPLOY-CUTOVER-courseflow-web.md)（可選 `pnpm render:cutover`）
- **新建 Render 服務**：[docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) — Blueprint：`courseflow-v2-web` / `courseflow-v2-worker`

## 文件

| 類型 | 連結 |
|------|------|
| 接手指南 | [docs/HANDOVER.md](docs/HANDOVER.md) |
| 架構 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 配圖管線 | [docs/WVP-ILLUSTRATIONS.md](docs/WVP-ILLUSTRATIONS.md) |
| 完整索引 | [docs/README.md](docs/README.md) |

## 授權

Private — CourseFlow v2
