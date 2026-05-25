# CourseFlow v2

**教學動畫工作室** — 內建 [Web Video Presentation](skills/web-video-presentation/SKILL.md) 方法論：章節級 React 動畫、互動 16:9 預覽、MP4 錄屏匯出。

- **GitHub**：[taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2)
- **與 v1 關係**：本 repo 為綠地 v2；**不**與 v1 共用 Supabase / Redis / Render（見 [docs/INFRA-ISOLATION.md](docs/INFRA-ISOLATION.md)）
- **願景**：[docs/VISION-v2.md](docs/VISION-v2.md)

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

含 `20260601000000_v2_wvp_extensions.sql`（`chapter_craft`、`wvp_phase_locks` 等）。

### 4. 安裝與建置

```bash
pnpm install
pnpm --filter @courseflow/core build
pnpm --filter @courseflow/shared build
pnpm --filter @courseflow/presentation build
pnpm --filter @courseflow/craft-agent build
pnpm --filter @courseflow/wvp-bridge build
pnpm --filter @courseflow/llm build
pnpm dev
```

### 5. WVP Skill

```bash
pnpm sync-wvp
```

## v2 產品階段（目標）

| 階段 | 說明 |
|------|------|
| 內容 | `script.md` + `outline.md`（WVP 節拍） |
| Checkpoint | 主題、素材、開發模式 |
| Craft | AI 章節 `Chapter.tsx` + `narrations.ts` |
| 音訊 | TTS 對 narrations |
| 發布 | 互動預覽 + MP4 |

## 部署

[docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) — Blueprint 服務名：`courseflow-v2-web` / `courseflow-v2-worker`。

## 授權

Private — CourseFlow v2
