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
