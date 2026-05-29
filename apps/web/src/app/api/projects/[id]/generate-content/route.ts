import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertPhaseEditable,
  defaultChapterVisualForStep,
  ensureChapterDividerSteps,
} from "@courseflow/core";
import type { PhaseLocks } from "@courseflow/core";
import { decryptApiKey } from "@/lib/crypto";
import { generateOutline, generateScripts } from "@courseflow/llm";
import type { LlmProviderId } from "@courseflow/llm";
import {
  createCompositionFromArticle,
  expandListStepsInGeneratedChapters,
  mergeScripts,
} from "@courseflow/composition";
import type { GeneratedChapterInput } from "@courseflow/composition";
import { saveComposition } from "@/lib/project-composition";
import { defaultSubtitleForStep, defaultVisualForStep } from "@courseflow/db";
import { resolveLlmProvider } from "@/lib/llm-provider";
import type { CourseComposition } from "@courseflow/core";
import { generateChapterPlan } from "@/lib/wvp-generate-chapter";

const TW_TERM_MAP: Array<[RegExp, string]> = [
  [/編程/g, "程式設計"],
  [/程序/g, "程式"],
  [/代碼/g, "程式碼"],
  [/界面/g, "介面"],
  [/用戶/g, "使用者"],
  [/視頻/g, "影片"],
  [/信息/g, "資訊"],
  [/數據/g, "資料"],
  [/網絡/g, "網路"],
  [/鼠標/g, "滑鼠"],
  [/配置/g, "設定"],
  [/文件/g, "檔案"],
  [/模塊/g, "模組"],
  [/通信/g, "通訊"],
  [/運行/g, "執行"],
  [/啟動/g, "啟用"],
];

function normalizeTwTerms(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TW_TERM_MAP) out = out.replace(pattern, replacement);
  return out;
}

function cleanKeyPointClause(input: string): string {
  let s = normalizeTwTerms(input)
    .replace(/\.\.\.|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
  s = s
    .replace(/^在[^，,。]{0,18}中，?/g, "")
    .replace(/^這意味著/g, "")
    .replace(/^這表示/g, "")
    .replace(/^也就是說/g, "")
    .replace(/^它的/g, "")
    .replace(/那些/g, "")
    .replace(/特別/g, "")
    .replace(/可以透過|可以通過|可通過|通過/g, "透過")
    .replace(/無需|不需要|不用/g, "無須")
    .replace(/便能|就能/g, "即可")
    .replace(/來創建|來建立/g, "建立")
    .replace(/拖放操作/g, "拖放")
    .replace(/學習程式設計的人/g, "程式設計新手")
    .replace(/剛開始學習程式設計的人/g, "程式設計新手")
    .replace(/深入理解/g, "理解")
    .trim();

  // 刪除容易造成殘句感的連接詞前綴（可重複清理）
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(
      /^(使得|因此|所以|而|並且|另外|同時|這樣一來|透過這樣的方式|透過這個方式|透過這種方式|這些概念|這些|這個|則|還是|或是|以及)\s*/g,
      "",
    );
    if (next === s) break;
    s = next.trim();
  }

  if (/^(.{2,18})是(一種|一個|一套)?/.test(s)) {
    s = s.replace(/^(.{2,18})是(一種|一個|一套)?\s*/u, "$1：");
  }

  s = s.replace(/\s*：\s*/g, "：");
  s = s.replace(/[、，,。；;:：!?！？\s]+$/g, "").trim();
  s = s.replace(/(的|來|即可透過|可以透過|可以通過|使得|因此|所以)$/g, "").trim();
  return s;
}

function looksIncompleteClause(text: string): boolean {
  return (
    /(的|來|即可透過|可以透過|可以通過|使得|因此|所以)$/.test(text.trim()) ||
    /^(使得|因此|所以|而|並且|另外|同時|透過這樣的方式|這些概念|還是|或是|以及)\b/.test(
      text.trim(),
    )
  );
}

function isNarrativeLead(text: string): boolean {
  const t = text.trim();
  return /^(想像一下|試想|你只需要|你可以|我們來看|首先|接著|然後|例如|比方說|無論你是)/.test(
    t,
  );
}

function isWeakFragment(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(還是|或是|以及|並且)\b/.test(t)) return true;
  if (/^透過/.test(t)) {
    // 「透過...」必須包含完整結果子句，否則視為殘片。
    const hasResultClause =
      /(可|能|即可|快速|掌握|建立|完成|上手|達成|理解|學會)/.test(t) &&
      /(操作|方式|流程|步驟|方法)/.test(t);
    if (!hasResultClause) return true;
  }
  // 避免「還是有些基礎的學習者」這類補語片段成為重點。
  if (/學習者$/.test(t) && !/(適合|上手|可|能|皆可|都能|門檻|方式|體驗|重點|核心|關鍵)/.test(t)) {
    return true;
  }
  // 需要至少一個可解釋關係/判斷的語意動詞或結構。
  const hasPredicate =
    /(:|：|是|可|能|適合|降低|提供|支援|上手|學習|建立|透過|關注|設計|找到|有效|門檻|體驗|方式|皆可|都能)/.test(
      t,
    );
  return !hasPredicate;
}

function keyPointsFromScript(script: string): string {
  const normalized = normalizeTwTerms(script).replace(/\s+/g, " ").trim();
  const rawClauses = normalized
    .split(/[。！？!?]/)
    .flatMap((sentence) => sentence.split(/[，,；;:：]/))
    .map((p) => p.trim())
    .filter(Boolean);
  const candidates = rawClauses
    .map(cleanKeyPointClause)
    .map((p) => p.replace(/[／|｜]/g, ""))
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const ranked = candidates
    .filter((p) => p.length >= 6 && p.length <= 36)
    .filter((p) => !looksIncompleteClause(p))
    .filter((p) => !isNarrativeLead(p))
    .filter((p) => !isWeakFragment(p))
    .sort((a, b) => {
      const score = (text: string) => {
        const keywordScore = /(核心|關鍵|重點|適合|透過|建立|觸發|上手|互動|無須|即可|基礎|概念)/.test(
          text,
        )
          ? 2
          : 0;
        const domainScore = /(程式設計|介面|拖放|元件|語法|直觀|有趣)/.test(text) ? 2 : 0;
        const structureScore = text.includes("：") ? 2 : /(是|用來|可|能|適合)/.test(text) ? 1 : 0;
        const penalty = looksIncompleteClause(text) || isNarrativeLead(text) ? -4 : 0;
        return keywordScore + domainScore + structureScore + penalty;
      };
      return score(b) - score(a);
    });

  const selected: string[] = [];
  for (const phrase of ranked) {
    if (selected.some((picked) => picked.includes(phrase) || phrase.includes(picked))) {
      continue;
    }
    if (selected.includes(phrase)) continue;
    selected.push(phrase);
    if (selected.length >= 4) break;
  }
  if (selected.length === 0) return "重點整理";

  const merged = selected.join("、").replace(/、+/g, "、");
  if (merged.length <= 64) return merged;

  // 過長時保留完整片語，不做半句截斷。
  const compact: string[] = [];
  let acc = 0;
  for (const p of selected) {
    const nextLen = acc === 0 ? p.length : p.length + 1;
    if (acc + nextLen > 64 && compact.length >= 2) break;
    compact.push(p);
    acc += nextLen;
  }
  return compact.join("、");
}

function hasMainlandTerms(text: string): boolean {
  return /(編程|程序|代碼|界面|視頻|信息|數據|網絡|鼠標|配置|文件|模塊|通信|運行|啟動)/.test(
    text,
  );
}

function normalizeExistingScreenContent(text: string): string {
  return normalizeTwTerms(text).replace(/\.\.\.|…/g, "").trim();
}

function shouldRewriteScreenContent(current: string): boolean {
  const looksTooShort = current.length < 12;
  const lacksStructure = !/[／|｜、，]/.test(current);
  const hasEllipsis = /\.\.\.|…/.test(current);
  const incompleteTail = looksIncompleteClause(current);
  return looksTooShort || lacksStructure || hasEllipsis || incompleteTail || hasMainlandTerms(current);
}

function needsHardValidationRetry(screenContent: string): boolean {
  const normalized = normalizeExistingScreenContent(screenContent);
  return (
    looksIncompleteClause(normalized) ||
    hasMainlandTerms(normalized) ||
    isNarrativeLead(normalized) ||
    normalized
      .split(/[、／|｜]/)
      .map((s) => s.trim())
      .some((s) => isWeakFragment(s))
  );
}

async function generateScreenContentByLlm(opts: {
  provider: LlmProviderId;
  apiKey: string;
  model?: string;
  language: string;
  steps: Array<{ stepId: string; script: string; currentScreenContent: string }>;
}): Promise<Map<string, string>> {
  if (opts.steps.length === 0) return new Map();
  const system = `你是教學投影片編輯。任務：先從每步口播稿擷取「語意完整重點」，再做「輕度縮句」作為螢幕內容。
規則：
1) 每步輸出 1~4 個重點句（不是口號、不是殘句），使用「、」分隔。
2) 先擷取語意完整重點，再稍微縮短文字長度（保留主詞+關鍵動作/結果）。
3) 每個重點必須「單獨拿出來也完整可懂」。
4) 禁止殘句：例如「透過簡單的拖放」「還是有些基礎的學習者」「這些概念」。
5) 禁止省略符號（… 或 ...）。
6) 必須使用台灣繁體中文慣用詞（程式設計、介面、滑鼠、網路、影片、資訊、資料、設定），避免中國大陸用詞。
7) 螢幕內容不是口播逐字稿，要可視化重點摘要。
只輸出 JSON。`;

  const user = `語言：${opts.language}
請輸出：
{
  "items": [
    { "stepId": "s1", "screenContent": "重點A、重點B、重點C" }
  ]
}

步驟資料：
${JSON.stringify(opts.steps, null, 2)}`;

  const obj = await generateChapterPlan({
    provider: opts.provider,
    apiKey: opts.apiKey,
    model: opts.model,
    system,
    user,
  });

  const items = (obj.items as Array<{ stepId?: string; screenContent?: string }>) ?? [];
  const out = new Map<string, string>();
  for (const item of items) {
    const id = String(item.stepId ?? "").trim();
    const screen = normalizeExistingScreenContent(String(item.screenContent ?? ""));
    if (!id || !screen) continue;
    out.set(id, screen);
  }
  return out;
}

async function normalizeGeneratedScreenContent(
  composition: CourseComposition,
  llm: { provider: LlmProviderId; apiKey: string; model?: string },
  language: string,
): Promise<CourseComposition> {
  const contentSteps = composition.steps.filter((s) => (s.stepKind ?? "content") !== "chapter");
  const firstPass = await generateScreenContentByLlm({
    provider: llm.provider,
    apiKey: llm.apiKey,
    model: llm.model,
    language,
    steps: contentSteps.map((s) => ({
      stepId: s.id,
      script: s.script ?? "",
      currentScreenContent: s.screenContent ?? "",
    })),
  });

  const retryTargets = contentSteps
    .map((step) => {
      const candidate = firstPass.get(step.id) ?? step.screenContent ?? "";
      return {
        stepId: step.id,
        script: step.script ?? "",
        currentScreenContent: candidate,
        invalid: shouldRewriteScreenContent(candidate) || needsHardValidationRetry(candidate),
      };
    })
    .filter((x) => x.invalid)
    .map(({ stepId, script, currentScreenContent }) => ({ stepId, script, currentScreenContent }));

  const secondPass =
    retryTargets.length > 0
      ? await generateScreenContentByLlm({
          provider: llm.provider,
          apiKey: llm.apiKey,
          model: llm.model,
          language,
          steps: retryTargets,
        })
      : new Map<string, string>();

  return {
    ...composition,
    steps: composition.steps.map((step) => {
      if ((step.stepKind ?? "content") === "chapter") return step;
      const current = normalizeExistingScreenContent(step.screenContent);
      const llmCandidate = secondPass.get(step.id) ?? firstPass.get(step.id) ?? current;
      let nextScreen = normalizeExistingScreenContent(llmCandidate);
      if (shouldRewriteScreenContent(nextScreen) || needsHardValidationRetry(nextScreen)) {
        nextScreen = keyPointsFromScript(step.script || current);
      }
      if (shouldRewriteScreenContent(nextScreen) || needsHardValidationRetry(nextScreen)) {
        nextScreen = normalizeTwTerms(nextScreen)
          .replace(/\.\.\.|…/g, "")
          .replace(/(的|來|即可透過|可以透過|可以通過)$/g, "")
          .trim();
      }
      return { ...step, screenContent: nextScreen || "重點整理" };
    }),
  };
}

function normalizeGeneratedScriptsToTw(composition: CourseComposition): CourseComposition {
  return {
    ...composition,
    steps: composition.steps.map((step) => ({
      ...step,
      script: normalizeTwTerms(step.script ?? ""),
    })),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("phase_locks, article, settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  try {
    assertPhaseEditable(project.phase_locks as PhaseLocks, "content");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json()) as {
    provider?: LlmProviderId;
    model?: string;
    articleText?: string;
  };

  const articleFromDb = project.article as { rawText?: string; format?: string; fileName?: string };
  const articleText = body.articleText?.trim() || articleFromDb.rawText?.trim();
  if (!articleText) {
    return NextResponse.json({ error: "請先在上方文字框貼上或匯入教學文件" }, { status: 400 });
  }

  if (body.articleText?.trim()) {
    await supabase
      .from("projects")
      .update({
        article: {
          rawText: articleText,
          format: articleFromDb.format ?? "txt",
          fileName: articleFromDb.fileName ?? "paste.txt",
        },
      })
      .eq("id", id);
  }

  const resolved = await resolveLlmProvider(supabase, user.id, body.provider);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { provider, encryptedKey } = resolved;

  const language =
    (project.settings as { language?: string })?.language ?? "zh-TW";

  try {
    const creds = {
      provider,
      apiKey: decryptApiKey(encryptedKey),
      model: body.model,
    };
    const outline = await generateOutline(creds, articleText, language);
    const chaptersForComposition: GeneratedChapterInput[] =
      expandListStepsInGeneratedChapters(
        outline.chapters.map((ch) => ({
          title: ch.title,
          sortOrder: ch.sortOrder,
          steps: ch.steps.map((st) => ({
            screenContent: st.screenContent,
            infoPool: st.infoPool ?? [],
            estimatedSeconds: st.estimatedSeconds,
            script: st.script,
          })),
        })),
      );
    let composition = createCompositionFromArticle(language, chaptersForComposition);
    const scriptMap = await generateScripts(
      creds,
      composition.steps
        .filter((s) => (s.stepKind ?? "content") !== "chapter")
        .map((s) => ({
          id: s.id,
          screenContent: s.screenContent,
          infoPool: s.infoPool,
        })),
      {
        language,
        summary: outline.summary,
        articleExcerpt: articleText,
      },
    );
    composition = mergeScripts(composition, scriptMap);
    composition = normalizeGeneratedScriptsToTw(composition);
    composition = await normalizeGeneratedScreenContent(
      composition,
      { provider, apiKey: creds.apiKey, model: body.model },
      language,
    );
    composition = ensureChapterDividerSteps(composition);
    for (const step of composition.steps) {
      if (!composition.subtitles.some((x) => x.stepId === step.id)) {
        composition.subtitles.push(defaultSubtitleForStep(step.id));
      }
      if (!composition.visuals.some((x) => x.stepId === step.id)) {
        composition.visuals.push(
          step.stepKind === "chapter"
            ? defaultChapterVisualForStep(step.id, step.screenContent)
            : defaultVisualForStep(step.id, step.screenContent),
        );
      }
    }
    await saveComposition(supabase, id, composition);

    await supabase.from("chapters").delete().eq("project_id", id);
    for (const ch of composition.chapters) {
      await supabase.from("chapters").insert({
        id: ch.id,
        project_id: id,
        parent_id: ch.parentId,
        title: ch.title,
        sort_order: ch.sortOrder,
      });
    }
    for (const step of composition.steps) {
      await supabase.from("steps").insert({
        id: step.id,
        chapter_id: step.chapterId,
        sort_order: step.sortOrder,
        script: step.script,
        screen_summary: step.screenContent,
        info_pool: step.infoPool,
      });
    }

    return NextResponse.json({
      ok: true,
      summary: outline.summary,
      chapterCount: composition.chapters.length,
      stepCount: composition.steps.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
