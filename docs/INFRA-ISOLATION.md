# v2 與 v1 運維隔離

**v2 不應影響 v1 正常運作。** 請為 v2 **新建**下列資源，勿在 v1 的 Supabase 上跑破壞性 migration。

## 必須新建

| 資源 | v2 建議名稱 |
|------|-------------|
| GitHub | [taiwanveo/CourseFlow2](https://github.com/taiwanveo/CourseFlow2) |
| Supabase | 新專案，例如 `courseflow-v2` |
| Storage bucket | `courseflow-v2-assets` |
| Redis / Upstash | 新 instance 或獨立 DB |
| BullMQ 佇列 | `courseflow-v2-*`（見 `packages/shared/src/queue-names.ts`） |
| Render Web | `courseflow-v2-web`（見 `render.yaml`） |
| Render Worker | `courseflow-v2-worker` |
| 網域 | 例如 `v2.your-domain.com` |

## 環境變數

複製 [.env.v2.example](../.env.v2.example) 為 `apps/web/.env.local` 與 `apps/worker/.env`，**全部指向 v2 專用 Supabase / Redis**。

```bash
COURSEFLOW_EDITION=v2
```

## 本機

| 版本 | Port 建議 | env 檔 |
|------|-----------|--------|
| v1 | 3000 | v1 repo 的 `.env.local` |
| v2 | 3001 | 僅填 v2 Supabase URL |

## 部署

1. 在 Supabase 建立新專案 → Dashboard SQL 或 `supabase db push` 套用 `supabase/migrations/*`
2. 建立 Storage bucket `courseflow-v2-assets`（私有）
3. Render：連結 CourseFlow2 repo，使用本 repo 的 `render.yaml`
4. 勿將 v2 環境變數貼到 v1 Render 服務

詳見 [DEPLOY-RENDER.md](./DEPLOY-RENDER.md)（部署步驟與 v1 文件相同，服務名已改為 v2）。
