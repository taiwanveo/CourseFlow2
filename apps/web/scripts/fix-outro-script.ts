/**
 * 一次性修補：更新「結語」章節分隔頁 step.script
 * 執行：cd apps/web && npx tsx scripts/fix-outro-script.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const webEnv = loadEnvFile(path.join(root, "apps/web/.env.local"));
for (const [k, v] of Object.entries(webEnv)) {
  if (v) (process.env as Record<string, string>)[k] ??= v;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ 找不到 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const [, , projectId, newScript] = process.argv;
if (!projectId || !newScript) {
  console.error(
    'Usage: tsx scripts/fix-outro-script.ts <projectId> "<口播稿>"\n' +
      "Example:\n" +
      "  tsx scripts/fix-outro-script.ts 312db056-d873-4ef4-816e-bc8084cf27e6 " +
      '"這就是 Vibe Coding 的基本介紹..."',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. 找「結語」章節
  const { data: chapters, error: chErr } = await supabase
    .from("chapters")
    .select("id, title, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  if (chErr ?? !chapters?.length) {
    console.error("❌ 無法讀取章節：", chErr?.message);
    process.exit(1);
  }

  const outroChapter = chapters.find((c: { title: string }) => c.title === "結語") ?? chapters.at(-1);
  if (!outroChapter) { console.error("❌ 找不到結語章節"); process.exit(1); }
  console.log(`✓ 找到章節：${outroChapter.title} (id=${outroChapter.id})`);

  // 2. 找章節分隔頁 step
  const { data: steps, error: stErr } = await supabase
    .from("steps")
    .select("id, script, screen_summary, step_kind, sort_order")
    .eq("chapter_id", outroChapter.id)
    .order("sort_order");

  if (stErr ?? !steps?.length) {
    console.error("❌ 無法讀取步驟：", stErr?.message);
    process.exit(1);
  }

  const dividerStep =
    steps.find((s: { step_kind: string }) => s.step_kind === "chapter") ?? steps[0];
  if (!dividerStep) {
    console.error("❌ 找不到任何步驟");
    process.exit(1);
  }
  console.log(`✓ 找到步驟：id=${dividerStep.id}, 現有 script="${dividerStep.script}"`);

  // 3. 更新 steps 表
  const { error: upErr } = await supabase
    .from("steps")
    .update({ script: newScript })
    .eq("id", dividerStep.id);

  if (upErr) { console.error("❌ 更新 steps 失敗：", upErr.message); process.exit(1); }
  console.log("✓ steps.script 已更新");

  // 4. 同步更新 composition_snapshot
  const { data: project, error: prErr } = await supabase
    .from("projects")
    .select("composition_snapshot")
    .eq("id", projectId)
    .single();

  if (prErr ?? !project?.composition_snapshot) {
    console.warn("⚠️  composition_snapshot 讀取失敗或為空，跳過 snapshot 更新");
    return;
  }

  const snap = project.composition_snapshot as { steps?: Array<{ id: string; script: string }> };
  let patched = false;
  for (const step of snap.steps ?? []) {
    if (step.id === dividerStep.id) { step.script = newScript; patched = true; break; }
  }

  if (!patched) {
    console.warn("⚠️  composition_snapshot 中找不到對應 step id，跳過 snapshot 更新");
    return;
  }

  const { error: snapErr } = await supabase
    .from("projects")
    .update({ composition_snapshot: snap as Record<string, unknown> })
    .eq("id", projectId);

  if (snapErr) { console.error("❌ 更新 composition_snapshot 失敗：", snapErr.message); process.exit(1); }

  console.log("✓ composition_snapshot 已更新");
  console.log("\n✅ 完成！請在 CourseFlow 後台對「結語」章節重新執行「匯入口播」，再重建 presentation。");
}

main().catch((e) => { console.error("❌ 未預期錯誤：", e); process.exit(1); });
