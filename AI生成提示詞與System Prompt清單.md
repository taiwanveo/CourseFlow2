# AI 生成提示詞與 System Prompt 清單

這份文件整理 CourseFlow v2 目前與 AI 生成有關的主要 prompt 定義點，分成四類：生成文字、生成圖片、生成語音、生成程式碼。

用途：未來在 CourseFlow v2 試用期間，如果需要快速調整生成品質、語氣、版型偏好、輸出格式限制，可以先從這份清單定位。

補充說明：

- 並不是每一類都有名為 `SYSTEM_PROMPT` 的常數。有些地方是「實際 prompt builder」。
- 本文件列出的檔案，已經額外補上維護導向註解，方便日後直接進檔修改。

## 1. 生成文字

| 名稱 | 檔案 | 類型 | 主要用途 | 修改時要注意 |
| --- | --- | --- | --- | --- |
| `OUTLINE_SYSTEM_PROMPT` | `packages/llm/src/prompts.ts` | system prompt | 把課程主題轉成章節大綱 JSON | 會影響章節數、章節命名、整體課程骨架 |
| `buildOutlineUserPrompt()` | `packages/llm/src/prompts.ts` | user prompt builder | 把主題、語言、額外需求灌進大綱生成請求 | 若要補更多上下文，優先改這裡 |
| `SCRIPT_SYSTEM_PROMPT` | `packages/llm/src/prompts.ts` | system prompt | 把大綱轉成逐步 narration / script | 會直接影響口播長度、教學語氣、句型密度 |
| `buildScriptUserPrompt()` | `packages/llm/src/prompts.ts` | user prompt builder | 把章節資料與生成條件送入 script 生成 | 若 script 常缺資訊，先檢查這裡傳入資料是否足夠 |
| `SCREEN_CONTENT_SYSTEM_PROMPT` | `packages/llm/src/prompts.ts` | system prompt | 生成每一步畫面上要顯示的文字內容 | 會影響投影片文字密度與可讀性 |
| `buildScreenContentUserPrompt()` | `packages/llm/src/prompts.ts` | user prompt builder | 將 script 與章節上下文送入 screen content 生成 | 若想讓畫面文案更貼近口播，通常也要看這裡 |
| `MARKDOWN_TO_COURSE_SYSTEM_PROMPT` | `packages/llm/src/prompts.ts` | system prompt | 把已存在的 Markdown 教材轉成 Course JSON | 適合調整 markdown 匯入規則、章節切法 |
| `buildMarkdownToCourseUserPrompt()` | `packages/llm/src/prompts.ts` | user prompt builder | 將 markdown 原文與限制條件注入模型 | 若 markdown 匯入失真，先看這裡 |
| `ARTICLE_GENERATION_SYSTEM_PROMPT` | `packages/llm/src/generate-article.ts` | system prompt | 從題目/需求直接生成教學文章 Markdown | 會影響 trial 期自動生教材的整體品質 |
| `generateTeachingArticle()` | `packages/llm/src/generate-article.ts` | 執行入口 | 用 provider + system/user messages 真正發送生文稿請求 | 若要換模型或調 provider 行為，也要看這裡 |

### 文字生成維護建議

- 想改「教材風格、章節結構、口播語氣」：先改 `packages/llm/src/prompts.ts`。
- 想改「從簡短題目直接變成教材」：看 `packages/llm/src/generate-article.ts`。
- 想增加更多控制條件，不要只把 system prompt 寫更長；先檢查對應的 `build*UserPrompt()` 是否缺上下文。

## 2. 生成圖片

| 名稱 | 檔案 | 類型 | 主要用途 | 修改時要注意 |
| --- | --- | --- | --- | --- |
| `buildStepImagePrompt()` | `packages/llm/src/generate-step-image.ts` | 實際 prompt builder | 為單一步驟生成 16:9 教學插圖 prompt | 不是常數，但它就是步驟生圖的核心 prompt 定義點 |
| `generateStepImage()` | `packages/llm/src/generate-step-image.ts` | 執行入口 | 呼叫 OpenAI / OpenRouter 產圖 API | 換模型、provider、尺寸策略時會用到 |
| `buildChapterImagePrompt()` | `packages/llm/src/generate-chapter-image.ts` | 實際 prompt builder | 為整章生成封面 / 背景圖 prompt | 影響章節封面感、背景穩定性與可疊字性 |
| `generateChapterImage()` | `packages/llm/src/generate-chapter-image.ts` | 執行入口 | 真正呼叫章節生圖 API | 若要調 provider 行為或下載流程，也在這裡 |

### 圖片生成維護建議

- 想改「圖片能不能出現文字」：看 `buildStepImagePrompt()` / `buildChapterImagePrompt()` 內的 text policy。
- 想改「預設語系（繁中 / 英文 / 日文 / 簡中）」：同樣在上述 builder 中調整。
- 想改「更像封面、還是更像解說插圖」：優先調整 builder 內對 composition / content-aware 的描述。
- 若上游已有 Visual Director 提供 `imagePromptEn`，`buildStepImagePrompt()` 會優先走該路徑。

## 3. 生成語音

| 名稱 | 檔案 | 類型 | 主要用途 | 修改時要注意 |
| --- | --- | --- | --- | --- |
| `synthesizeSpeech()` | `packages/tts/src/index.ts` | TTS 執行入口 | 把既有 script 純文字交給 TTS provider 產生音訊 | 這裡不負責改寫內容，只負責合成 |
| `getTtsProvider()` / `listTtsModels()` | `packages/tts/src/index.ts` | provider / model 管理 | 決定可用語音 provider 與模型列表 | 想換 voice/model/provider 時看這裡 |

### 語音生成的重要事實

- 目前 CourseFlow v2 沒有獨立的「語音 system prompt」。
- TTS 階段直接接收前一階段生成好的 `script` 文字，然後交給 provider 合成語音。
- 所以若你想改「念出來的句子內容」，要回頭改文字生成 prompt，不是改 TTS。

## 4. 生成程式碼

| 名稱 | 檔案 | 類型 | 主要用途 | 修改時要注意 |
| --- | --- | --- | --- | --- |
| `CHAPTER_CRAFT_SYSTEM_PROMPT` | `packages/craft-agent/src/prompts.ts` | system prompt | 要求模型先規劃每章該用哪種版型與 stepVisuals | 會影響 chapterKind 選擇與每步畫面設計 |
| `buildChapterCraftUserPrompt()` | `packages/craft-agent/src/prompts.ts` | user prompt builder | 將章節內容、narrations、anchor、screen content 注入規劃 prompt | 若版型常選錯，先檢查這裡餵給模型的上下文 |
| `CHAPTER_SOURCE_SYSTEM_PROMPT` | `packages/craft-agent/src/prompts.ts` | system prompt | 要求模型輸出符合規範的章節 TSX / CSS | 這是最接近「AI 生成程式碼」的核心 prompt |
| `buildChapterSourceUserPrompt()` | `packages/craft-agent/src/prompts.ts` | user prompt builder | 把 stepVisuals、narrations、screen contents、theme tokens 注入程式碼生成 | 若輸出程式碼不貼題或版型不對，通常要看這裡 |

### 程式碼生成維護建議

- 想改「模型傾向選哪種版型」：先改 `CHAPTER_CRAFT_SYSTEM_PROMPT`。
- 想改「生成的 TSX / CSS 應遵守哪些規格」：改 `CHAPTER_SOURCE_SYSTEM_PROMPT`。
- 想增加更多素材上下文、anchor 或 theme 資訊：先改對應的 `build*UserPrompt()`。

## 5. 建議閱讀順序

若你之後是要調 prompt，建議照這個順序讀：

1. `packages/llm/src/prompts.ts`
2. `packages/llm/src/generate-article.ts`
3. `packages/llm/src/generate-step-image.ts`
4. `packages/llm/src/generate-chapter-image.ts`
5. `packages/craft-agent/src/prompts.ts`
6. `packages/tts/src/index.ts`

## 6. 修改原則

- 一次只調一個 prompt 區塊，避免連鎖影響難以回溯。
- 先分清楚你要改的是：輸出格式、語氣、版型偏好、圖片風格、還是單純 provider/model。
- 文字與程式碼生成比較依賴 system prompt；圖片生成更常是 builder 文字本身在決定風格。
- 語音內容不是在 TTS 階段決定，而是在上游 script 生成階段決定。