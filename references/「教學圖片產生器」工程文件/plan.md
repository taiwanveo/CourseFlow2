## Plan: 教學圖片產生器 V1

以「新 repo + 選擇性移植」建立 Windows 可雙擊啟動的 Electron Portable 桌面工具。V1 聚焦教材內容轉教學配圖，輸出僅 PNG/JPG，透明背景僅採模型原生能力，不做自動去背與 PDF。架構上建立可擴充的 Provider 標準化層（Adapter + Model Discovery + Capability Filter），首發啟用 4 家 provider（OpenAI、OpenRouter、Gemini、Together），並預留 7 家擴充位。

**Steps**
1. Phase A: 產品範圍凍結與文件基線（阻塞後續）
1.1 產出 PRD v1（功能/非功能/非目標/驗收條件）
1.2 產出技術決策稿（架構、選型理由、風險與替代方案）
1.3 產出需求追蹤矩陣（需求對應到模組、API、畫面、測試）
1.4 產出版本規劃（M0 原型、M1 可用版、M2 穩定版）

2. Phase B: 系統架構與資料設計（依賴 Phase A）
2.1 定義三層架構
2.1.1 Desktop Shell（Electron main/preload）
2.1.2 App Core（Provider、Prompt、Storage、History）
2.1.3 Renderer UI（React + Vite）
2.2 定義資料分類
2.2.1 安全資料：API Key（Windows Credential Manager）
2.2.2 結構化資料：SQLite（設定、模型快取、歷史）
2.2.3 大檔/快取：檔案系統（圖片、模型快照、風格資產）
2.3 定義資料表與索引
2.3.1 app_settings
2.3.2 provider_accounts
2.3.3 provider_model_cache
2.3.4 style_catalog
2.3.5 generation_history
2.3.6 generation_assets
2.3.7 favorite_styles
2.4 定義路徑策略
2.4.1 app/catalog（內建 BananaX）
2.4.2 data/app.db（SQLite）
2.4.3 data/cache/models（模型快取）
2.4.4 data/cache/generated（暫存圖片）
2.4.5 data/exports（輸出）

3. Phase C: Provider 標準化層（依賴 Phase B）
3.1 定義統一型別
3.1.1 ProviderId
3.1.2 NormalizedModel
3.1.3 ModelCapability
3.1.4 GenerateImageInput/Output
3.2 定義 Adapter 介面
3.2.1 listModels()
3.2.2 normalizeModels()
3.2.3 generateImage()
3.3 實作 Model Discovery Pipeline
3.3.1 拉取原始模型清單
3.3.2 provider-specific parser
3.3.3 capability inference
3.3.4 local override rules（allowlist/denylist）
3.4 實作 Capability Filter
3.4.1 僅顯示 imageGeneration=true
3.4.2 transparentBackground 控制 UI enable/disable
3.4.3 customSize 能力降級策略
3.5 首發 provider 落地（可平行）
3.5.1 OpenAI Adapter
3.5.2 OpenRouter Adapter
3.5.3 Gemini Adapter
3.5.4 Together Adapter
3.6 預留 provider 骨架（平行）
3.6.1 Anthropic
3.6.2 xAI
3.6.3 Mistral
3.6.4 Replicate

4. Phase D: BananaX 風格系統（可與 Phase C 平行）
4.1 移植目錄與資產同步腳本
4.2 建立 style_catalog 匯入流程
4.3 兩層式 UI
4.3.1 第一層：搜尋/分類/過濾 + 中尺寸完整預覽
4.3.2 第二層：大圖 + 說明 + 完整提示詞 + 套用
4.4 效能策略
4.4.1 圖片 lazy loading
4.4.2 catalog cache version
4.4.3 搜尋索引（title/tags/id）

5. Phase E: 生成流程與輸出（依賴 Phase C + D）
5.1 Prompt 組裝鏈
5.1.1 教材內容摘要（teaching brief）
5.1.2 使用者附加提示
5.1.3 BananaX stylePrompt
5.1.4 輸出限制（尺寸/格式/透明）
5.2 生成流程
5.2.1 provider/model resolve
5.2.2 generateImage 呼叫
5.2.3 回傳正規化（bytes/url）
5.2.4 PNG/JPG 儲存與下載
5.3 透明策略
5.3.1 僅當模型 capability 支援時可開啟
5.3.2 若不支援則 UI 明確禁用並提示
5.4 歷史與可追溯
5.4.1 儲存 final prompt
5.4.2 儲存模型/provider/尺寸/格式
5.4.3 儲存透明是否請求與是否生效

6. Phase F: 桌面化與本機安全（依賴 Phase B）
6.1 Electron main/preload IPC 邊界
6.1.1 credential IPC
6.1.2 filesystem IPC
6.1.3 db IPC
6.2 Windows Credential Manager 整合
6.2.1 寫入 Key
6.2.2 讀取 Key
6.2.3 刪除 Key
6.2.4 has_credential 狀態回報
6.3 Electron Portable 打包策略
6.3.1 免安裝啟動
6.3.2 資料目錄初始化
6.3.3 自動更新（可延後到 M2）

7. Phase G: UI/UX 全流程（依賴 C/D/E/F）
7.1 主工作台
7.1.1 教材輸入
7.1.2 provider/model 選擇
7.1.3 尺寸預設 + 自訂寬高
7.1.4 格式選擇（PNG/JPG）
7.1.5 透明開關（能力驅動）
7.1.6 生成按鈕與 loading/error
7.2 設定頁
7.2.1 provider 啟用
7.2.2 API Key 管理
7.2.3 模型清單刷新
7.2.4 預設模型偏好
7.3 結果頁
7.3.1 圖片預覽
7.3.2 下載
7.3.3 final prompt 展開
7.3.4 重新生成（沿用參數）
7.4 歷史頁
7.4.1 可重開歷史
7.4.2 搜尋與過濾
7.4.3 清理快取

8. Phase H: 測試、驗收、發佈（依賴 G）
8.1 單元測試
8.1.1 capability inference
8.1.2 model filter
8.1.3 prompt composition
8.2 整合測試
8.2.1 provider listModels
8.2.2 generateImage path（url/bytes）
8.2.3 credential read/write/delete
8.3 E2E 測試
8.3.1 首次啟動到首張圖片
8.3.2 BananaX 兩層頁導航
8.3.3 透明開關 enable/disable 行為
8.4 發佈檢查清單
8.4.1 portable 包可雙擊
8.4.2 無需安裝外部依賴
8.4.3 離線可讀本地 catalog

**Relevant files（現有專案可參考/移植來源）**
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\scripts\build-bananax-catalog.mjs — BananaX 目錄構建與預覽圖鏡像流程
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\apps\web\src\data\image-style-catalog.ts — BananaX 型別與欄位定義
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\apps\web\src\hooks\useBananaxCatalog.ts — 前端載入與快取模式
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\apps\web\src\components\ImageStylePickerModal.tsx — 風格選擇 UI 雛形（需重構為兩層頁）
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\apps\web\src\app\api\settings\models\list\route.ts — 模型清單與能力過濾基礎邏輯
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\packages\llm\src\generate-step-image.ts — 生圖 provider 呼叫與 prompt 組裝參考
- c:\Vibe_Coidng_Local\CourseFlow_v2.0.0\packages\llm\src\types.ts — provider 型別起點

**Verification**
1. 功能驗收
1.1 可在 Windows 直接雙擊啟動 Portable 執行檔
1.2 可設定 4 家 provider API Key 並持久化於系統安全儲存
1.3 每家 provider 可成功拉模型清單
1.4 UI 僅顯示 imageGeneration 模型
1.5 可完成 PNG/JPG 生成、預覽、下載
1.6 僅在支援透明模型時可勾選透明輸出
1.7 BananaX 兩層式頁面可完成搜尋、查看、套用
2. 穩定性驗收
2.1 provider API 錯誤可回傳明確可讀訊息
2.2 模型清單快取失效/刷新機制可運作
2.3 無 API Key 狀態下流程可被清楚攔截
3. 效能驗收
3.1 首次開啟 < 5 秒（不含模型拉取）
3.2 BananaX 列表滾動不卡頓
3.3 首次模型刷新可在可接受時間內完成

**Decisions**
- 輸出僅 PNG/JPG；不做 PDF。
- 透明背景僅模型原生能力；不做去背。
- 新 repo，不延續 CourseFlow monorepo 產品流程。
- API Key 不存 Supabase，改存 Windows Credential Manager。
- 標準化層必做；首發啟用 4 家 provider，架構預留 7 家。

**Further Considerations**
1. Provider 啟用策略
Option A：首發只顯示 4 家（推薦）。
Option B：UI 顯示 7 家但標註「即將支援」。
Option C：全部隱藏在實驗設定。
2. BananaX 更新策略
Option A：打包內建固定版本（推薦）。
Option B：啟動時嘗試線上更新。
Option C：提供手動更新按鈕。
3. 模型能力標記可信度
Option A：官方欄位 + 本地 override（推薦）。
Option B：純官方欄位（風險高）。
Option C：純手工清單（維護成本高）。

## 補充文件包（建議一併建立於新專案）

### 文件 1: PRD-v1.md
- 產品目標、成功指標、MVP 範圍、非目標
- 使用者旅程與主要情境
- 功能需求（FR）與非功能需求（NFR）
- 驗收標準（UAT）

### 文件 2: TECH-DECISIONS-v1.md
- 為何 Electron Portable + React + Vite
- 為何 Windows Credential Manager + SQLite
- Provider 標準化層設計與替代方案
- 風險清單與緩解策略

### 文件 3: DATA-SCHEMA-v1.md
- SQLite DDL（表、索引、關聯）
- 欄位語義與資料生命週期
- 快取清理策略

### 文件 4: PROVIDER-ADAPTER-SPEC-v1.md
- Adapter 介面與錯誤模型
- NormalizedModel 與 capability 規則
- 各 provider mapping 規則

### 文件 5: UI-FLOW-WIREFRAME-v1.md
- 首頁、設定頁、BananaX 第一層/第二層、結果頁、歷史頁
- 狀態機與 loading/error/success 分支

### 文件 6: IMPLEMENTATION-ROADMAP-v1.md
- 里程碑（M0/M1/M2）
- 任務拆解與依賴圖
- 工期估算與人力配置

### 文件 7: TEST-PLAN-v1.md
- 單元/整合/E2E 測試矩陣
- 測試資料與模擬策略
- 回歸測試清單

### 文件 8: RELEASE-CHECKLIST-v1.md
- 打包檢查
- 安全檢查
- 可用性驗收
- 發佈與回滾流程
