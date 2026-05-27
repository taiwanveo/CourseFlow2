# v1 → v2 切換：沿用 courseflow-web 網址與 Supabase / Redis

將既有 Render 服務 **`courseflow-web`**（[Dashboard](https://dashboard.render.com/web/srv-d89h0o6l51nc738edgc0)）改為部署 [taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2)，**保留**：

- 網址：`https://courseflow-web-txjr.onrender.com`
- 現有 Supabase 專案（請自行執行 v2 migrations）
- 現有 Redis（`REDIS_URL` 不變）
- Storage bucket：`courseflow-assets`（v2 程式已使用此名稱）

---

## 一、Supabase（你先做）

在**同一個** Supabase 專案 SQL Editor 或 `supabase db push` 套用本 repo 的 migrations，至少包含：

| 檔案 | 用途 |
|------|------|
| `20260601000000_v2_wvp_extensions.sql` | `chapter_craft`、`wvp_phase_locks` 等 |
| `20260602000000_storage_wvp_dist_mimes.sql` | WVP dist 上傳 MIME |

**Authentication → URL configuration**（若尚未設定）：

- Site URL：`https://courseflow-web-txjr.onrender.com`
- Redirect URLs：`https://courseflow-web-txjr.onrender.com/**`

---

## 二、Render Web：`courseflow-web`

服務 ID：`srv-d89h0o6l51nc738edgc0`

### Settings → Build & Deploy

| 欄位 | 值 |
|------|-----|
| Repository | `https://github.com/taiwanveo/CourseFlow2` |
| Branch | `main` |
| Root Directory | （留空） |
| Runtime | **Docker** |
| Dockerfile Path | `Dockerfile.web` |
| Docker Context | `.` |
| Auto-Deploy | On |

### Environment（在既有變數上**新增或修改**，勿刪除 Supabase/Redis 密鑰）

| 變數 | 值 |
|------|-----|
| `COURSEFLOW_EDITION` | `v2` |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | （維持你現有 v1 值） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | （維持） |
| `SUPABASE_URL` | 與 `NEXT_PUBLIC_SUPABASE_URL` 相同 |
| `SUPABASE_SERVICE_ROLE_KEY` | （維持） |
| `REDIS_URL` | （維持） |
| `API_KEY_ENCRYPTION_SECRET` | （維持，才能讀取已存的 API Key） |

**請勿**在正式環境設定 `COURSEFLOW_INLINE_JOBS=1`（應走 Worker 佇列）。

### 部署

**Manual Deploy → Clear build cache & deploy**（改 `NEXT_PUBLIC_*` 後務必清 cache）。

---

## 三、Render Worker（同名慣例 `courseflow-worker`）

對 **Background Worker** 做相同 Git 設定，Dockerfile 改為：

| 欄位 | 值 |
|------|-----|
| Dockerfile Path | `Dockerfile.worker` |

環境變數與 Web **相同**（至少 `SUPABASE_*`、`REDIS_URL`、`API_KEY_ENCRYPTION_SECRET`、`COURSEFLOW_EDITION=v2`）。

部署後在 Logs 應看到 BullMQ 連線與 `courseflow-v2-*` 佇列消費。

---

## 四、自動化腳本（可選）

若已建立 [Render API Key](https://dashboard.render.com/u/settings#api-keys)：

```powershell
cd C:\Vibe_Coidng_Local\CourseFlow_v2.0.0
$env:RENDER_API_KEY = "rnd_你的金鑰"
$env:RENDER_WEB_SERVICE_ID = "srv-d89h0o6l51nc738edgc0"
# 可選：$env:RENDER_WORKER_SERVICE_ID = "srv-xxxxxxxx"
node scripts/render-cutover.mjs
```

腳本會：改 Git 來源 → 合併 `COURSEFLOW_EDITION=v2` → 觸發 clear-cache 部署。

---

## 五、驗證

1. 開啟 https://courseflow-web-txjr.onrender.com 可登入
2. 建立專案 → 走 **文稿 → Checkpoint → 視覺動效 → 語音 → 預覽匯出**
3. Worker Logs 無 Redis / Supabase 錯誤
4. 匯出 MP4 可排隊並完成

---

## 常見問題

| 現象 | 處理 |
|------|------|
| 建置失敗找不到 `@courseflow/presentation` | 確認已 deploy 最新 `main`（含 Dockerfile.web 修復） |
| 登入失敗 | Supabase Auth 網址、Render 上 `NEXT_PUBLIC_*` 建置時是否存在 |
| 舊 v1 專案不見 | v2 schema 不同，舊資料需遷移或接受重新建立 |
| MP4 一直排隊 | Worker 是否 Live、`REDIS_URL` 是否與 Web 相同 |
