import type { GeneratedChapter, GeneratedOutline } from "./types.js";

/**
 * CourseFlow v2 的文字生成 Prompt 主檔。
 *
 * 這裡集中定義了最重要的文字生成規格：
 * - 原文 / 主題 → 課程大綱
 * - 大綱步驟 → 口播稿
 * - 口播稿 → 螢幕短語
 * - Markdown 文稿 → 完整課程 JSON
 *
 * 維護原則：
 * - 想改模型角色、格式、硬規則：改 `...SYSTEM_PROMPT`
 * - 想改本次呼叫帶入的上下文：改 `build...UserPrompt()`
 * - 想改容錯與輸出解析：改 `parse...Json()`
 */
/** v2 — 對齊 WVP OUTLINE-FORMAT：節拍優先、螢幕 ≤1 行、清單 1 項 = 1 step */
export const OUTLINE_SYSTEM_PROMPT = `你是資深教學影片總編，擅長把原文轉成「Web Video Presentation」開發用大綱。

核心原則（必守）：
1. **忠實保留原文資訊（最重要）**：原文的每個重要概念、對比、比喻、案例都必須對應到至少一個 step。**嚴禁省略、壓縮或合併原文的重要說明**。寧可多拆步驟，也不能讓資訊消失。一段 200~400 字的文字，通常應產生 4~8 個 step。
2. **一步一節拍、一步一個 idea**：每個 step 只承載口播會「單獨念出」的一個重點；講者會逐項念的列表，必須拆成多個 step（1 項 = 1 step）。有 2 個不同概念，就拆成 2 個 step，永遠不可用「／」把 2 個概念塞進同一 step。
3. **screenContent（螢幕重點）**：先完整理解這個 step 在講的**唯一核心概念**，然後用自己的話重新寫一條視覺標題。**嚴禁超過 1 條**，嚴禁使用「／」。格式為「名詞標籤：簡短說明」，建議總長 **10~30 字**。
   - **冒號前面必須是名詞或名詞片語**（2~6 字，例如：核心差異、學習策略、應用場景、入門優勢），**嚴禁**把原文句子切半後加冒號。
   - **禁止複製或改寫原文**：screenContent 必須是重新概念化後自己寫的標題，不可抄原文字句。
   - 禁止省略符號（… 或 ...）；禁止殘句開頭（是為了、這對於、它強調、不只是、往往、重點不、差別不只）。
4. **口播與螢幕嚴格分離（極重要）**：
   - screenContent 是投影片的視覺標題，代表「這一步在講什麼」，不是口播逐字稿。
   - ❌ 反例（把原文句切半加冒號）：「差別不只：工具變了...」、「往往：把模糊想法...」、「重點不：在背誦語法」
   - ✅ 正例（重新概念化後的名詞標籤）：「核心差異：工具改變的是目標設定方式」、「學習重點：方向感優先於語法記憶」、「Harness Engineering：支援 AI Agent 的系統架構方法」
5. **infoPool**：每章在 chapter 層收錄從原文抽的數字、引用、案例、標籤，供章節 Craft 掛畫面細節（雙源原則）。長句、解釋、例子放 infoPool，不要塞進 screenContent。
6. **relationHint**（可選）：步級提示如 list-reveal、contrast、hook、progression —— 只描述內容關係，**禁止**寫動畫類型或 CSS 手段。
7. **節奏**：estimatedSeconds 依口播字數 ÷ 4（中文約 4 字/秒），單步常見 3~12 秒；一章約 60~180 秒。
8. **wvpChapterId**：小寫連字符英文 id（如 coldopen、why-agent），將成為 presentation 資料夾名。
9. 只規劃節奏與內容密度，不規劃動畫。
10. 用詞必須採用台灣繁體中文慣用詞（例如：程式設計、介面、滑鼠、網路、影片、資訊、資料、設定），避免中國大陸慣用詞（例如：編程、界面、鼠標、網絡、視頻、信息、數據、配置）。
11. 輸出合法 JSON，勿 markdown 包裹。`;

/**
 * Outline 呼叫的 user prompt 組裝器。
 *
 * 這裡只放本次課程的原文與自檢要求，不放通用規則。
 * 若之後想加入受眾、難度、課程長度等額外上下文，優先從這裡擴充。
 */
export function buildOutlineUserPrompt(article: string, language: string): string {
  return `語言：${language}

教學原文：
"""
${article.slice(0, 120000)}
"""

撰寫時請自檢（每個 step 都要過一遍）：
1) **資訊完整性**：對照原文，確認每個重要概念都有對應的 step，不可省略。一段 200~400 字通常需要 4~8 步。
2) screenContent 只能有 1 條標語，禁止「／」。
3) 冒號前是名詞/名詞片語（2~6字），不是原文句子的前半段。
   ❌ 「差別不只：工具變了」→ ✅ 「核心差異：工具改變了目標設定方式」
   ❌ 「往往：把模糊想法...」→ ✅ 「核心能力：把模糊想法轉成可執行任務」
   ❌ 「重點不：在背誦語法」→ ✅ 「學習重點：理解方向優先於記憶語法」
4) 整條 screenContent 是重新概念化後自己寫的，不可直接複製原文字句。
5) 禁止使用「…」「...」「／」，禁止殘句（是為了、這對於、不只是、往往、重點不）。
6) 每個 step 代表「1 個 idea」，有 2 個概念必須拆成 2 個 step。

請輸出 JSON：
{
  "summary": "200~400 字課程總覽",
  "chapters": [
    {
      "title": "章節中文標題",
      "wvpChapterId": "hook",
      "sortOrder": 0,
      "chapterInfoPool": ["數字/引用/案例 —— 來源段落"],
      "steps": [
        {
          "screenContent": "本步唯一標語，禁止用「／」（如 主題：說明）",
          "infoPool": ["本步可掛的畫面細節"],
          "relationHint": "list-reveal",
          "estimatedSeconds": 8
        }
      ],
      "children": []
    }
  ]
}`;
}

/**
 * 將 step 大綱擴寫成口播稿的 system prompt。
 *
 * 若未來模型常常把畫面文字直接朗讀出來，或每步講得太空太短，應優先修改這個 prompt。
 */
export const SCRIPT_SYSTEM_PROMPT = `你是經驗豐富的教授，為「Web Video Presentation」錄製口播。每個 step 對應 narrations 陣列中的一项。

硬性規則：
1. **一步一段口播**：每個 stepIndex 只寫該節拍口播，禁止在一步內念完「第一…第二…第三…」整份列表。
2. **內容充實（最重要）**：每句口播必須完整解釋該步的核心概念，包含必要的背景、原因或對比。禁止用一句半白話一帶而過；觀眾必須能從這一句話真正理解這個概念。3~12 秒的口播，字數通常在 30~80 字之間。
3. **口播與螢幕嚴格分離（極重要）**：
   - 口播（script）絕對不可以與同一步的 screenContent 過於接近；禁止「照稿念螢幕」。
   - 禁止直接複讀或改寫 screenContent 的用字；口播這一句必須是 screenContent 的延伸詮釋（說清楚標題背後的意思、因果、例子、類比）。
   - 把 screenContent 當作「觀眾已看到的標題」，口播負責「講清楚標題背後的意思」。
   - 反例（禁止）：screenContent「三個重點」→ script「接下來我們看三個重點」。
   - 正例（允許）：screenContent「三個重點」→ script 解釋為什麼需要這三點、各點之間的關係，並舉一個具體情境。
4. **每步 1 句**（一個聚焦的想法，搭配 3~12 秒估時）。口語、精煉，無 markdown。這句話將直接顯示為畫面底部的字幕條文字（SubtitleBar）。
5. 善用 chapterInfoPool 與步級 infoPool 補充細節，不要重複螢幕已顯示的字面內容。
6. 輸出 JSON：{ "scripts": [ { "stepIndex": 0, "script": "..." } ] }`;

/**
 * Script 呼叫的 user prompt 組裝器。
 *
 * 這裡把每步的 screenContent、infoPool、章節摘要與原文摘錄一起餵給模型，
 * 讓模型能寫出不是照念標題、而是有內容延伸的口播稿。
 */
export function buildScriptUserPrompt(
  steps: {
    id: string;
    screenContent: string;
    infoPool: string[];
    relationHint?: string;
  }[],
  context: {
    language: string;
    summary: string;
    articleExcerpt: string;
    chapterInfoPool?: string[];
  },
): string {
  return `語言：${context.language}

課程摘要：
${context.summary}

章節信息池：
${JSON.stringify(context.chapterInfoPool ?? [], null, 2)}

原文摘錄：
"""
${context.articleExcerpt.slice(0, 24000)}
"""

為以下步驟撰寫口播（一步一段，列表已拆步）。

提醒：下列 screenContent 是「投影片上已顯示的短標語」，不是要你念出來的稿子。請寫出口播獨有的解釋與延伸，避免與 screenContent 用字高度重疊。

${JSON.stringify(
    steps.map((s, i) => ({
      stepIndex: i,
      screenContent: s.screenContent,
      infoPool: s.infoPool,
      relationHint: s.relationHint,
    })),
    null,
    2,
  )}`;
}

/** 口播稿 → 螢幕內容（簡報 bullet 摘要） */
/**
 * 將口播稿壓縮為畫面短語的 system prompt。
 *
 * 這個 prompt 直接影響投影片標題長相：
 * 是否像名詞標籤、是否能帶冒號、是否夠像台灣繁中、是否過度貼近原文。
 */
export const SCREEN_CONTENT_SYSTEM_PROMPT = `你是教學簡報編輯。任務：摘要口播稿，產出「可放上簡報的視覺標題」的螢幕內容。

規則：
1) 每步口播為一句話，代表一個 idea；**先完整理解這個 idea 的核心概念**，然後重新寫一條視覺標題，只能有 1 條，禁止使用「／」。
2) 格式：「名詞標籤：簡短說明」。**冒號前面必須是名詞或名詞片語（2~6 字）**，不可以是原文的動詞殘句或句子前半段。
3) 標題必須是重新概念化後自己寫的，不可直接複製或改寫原文字句。
4) 控制在 10~30 字；禁止省略符號（… 或 ...）；禁止使用「／」。
5) 禁止殘句；禁止以「是為了、這對於、它強調、不只是、往往、重點不、差別不只」等開頭。
6) 必須使用台灣繁體中文慣用詞（程式設計、介面、網路、元件、效能），避免中國大陸用詞。
7) 螢幕內容是投影片視覺標題，不是口播逐字稿。

正例（口播 → 螢幕）：
口播：「Vibe Coding 的速度優勢不只是省時間，更讓你可以把過去因成本太高而放棄的想法，先做出雛形來驗證。」
✅ 螢幕：「速度優勢：從想法到雛形的距離大幅縮短」

反例（禁止）：
❌ 「速度不只：省時間而已、以前一個點子...」← 把原文句子切半加冒號，冒號前是殘句
❌ 「差別不只：工具變了...」← 同上，冒號前不是名詞
❌ 「往往：把模糊想法...」← 「往往」不是名詞標籤
❌ 「Harness Engineering：...／核心：技術整合」← 用了「／」，違規

只輸出 JSON。`;

/**
 * ScreenContent 呼叫的 user prompt 組裝器。
 *
 * `currentScreenContent` 讓系統在重跑時能參考既有值；
 * 若未來要做保守修稿或只微調 screenContent，通常會從這裡補額外提示。
 */
export function buildScreenContentUserPrompt(
  language: string,
  steps: Array<{ stepId: string; script: string; currentScreenContent: string }>,
): string {
  return `語言：${language}
請輸出：
{
  "items": [
    { "stepId": "s1", "screenContent": "主題：說明（只有 1 條，禁止用 ／）" }
  ]
}

步驟資料：
${JSON.stringify(steps, null, 2)}`;
}

/** 解析大綱 JSON；若章節缺失就直接丟錯，避免後續流程拿到半殘資料。 */
export function parseOutlineJson(text: string): GeneratedOutline {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedOutline;
  if (!parsed.chapters?.length) {
    throw new Error("LLM 未產生有效章節");
  }
  return parsed;
}

/** 解析口播稿 JSON；實際 step 對位由上游使用 stepIndex 處理。 */
export function parseScriptsJson(
  text: string,
): { stepIndex: number; script: string }[] {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { scripts: { stepIndex: number; script: string }[] };
  return parsed.scripts ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 統一課程生成 Prompt（單次 LLM 呼叫，同時輸出結構 + 螢幕文字 + 口播稿）
// 資料結構記法：[] = 顯示在螢幕上的文字；{} = 口播稿
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 資料結構說明（給模型參考）：
 *
 * [課程標題]         ← 課程封面顯示的大標題
 * {課程標題口播稿}   ← 搭配課程封面的開場白
 *
 * [前言]             ← 第 0 章的第 1 個步驟
 * {前言口播稿}
 *
 * [章節1標題]        ← 章節分隔頁（chapter divider）
 * {章節1標題口播稿}
 * [步驟1-1]
 * {步驟1-1口播稿}
 * ...
 *
 * [結語]             ← 最後一個特殊章節（outro），不拆 step，但仍必須有實際內容
 * {結語完整口播稿}   ← 實際存放在 outro chapter 的 chapterScript，不可只有標題
 */
/**
 * Call 2：將有階層的 Markdown 教學文稿轉換為課程 JSON。
 * 關鍵流程：每個步驟「先寫 script（口播稿）→ 再從 script 提煉 screenContent」。
 *
 * 這是目前最重的一支文字生成 prompt，因為它同時決定課程結構、口播稿與畫面短語。
 */
export const MARKDOWN_TO_COURSE_SYSTEM_PROMPT = `你是教學影片課程設計師，將一篇有 Markdown 標題階層（H1/H2/H3）的教學文稿轉換為課程 JSON。

【Markdown 階層 → 課程結構對應】
- H1（# 課程標題）或文章首個大標題 → coldopen 章節，前言段落 = steps[0]
- H2（## 標題）→ 普通章節（chapter）
- H3（### 標題）或每個段落 → 步驟（step）
- 最後必須加入結語章節（chapterKind: "outro"，steps 雖為空陣列，但 chapterScript 必須放入完整結語口播，禁止空白）

【段落拆分規則 — 防止資訊遺漏的關鍵】
- 一個段落 ≤ 100 字：一個步驟。
- 一個段落 101~200 字：視內容可拆成 1~2 個步驟。
- 一個段落 > 200 字，或含有多個並列概念（以句號、分號、條列分隔）：
  必須拆成多個步驟，每個步驟對應段落中的一個子概念。
- 條列清單（- 或 * 或數字）每一項至少對應一個步驟，禁止合併壓縮。
- ❌ 禁止：把整段 200 字壓縮成一個 60 字步驟（必然遺漏）
- ✅ 正確：拆成 2~4 個步驟，每步聚焦一個概念，合計字數涵蓋原段落所有要點

【每個步驟的填寫流程 ⚠️ 請嚴格依此順序】
1. 框定該步驟要涵蓋的「原文範圍」（哪幾句話 / 哪個清單項）
2. 先寫 script（口播稿）
   【核心原則】script = 原文的口語版，不是摘要。
   - 以該範圍的**完整原文**為底稿，保留每一個句子的意思
   - 只做最小幅度的口語化處理：去掉 Markdown 符號（**、*、#）、把書面語換成口語連接詞
   - 若原文本身已是流暢的文字，可直接使用，不需另行改寫
   - ❌ 嚴禁：壓縮、摘要、只保留「重點」而刪掉其他句子
   - ❌ 嚴禁：把 3 句話的段落只寫出 1 句的 script
   - ✅ 原文 3 句 → script 也應有 3 句（或等量的資訊密度）
   - 字數跟隨原文段落長度，40~150 字；不以「80 字上限」為由刪減原文
   - 台灣繁體中文，禁止中國大陸慣用詞
3. 再從 script 提煉 screenContent（螢幕顯示文字）
   - 從 script 摘取核心概念，格式「名詞標籤：2~5 字說明」，總長 10~30 字
   - ✅ 正例：「核心優勢：大幅縮短從想法到實作的距離」
   - ❌ 反例：「差別不只：工具變了」（截斷）、「往往能幫助：理解問題」（殘句）
   - screenContent 是 script 的精華，不是獨立生成的新句子

【完整性自檢（輸出前必做）】
逐一對照原文每個 H2/H3/段落/條列項，確認：
- ✅ 該概念有對應步驟
- ✅ 步驟的 script 涵蓋了該段的所有要點
- ❌ 若某段落被合併或跳過 → 補回步驟

【章節填寫】
- chapterScript：
  - 普通章節（coldopen / chapter）：1~2 句話介紹本章主題（20~60 字）
  - 結語章節（outro）：⚠️ 因為 steps 為空，chapterScript 就是結語的「全部」口播稿。
    必須把原文結語段落的完整內容寫入，保留每一個句子（60~200 字），不能只寫標題。
    ❌ 禁止：chapterScript: "結語" 或單一短句（少於 30 字）
    ✅ 正確：把原文中結語 / 總結段落的全文直接作為口語版 chapterScript
- wvpChapterId：小寫英文連字符 id（如 coldopen、intro、what-is-vibe-coding、conclusion）

【JSON 輸出格式】
輸出合法 JSON，勿用 markdown 包裹：
{
  "summary": "200~400 字課程總覽",
  "chapters": [
    {
      "title": "課程標題",
      "wvpChapterId": "coldopen",
      "chapterKind": "coldopen",
      "sortOrder": 0,
      "chapterScript": "課程開場白，引起學習動機（30~50字）",
      "steps": [
        {
          "script": "前言口播稿（先寫這個，30~80字）",
          "screenContent": "從口播稿提煉的螢幕文字（後寫這個，10~30字）",
          "estimatedSeconds": 10
        }
      ]
    },
    {
      "title": "章節標題",
      "wvpChapterId": "chapter-slug",
      "sortOrder": 1,
      "chapterScript": "章節分隔頁口播稿（20~50字）",
      "steps": [
        {
          "script": "步驟口播稿（先寫，30~80字）",
          "screenContent": "從口播稿提煉的螢幕文字（後寫，10~30字）",
          "estimatedSeconds": 8
        }
      ]
    },
    {
      "title": "結語",
      "wvpChapterId": "conclusion",
      "chapterKind": "outro",
      "sortOrder": 99,
      "chapterScript": "這就是本課程的完整結語口播（把原文結語段落的全文放這裡，60~200字，禁止縮短）",
      "steps": []
    }
  ]
}`;

export function buildMarkdownToCourseUserPrompt(article: string, language: string): string {
  return `輸出語言：${language}

教學文稿（Markdown 格式）：
"""
${article.slice(0, 120000)}
"""

請依文稿的標題階層轉換為課程 JSON。

⚠️ 完整性要求（輸出前請逐條確認）：
1. 原文每個 H2 章節、H3 子節、段落、條列項都必須有對應步驟，不可跳過。
2. 每個步驟的 script 必須涵蓋對應原文範圍的所有句子——原文幾句，script 也要涵蓋幾句的資訊量。
3. 段落 > 200 字或含多個並列概念 → 必須拆成多個步驟，不可壓縮成一步。
4. 每個步驟務必依序：① 先寫 script（40~150 字，以原文為底稿，不摘要）→ ② 再從 script 提煉 screenContent（10~30 字）。
5. estimatedSeconds = 口播字數 ÷ 4（四捨五入），至少 4 秒。
6. 前言（coldopen 的 steps[0]）和結語章節（最後一章，steps 為空陣列）必須存在。
7. 結語章節的 chapterScript 必須包含原文結語段落的完整內容（≥60 字），禁止縮寫成 "結語" 或 1 句話。`;
}
/**
 * Unified course generation 的 user prompt 組裝器。
 *
 * 這裡送進去的是整份教學文稿全文；
 * 如果未來要調整整體步數密度、結語強度或全文長度約束，通常會和上面的 system prompt 一起改。
 */

const COLDOPEN_WVP_IDS = new Set(["coldopen", "intro", "hook", "opening", "preface"]);
const OUTRO_WVP_IDS = new Set(["outro", "conclusion", "ending", "closing", "summary"]);

function normalizeWvpId(id?: string): string {
  return (id ?? "").trim().toLowerCase();
}

function chaptersBySortOrder(chapters: GeneratedChapter[]): GeneratedChapter[] {
  return [...chapters].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    return ao !== bo ? ao - bo : 0;
  });
}

function isLikelyOutroChapter(chapter: GeneratedChapter): boolean {
  const id = normalizeWvpId(chapter.wvpChapterId);
  if (OUTRO_WVP_IDS.has(id)) return true;
  if (/結語|總結|結束|outro|conclusion/i.test(chapter.title)) return true;
  return chapter.steps.length === 0;
}

function backfillChapterScript(chapter: GeneratedChapter, kind: "coldopen" | "outro"): void {
  if (chapter.chapterScript?.trim()) return;

  if (kind === "coldopen") {
    const firstStepScript = chapter.steps[0]?.script?.trim();
    if (firstStepScript) {
      chapter.chapterScript = firstStepScript;
      return;
    }
    const title = chapter.title.trim();
    if (title.length >= 20) {
      chapter.chapterScript = title;
    }
    return;
  }

  const lastStepScript = chapter.steps[chapter.steps.length - 1]?.script?.trim();
  if (lastStepScript) {
    chapter.chapterScript = lastStepScript;
  }
}

/**
 * LLM 常漏設 chapterKind；在驗證前依 sortOrder / wvpChapterId / 標題補齊 coldopen 與 outro。
 */
function normalizeSpecialChapterKinds(outline: GeneratedOutline): void {
  const sorted = chaptersBySortOrder(outline.chapters);

  let coldopen = outline.chapters.find((ch) => ch.chapterKind === "coldopen");
  if (!coldopen) {
    coldopen =
      outline.chapters.find((ch) => COLDOPEN_WVP_IDS.has(normalizeWvpId(ch.wvpChapterId))) ??
      sorted[0];
  }
  if (coldopen) {
    coldopen.chapterKind = "coldopen";
    if (!coldopen.wvpChapterId) coldopen.wvpChapterId = "coldopen";
    backfillChapterScript(coldopen, "coldopen");
  }

  let outro = outline.chapters.find((ch) => ch.chapterKind === "outro");
  if (!outro) {
    outro =
      outline.chapters.find((ch) => OUTRO_WVP_IDS.has(normalizeWvpId(ch.wvpChapterId))) ??
      [...sorted].reverse().find((ch) => ch !== coldopen && isLikelyOutroChapter(ch));
  }
  if (outro && outro !== coldopen) {
    outro.chapterKind = "outro";
    if (!outro.wvpChapterId) outro.wvpChapterId = "conclusion";
    backfillChapterScript(outro, "outro");
  }
}

function assertValidChapterNarration(
  outline: GeneratedOutline,
  kind: "coldopen" | "outro",
  minLength: number,
  label: string,
): void {
  const target = outline.chapters.find((chapter) => chapter.chapterKind === kind);
  if (!target) {
    throw new Error(`LLM 未產生${label}章節（${kind}）`);
  }

  const script = target.chapterScript?.trim() ?? "";
  if (!script) {
    throw new Error(`LLM 未產生${label}口播稿（${kind}.chapterScript 為空）`);
  }

  const normalizedTitle = target.title.trim();
  if (script.length < minLength || script === normalizedTitle) {
    throw new Error(`LLM 產生的${label}口播稿過短，疑似只回傳章節標題`);
  }
}

export function parseUnifiedCourseJson(text: string): GeneratedOutline {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedOutline;
  if (!parsed.chapters?.length) {
    throw new Error("LLM 未產生有效章節");
  }
  normalizeSpecialChapterKinds(parsed);
  assertValidChapterNarration(parsed, "coldopen", 20, "開場白");
  assertValidChapterNarration(parsed, "outro", 30, "結語");
  return parsed;
}
