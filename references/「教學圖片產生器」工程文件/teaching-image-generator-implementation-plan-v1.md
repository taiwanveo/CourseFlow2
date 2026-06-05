# 教學圖片產生器 超詳細實作計畫 v1

## A. 實作總覽
本計畫以「先打通、再擴充、後穩定」執行：
1. 先建立 Electron Portable + React + Vite 可運作骨架。
2. 再導入 Provider 標準化層與 BananaX 兩層式風格系統。
3. 最後做驗收、測試與發佈流程。

## B. 里程碑
### M0: 可執行骨架（1-1.5 週）
1. Electron 主程序 + preload + renderer 通訊。
2. SQLite 初始化與 migration 框架。
3. Windows Credential Manager 封裝。
4. 單一 provider（OpenAI）生成打通。
5. 基本主頁（輸入、生成、結果）。

### M1: 核心功能完成（2-3 週）
1. 4 家 provider adapter 完成。
2. Model Discovery + Capability Filter 完成。
3. BananaX 目錄移植與兩層式 UI 完成。
4. 尺寸預設/自訂與 PNG/JPG 輸出完成。
5. 透明能力開關與禁用規則完成。
6. 歷史記錄與重開結果完成。

### M2: 穩定與發佈（1-1.5 週）
1. 錯誤碼與錯誤文案統一。
2. 快取策略與清理策略完善。
3. 單元/整合/E2E 測試補齊。
4. Portable 打包驗收與發佈清單。

## C. 模組拆解
## C1. Desktop Shell
1. main process
1.1 視窗生命週期
1.2 app data 目錄初始化
1.3 IPC 註冊
2. preload
2.1 安全白名單 API 暴露
2.2 禁止 renderer 直接 Node API
3. renderer
3.1 React app bootstrap
3.2 route/state/query 管理

## C2. Storage Layer
1. CredentialStore
1.1 setCredential(provider, key)
1.2 getCredential(provider)
1.3 deleteCredential(provider)
1.4 hasCredential(provider)
2. DatabaseStore
2.1 migration runner
2.2 query/repository 封裝
3. FileStore
3.1 cache read/write
3.2 export read/write
3.3 hash-based file naming（避免覆蓋）

## C3. Provider Layer
1. AdapterRegistry
2. ProviderAdapter interface
3. ModelDiscoveryService
4. CapabilityFilterService
5. ImageGenerationService
6. Provider error mapping

## C4. Style Layer
1. BananaXCatalogLoader
2. CatalogUpdateService（可先手動）
3. StyleSearchService
4. StyleDetailService
5. StyleSelectionState

## C5. Prompt Layer
1. TeachingBriefBuilder
2. FinalPromptComposer
3. PromptPolicyValidator

## D. Provider 標準化詳細規格
## D1. 統一能力欄位
1. imageGeneration: boolean
2. transparentBackground: boolean | undefined
3. customSize: boolean | undefined
4. maxSizeHint: string | undefined

## D2. Discovery Pipeline
1. fetchRawModels(provider)
2. parseRawModels(provider, raw)
3. inferCapabilities(provider, parsed)
4. applyLocalOverrides(provider, models)
5. persist provider_model_cache
6. return normalized list

## D3. Capability Filter 規則
1. 顯示清單：imageGeneration=true。
2. 透明開關：transparentBackground=true 才 enable。
3. 自訂尺寸：customSize=true 才直接傳；否則映射預設尺寸。
4. 模型不可用（deprecated/inactive）預設隱藏或降階顯示。

## D4. 錯誤模型
1. AUTH_INVALID
2. AUTH_MISSING
3. MODEL_NOT_FOUND
4. MODEL_NOT_IMAGE_CAPABLE
5. PROVIDER_RATE_LIMIT
6. PROVIDER_TIMEOUT
7. PROVIDER_BAD_RESPONSE
8. NETWORK_ERROR

## E. BananaX 兩層式 UI 規格
## E1. 第一層（探索）
1. 搜尋框：title/id/tags。
2. 分類篩選：all/top/business（可擴充）。
3. 卡片顯示：中尺寸完整圖 + 標題 + 分數 + 標籤。
4. 點擊卡片：進入第二層。

## E2. 第二層（詳情）
1. 大圖預覽。
2. 風格描述與標籤。
3. 完整 stylePrompt 文字。
4. 套用按鈕。
5. 返回列表按鈕。

## E3. 效能
1. 列表圖 lazy load。
2. catalog 索引預建。
3. 虛擬列表（若資料量持續增長）。

## F. 生成流程細節
1. 收集輸入
1.1 sourceText
1.2 userInstruction
1.3 selectedStyle
1.4 provider/model
1.5 width/height
1.6 format
1.7 transparentRequested
2. 生成 teachingBrief
3. 組合 finalPrompt
4. 依模型能力校正參數
5. 呼叫 adapter.generateImage
6. 寫入檔案與歷史
7. 回傳 renderer 顯示

## G. SQLite 資料表（欄位級）
## G1. app_settings
- id, language, theme, default_provider, default_format, default_width, default_height, created_at, updated_at

## G2. provider_accounts
- provider_id, enabled, has_credential, preferred_image_model_id, last_model_sync_at, created_at, updated_at

## G3. provider_model_cache
- provider_id, model_id, name, status, supports_image, supports_transparent_bg, supports_custom_size, raw_json, synced_at
- index(provider_id, supports_image)

## G4. style_catalog
- style_id, title_zh, title_en, tags_json, category, score, thumbnail_path, preview_path, prompt_text, source, updated_at
- index(category, score)

## G5. generation_history
- id, created_at, provider_id, model_id, style_id, source_text, user_instruction, teaching_brief, final_prompt, width, height, output_format, transparent_requested, transparent_applied, status, error_message
- index(created_at desc)

## G6. generation_assets
- id, history_id, variant_index, file_path, mime_type, width, height, has_alpha, file_size, created_at
- index(history_id)

## H. IPC 介面清單
1. credentials:set/get/delete/has
2. providers:listModels/getCachedModels
3. generators:generateImage
4. styles:list/search/getDetail/apply
5. history:list/get/delete
6. files:openExportFolder/saveImage

## I. 測試計畫
## I1. 單元
1. capability inference
2. prompt composition
3. local override rules
4. size fallback rules

## I2. 整合
1. credential store + provider registry
2. model discovery + cache write/read
3. generate image + history persistence

## I3. E2E
1. 首次啟動到首張生圖
2. BananaX 第一層到第二層套用
3. 透明能力有/無兩條路徑
4. provider 切換與模型刷新

## J. 發佈與運維
1. Portable 包檢查
2. 憑證與敏感資訊掃描
3. 例外崩潰日志位置
4. 常見錯誤 FAQ

## K. 任務拆解（可直接轉 issue）
1. 建立 desktop shell 與 IPC 骨架
2. 建立 SQLite 與 migration
3. 建立 CredentialStore（Windows）
4. 實作 ProviderAdapter 介面與 registry
5. 實作 OpenAI Adapter
6. 實作 OpenRouter Adapter
7. 實作 Gemini Adapter
8. 實作 Together Adapter
9. 實作 Model Discovery + Capability Filter
10. 移植 BananaX catalog 與 loader
11. 實作 BananaX 第一層頁面
12. 實作 BananaX 第二層頁面
13. 實作生成頁與結果頁
14. 實作歷史頁與檔案輸出
15. 補齊測試與 release checklist

## L. 風險緩解
1. 模型能力漂移：以本地 override 規則快速修補。
2. provider API 變更：adapter 層隔離衝擊。
3. 透明能力不穩定：以 capability gate 嚴格控 UI。
4. 資料膨脹：定期快取清理與歷史清理策略。
