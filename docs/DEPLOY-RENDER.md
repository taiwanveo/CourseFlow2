# 將 CourseFlow v2 部署到 Render

本 repo 為 **[taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2)**（與 v1 `CourseFlow` **分開**）。請勿與 v1 共用 Supabase / Redis，見 [INFRA-ISOLATION.md](./INFRA-ISOLATION.md)。

專案已包含 `render.yaml`（Blueprint）、`Dockerfile.web`、`Dockerfile.worker`，可一次建立 **Web** 與 **Worker** 兩個服務。

## 架構（Render 上）

| 服務 | 說明 |
|------|------|
| `courseflow-v2-web` | Next.js（standalone），對外 HTTPS |
| `courseflow-v2-worker` | BullMQ + TTS + HyperFrames MP4（過渡期；v2 將改 Playwright 錄屏） |
| **Supabase**（外部，**v2 專用專案**） | Postgres、Auth、Storage |
| **Redis**（外部，**v2 專用**） | 佇列；`REDIS_URL` 勿與 v1 相同 instance |

## 前置條件檢查清單

### 1. Git 遠端（必要）

Render **必須**從 GitHub 拉程式碼。本 repo 遠端應為：

```bash
cd CourseFlow_v2.0.0   # 或你的本機資料夾名稱
git remote -v
# 應指向 https://github.com/taiwanveo/CourseFlow2.git
```

若尚未設定：

```bash
git init
git add .
git commit -m "Initial commit for Render deploy"
git remote add origin https://github.com/taiwanveo/CourseFlow2.git
git branch -M main
git push -u origin main
```

> **注意**：v1 是 `CourseFlow`（沒有 2）；v2 是 **`CourseFlow2`**，兩個 repo、兩套 Render 服務。

### 2. Supabase（必要，v2 新專案）

- 在 **新的** Supabase 專案執行 `supabase/migrations/*.sql`
- 至少確認已套用下列 migration：
   - `20260601000000_v2_wvp_extensions.sql`
   - `20260602000000_storage_wvp_dist_mimes.sql`
   - `20260603000000_model_prefs.sql`
- Storage bucket：**`courseflow-v2-assets`**（私有）— 不是 v1 的 `courseflow-assets`
- **Authentication → URL configuration** 新增 Render 網域（見 §5）

### 3. Redis（必要，建議 v2 新 instance）

- 在 Render 兩個服務都設定 **v2 專用** 的 `REDIS_URL`
- Upstash 建議 `rediss://`；本專案會將 `redis://*.upstash.io` 升級為 `rediss://`
- BullMQ 佇列前綴為 `courseflow-v2-*`（與 v1 的 `courseflow-*` 分開）

### 4. 環境變數（建置與執行）

> **登入失敗常見原因**：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 必須在 **Docker 建置當下** 就存在。僅在執行階段補設而未重新 deploy，前端 Supabase 客戶端會是空的。

建議在 Render 額外設定：

| 變數 | 說明 |
|------|------|
| `COURSEFLOW_EDITION` | `v2`（`render.yaml` 已預設） |

### 5. Supabase Auth 網址（登入必設）

在 **v2 Supabase** Dashboard → **Authentication → URL configuration**：

- **Site URL**：`https://<你的-courseflow-v2-web>.onrender.com`
- **Redirect URLs**：`https://<你的-courseflow-v2-web>.onrender.com/**`

若使用 Email 註冊且開啟「Confirm email」，需先到信箱點確認信才能登入。

### 6. 機密環境變數清單

| 變數 | Web | Worker | 說明 |
|------|:---:|:---:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | | v2 Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | | Anon key |
| `SUPABASE_URL` | ✓ | ✓ | 通常與上面 URL 相同 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | **機密** |
| `REDIS_URL` | ✓ | ✓ | **v2 專用** Redis |
| `API_KEY_ENCRYPTION_SECRET` | ✓ | ✓ | **v2 專用** 隨機字串（≥32 字元），勿與 v1 相同 |
| `COURSEFLOW_INLINE_JOBS` | 可選 | — | `1` = 強制不走佇列 |
| `COURSEFLOW_FORCE_QUEUE` | 可選 | 可選 | `1` = 強制入隊 |

**佇列自動切換**：Web 讀 Redis 鍵 `courseflow:worker:heartbeat`。無 Worker 心跳時 TTS 改 Web inline；MP4 仍須 `courseflow-v2-worker`。

**Edge-TTS**：`apps/web` 需 `edge-tts-universal`，`next.config.ts` 設 `outputFileTracingRoot` 指向 monorepo 根目錄。

**WVP 視覺動效**：`試執行第 1 章` 會從 `packages/wvp-bridge/vendor/web-video-presentation/templates` 複製 Vite 模板；`Dockerfile.web` 與 `outputFileTracingIncludes` 必須一併帶上 vendor，否則會出現 `ENOENT … vite.config.ts`。建置時會在 presentation 目錄執行 `npm install`，需設定可寫入的 `HOME`／`NPM_CONFIG_CACHE`（勿讓系統使用者落在 `/nonexistent`，否則 `EACCES … mkdir '/nonexistent'`）。容器若為 `NODE_ENV=production`，須以 `--include=dev` 安裝依賴，否則 `vite: not found`。

**預覽匯出打包**：Render HTTP 請求約 30 秒逾時，完整課程 Vite 建置會改為 **背景任務**（`job_runs` + 前端輪詢）。Web 服務請設 `COURSEFLOW_ASYNC_WVP_BUILD=1`（`render.yaml` 已預設）；生產環境 `NODE_ENV=production` 也會自動走非同步。若仍見 HTTP 502：① 確認已重新 deploy 最新版 ② 勿設 `COURSEFLOW_INLINE_WVP_BUILD=1` ③ Dashboard 手動補上上述變數後 Clear build cache & deploy。本機同步打包：`COURSEFLOW_INLINE_WVP_BUILD=1`。

變更後請 **Clear build cache & deploy**。

> 變更任一 `NEXT_PUBLIC_*` 後請 **Clear build cache & deploy**。

## 部署方式 A：Blueprint（建議）

> **若 Dashboard 顯示「Production is empty」**：代表只建了空的 **Project**，尚未從 GitHub 套用 `render.yaml`。請依下列步驟操作，完成後才會出現 `courseflow-v2-web` / `courseflow-v2-worker`。

1. 確認 `render.yaml` 已 push 到 `main`（根目錄含 `projects: CourseFlow2`）
2. 開啟（建議用此連結，不要只建空白 Project）：
   ```
   https://dashboard.render.com/blueprint/new?repo=https://github.com/taiwanveo/CourseFlow2
   ```
3. 連結 GitHub OAuth，選分支 `main`，Render 會讀取根目錄 `render.yaml`
4. 預覽應顯示 **2 個服務**（web + worker）與 **1 個 env group**（`courseflow-v2-shared`）
5. 為所有 `sync: false` 的變數填入 **v2** Supabase / Redis / 加密密鑰（見下方表格）
6. 點 **Apply**（套用），等待 `courseflow-v2-web` 與 `courseflow-v2-worker` 出現在 **CourseFlow2 → Production** 且狀態為 **Live**

若已存在空的 CourseFlow2 Project：仍請用上方 Blueprint 連結；套用後服務會依 `render.yaml` 的 `projects.name: CourseFlow2` 歸入該專案。

首次 Docker build 可能需 **15–25 分鐘**。

## 部署方式 B：Cursor Render MCP

若要在 Cursor 內用 MCP 查狀態：

1. API Key：https://dashboard.render.com/u/settings#api-keys
2. 在 `~/.cursor/mcp.json` 設定 Render MCP（見 Render 文件）
3. 完整雙服務部署仍建議用 Blueprint（方式 A）

## 驗證

1. 開啟 `https://<courseflow-v2-web>.onrender.com`，登入
2. 建立專案 → 文稿 → 語音 → 視覺（Craft 工作台 M2 起逐步取代 Konva）
3. Dashboard → `courseflow-v2-worker` → **Logs**

## 常見問題

| 現象 | 處理 |
|------|------|
| Web build 失敗 | Docker build log；確認 `pnpm-lock.yaml` 已 commit |
| 登入後跳轉錯誤 | **v2** Supabase Auth URL 是否含 Render 網域 |
| 匯出一直排隊 | `courseflow-v2-worker` 是否 Live、`REDIS_URL` 是否為 v2 |
| 誤連到 v1 資料 | 檢查 env 是否仍指向 v1 Supabase URL |
| Worker 402 | Render 需付款方式才能建 Background Worker |
| 設定頁顯示 `default_model` schema cache 錯誤 | Supabase 尚未套用 `20260603000000_model_prefs.sql` |

## 費用參考

- Web + Worker：依 Render 方案
- Supabase、Upstash：**v2 各開新專案** 的免費額度

## 本機開發

見根目錄 [README.md](../README.md) 與 [.env.v2.example](../.env.v2.example)。
