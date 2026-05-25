# 將 CourseFlow 部署到 Render

本專案已包含 `render.yaml`（Blueprint）、`Dockerfile.web`、`Dockerfile.worker`，可一次建立 **Web** 與 **Worker** 兩個服務。

## 架構（Render 上）

| 服務 | 說明 |
|------|------|
| `courseflow-web` | Next.js（獨立輸出 standalone），對外 HTTPS |
| `courseflow-worker` | BullMQ 消費者 + TTS + HyperFrames MP4 渲染 |
| **Supabase**（外部） | Postgres、Auth、Storage — 不在 Render 建立 |
| **Redis**（外部或 Render） | 佇列用；預設用你自備的 `REDIS_URL`（例如 Upstash） |

## 前置條件檢查清單

### 1. Git 遠端（必要）

Render **必須**從 GitHub / GitLab / Bitbucket 拉程式碼。本機目前若尚未 `git init`，請先：

```bash
cd CourseFlow
git init
git add .
git commit -m "Initial commit for Render deploy"
# 在 GitHub 建立空 repo 後：
git remote add origin https://github.com/<你的帳號>/CourseFlow.git
git branch -M main
git push -u origin main
```

### 2. Supabase（必要）

- 已在 Supabase 執行 `supabase/migrations/*.sql`
- Storage bucket：`courseflow-assets`（私有）
- **Authentication → URL configuration** 新增（見下方 §5，網域以 Render 實際 URL 為準）

### 3. Redis（必要）

- 沿用 **Upstash**（或其他 Redis）：在 Render 兩個服務都設定相同的 `REDIS_URL`
- Upstash 建議使用 `rediss://` TLS 網址；本專案會自動將 `redis://*.upstash.io` 升級為 `rediss://`

### 4. 機密環境變數（部署時在 Dashboard 填寫）

> **登入失敗常見原因**：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 必須在 **Docker 建置當下** 就存在（會被編進前端 JS）。僅在執行階段設定而沒有重新 deploy，瀏覽器端的 Supabase 客戶端會是空的，表現為「登入後立刻被踢回登入頁」或無法登入。修改 `Dockerfile.web` 後需 **Clear build cache & deploy** 一次。

### 5. Supabase Auth 網址（登入必設）

在 Supabase Dashboard → **Authentication → URL configuration**：

- **Site URL**：`https://courseflow-web-txjr.onrender.com`（以你實際 Render 網域為準）
- **Redirect URLs**：`https://courseflow-web-txjr.onrender.com/**`

若使用 Email 註冊且開啟「Confirm email」，需先到信箱點確認信才能登入。

### 6. 機密環境變數清單

| 變數 | Web | Worker | 說明 |
|------|:---:|:---:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | | 與 Supabase 專案 URL 相同 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | | Anon key |
| `SUPABASE_URL` | ✓ | ✓ | 通常與上面 URL 相同 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | **機密**，僅伺服器 |
| `REDIS_URL` | ✓ | ✓ | BullMQ 連線字串 |
| `COURSEFLOW_INLINE_JOBS` | 可選 | — | 設 `1` 強制 TTS／渲染不走佇列（本機省 Redis） |
| `COURSEFLOW_FORCE_QUEUE` | 可選 | 可選 | 設 `1` 強制入隊（略過 Worker 心跳檢查，除錯用） |

**佇列自動切換**：Web 會讀 Redis 鍵 `courseflow:worker:heartbeat`。Worker 每 15 秒更新；若逾時未見心跳，TTS 改在 Web 內 **inline** 同步完成（僅 Web 上線時可用）。MP4 匯出仍須部署 `courseflow-worker`。

**Edge-TTS 部署**：`apps/web` 需直接依賴 `edge-tts-universal`，且 `next.config.ts` 設 `outputFileTracingRoot` 指向 monorepo 根目錄，否則 Docker standalone 執行時會 `Cannot find module 'edge-tts-universal'`。
| `API_KEY_ENCRYPTION_SECRET` | ✓ | ✓ | **生產環境請換成長隨機字串**（≥32 字元） |

> `NEXT_PUBLIC_SUPABASE_URL` 與 `SUPABASE_URL` 在 Web 服務都要設，否則 middleware 與 admin API 可能失敗。  
> 變更任一 `NEXT_PUBLIC_*` 後請在 Render 觸發 **重新部署**（建議 Clear build cache）。

## 部署方式 A：Blueprint（建議）

1. 確認 `render.yaml` 已 push 到 `main`
2. 開啟（替換成你的 repo）：
   ```
   https://dashboard.render.com/blueprint/new?repo=https://github.com/<帳號>/CourseFlow
   ```
3. 連結 GitHub OAuth，套用 Blueprint
4. 為標記 `sync: false` 的變數填入上表數值
5. 點 **Apply**，等待兩個服務都 **Live**

首次 Docker build 可能需 **15–25 分鐘**（monorepo + Next standalone + worker 依賴）。

## 部署方式 B：Cursor Render MCP

若要在 Cursor 內用 MCP 查狀態、建 Key Value 等：

1. 建立 API Key：https://dashboard.render.com/u/settings#api-keys
2. 在 `~/.cursor/mcp.json` 加入：

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <你的 Render API Key>"
      }
    }
  }
}
```

3. 重啟 Cursor，在對話中說：「Set my Render workspace to \<工作區名稱\>」
4. 注意：MCP **無法**建立 Docker Worker，也**無法**代替 Blueprint 一次建雙服務；完整部署仍建議用方式 A。

## 驗證

1. 開啟 `https://<courseflow-web>.onrender.com`，登入
2. 建立專案 → 文稿 → 語音 → 視覺 → **匯出 MP4**
3. Render Dashboard → `courseflow-worker` → **Logs**，應看到 `[render]` / `[hyperframes]` 日誌

## 常見問題

| 現象 | 處理 |
|------|------|
| Web build 失敗 | 檢查 Docker build log；確認 `pnpm-lock.yaml` 已 commit |
| 登入後跳轉錯誤 | Supabase Auth URL / Redirect 是否含 Render 網域 |
| 匯出一直排隊 | Worker 是否 Live、`REDIS_URL` 兩邊是否一致 |
| Worker OOM / 渲染失敗 | 將 worker `plan` 改為 `standard`（更多記憶體） |
| 15 分鐘無人使用 Web 變慢 | Starter 會休眠；可改 Standard 或接受冷啟動 |

## 費用與方案限制

| 服務 | Free 方案 | Starter 以上 |
|------|-----------|--------------|
| **Web**（Docker） | 可建立（會休眠） | 建議正式環境 |
| **Worker**（背景服務） | **不支援** | **必須**綁定付款方式 |

若 API 回傳 `402 Payment information is required`，請到 [Render Billing](https://dashboard.render.com/billing) 新增信用卡後，再建立 `courseflow-worker`（或套用 Blueprint）。

## 費用參考（約略）

- Web `free` / `starter` + Worker `starter`：依 Render 定價計費
- Supabase、Upstash：各服務自有免費額度

## 本機無法由 Agent 代完成的項目

- 建立 GitHub repo 並 push（需你的帳號權限）
- Render Dashboard 填入機密變數
- Supabase Auth / Storage 後台設定
- Render MCP API Key 授權（目前回報 `unauthorized` 時需你先設定）

完成上述項目後，把 Blueprint 部署結果或錯誤 log 貼給我，可再協助排查。
