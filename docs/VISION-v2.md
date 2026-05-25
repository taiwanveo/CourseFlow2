# CourseFlow v2 產品願景

> 本 repo（[CourseFlow2](https://github.com/taiwanveo/CourseFlow2)）為 **綠地 v2**，與 v1 CourseFlow **不共用 Supabase / Redis / Render**，亦不匯入 v1 專案資料。

## 一句話

**CourseFlow v2 = 把 [Web Video Presentation Skill](../skills/web-video-presentation/SKILL.md) 產品化的教學動畫工作室**：原文 → `script.md` + `outline.md` → Checkpoint → **AI 章節 Craft（React 動畫）** → TTS（`narrations.ts`）→ 互動預覽 + MP4 錄屏。

## 終局產物

1. **互動 16:9 網頁**（WVP `presentation/`，點擊推進 step）
2. **MP4**（Playwright + `?auto=1`，與互動同一 build）

## 產品階段（WVP 四階段 + Checkpoint）

| 階段 | 說明 |
|------|------|
| 1 內容 | AI 產出口播稿節拍 + outline（對齊 OUTLINE-FORMAT） |
| Checkpoint | 對齊主題、素材、開發模式（A/B/C） |
| 2 Craft | AI 寫各章 `Chapter.tsx` + `narrations.ts`，CHAPTER-CRAFT 自檢 |
| 3 音訊 | 依 `narrations.ts` 合成 `public/audio/...` |
| 4 發布 | 預覽 URL、MP4 匯出（全章 checklist 通過才可匯出） |

## 真相源

- **Step 數與口播對齊**：各章 `narrations.ts`（與 Skill 一致）
- **視覺**：章節程式碼，不是 Konva / `StepVisual` JSON
- **專案檔**：`article.md`、`script.md`、`outline.md` 存 Storage

## 驗收標準

見 [CHAPTER-CRAFT 完工自檢](../skills/web-video-presentation/references/CHAPTER-CRAFT.md) 與 [checklist.schema.json](./checklist.schema.json)。

## 刻意不做（MVP）

- v1 投影片管線（Konva、`defaultVisualForStep`、`hf-bridge` 逐步編譯）——將逐步移除
- v1 專案匯入
- 與 v1 共用雲端資源

## 里程碑

見 repo 內實作進度：`packages/presentation`、`packages/craft-agent`、`packages/core` 的 `wvp-*` 型別。
