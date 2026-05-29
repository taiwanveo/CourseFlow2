import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveLlmProvider, resolveEffectiveTextModel } from "@/lib/llm-provider";
import { resolveWvpPhaseLocks } from "@/lib/wvp-locks";
import { assertWvpPhaseEditable } from "@courseflow/core";
import type { LlmProviderId } from "@courseflow/llm";
import { loadProjectComposition } from "@/lib/project-composition";
import { evaluateWvpAudioBuildGate } from "@/lib/wvp-build-gate";
import { batchCraftAllChapters, batchCraftAllChaptersAndBuild } from "@/lib/wvp-chapter-craft";
import { assertProjectImageStyleConfigured } from "@/lib/wvp-image-style-guard";
import { wvpPlayPagePath } from "@/lib/wvp-workdir";

export const runtime = "nodejs";
export const maxDuration = 600;

/** 一鍵：全課批次生成（視覺動效），可選一併打包預覽 */
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
    .select("wvp_phase_locks, phase_locks, wvp_settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "找不到專案" }, { status: 404 });

  const locks = resolveWvpPhaseLocks(project);
  try {
    assertWvpPhaseEditable(locks, "craft");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    provider?: LlmProviderId;
    onlyMissing?: boolean;
    syncOnly?: boolean;
    includeBuild?: boolean;
  };

  if (body.syncOnly) {
    try {
      const { results, materialized } = await batchCraftAllChapters(supabase, id, user.id, {
        provider: "openrouter",
        encryptedKey: "",
        skipGenerate: true,
      });
      return NextResponse.json({
        ok: true,
        results,
        materialized,
        mode: "sync-only",
        summary: {
          total: results.length,
          synced: results.filter((r) => r.synced).length,
        },
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  const resolved = await resolveLlmProvider(supabase, user.id, body.provider);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const styleGuard = assertProjectImageStyleConfigured(project.wvp_settings);
  if (!styleGuard.ok) {
    return NextResponse.json({ error: styleGuard.error }, { status: styleGuard.status });
  }

  const wvpSettings = styleGuard.settings;
  if (!wvpSettings.anchorChapterTrialCompleted) {
    return NextResponse.json(
      { error: "請先完成「試執行第 1 章」並在預覽中確認第 1 章風格" },
      { status: 400 },
    );
  }
  if (!wvpSettings.anchorChapterApproved) {
    return NextResponse.json(
      { error: "請先在預覽畫面確認第 1 章風格後，再執行全課批次" },
      { status: 400 },
    );
  }

  try {
    if (body.includeBuild) {
      const composition = await loadProjectComposition(supabase, id);
      if (!composition) {
        return NextResponse.json({ error: "無法載入專案內容" }, { status: 400 });
      }
      const audioGate = evaluateWvpAudioBuildGate(composition);
      if (!audioGate.ready) {
        return NextResponse.json(
          { error: audioGate.message, audioGate },
          { status: 400 },
        );
      }

      const { results, build } = await batchCraftAllChaptersAndBuild(supabase, id, user.id, {
        provider: resolved.provider,
        encryptedKey: resolved.encryptedKey,
        textModel: resolveEffectiveTextModel(resolved.provider, resolved.textModel, resolved.defaultModel),
        onlyMissing: body.onlyMissing ?? false,
      });

      const failed = results.filter((r) => r.error);
      const generated = results.filter((r) => r.generated).length;

      return NextResponse.json({
        ok: failed.length === 0 && build.built,
        results,
        materialized: true,
        build,
        previewUrl: wvpPlayPagePath(id),
        warning: build.storageUploadWarning ?? build.audioSyncWarning,
        audioSyncWarning: build.audioSyncWarning,
        summary: {
          total: results.length,
          synced: results.filter((r) => r.synced).length,
          generated,
          failed: failed.length,
          built: build.built,
        },
      });
    }

    const { results, materialized } = await batchCraftAllChapters(supabase, id, user.id, {
      provider: resolved.provider,
      encryptedKey: resolved.encryptedKey,
      textModel: resolveEffectiveTextModel(resolved.provider, resolved.textModel, resolved.defaultModel),
      onlyMissing: body.onlyMissing ?? false,
    });

    const failed = results.filter((r) => r.error);
    const generated = results.filter((r) => r.generated).length;

    return NextResponse.json({
      ok: failed.length === 0,
      results,
      materialized,
      summary: {
        total: results.length,
        synced: results.filter((r) => r.synced).length,
        generated,
        failed: failed.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
