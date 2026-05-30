/**
 * 一次性修補：將指定專案的「結語」章節分隔頁 step.script 從空字串更新為正確口播稿。
 *
 * 用法：
 *   node scripts/fix-outro-script.mjs <projectId> "<口播稿>"
 *
 * 範例：
 *   node scripts/fix-outro-script.mjs 312db056-d873-4ef4-816e-bc8084cf27e6 \
 *     "這就是 Vibe Coding 的基本介紹。在接下來的課程中，我們將深入探討如何將 Vibe Coding 的理念應用到實際的程式碼撰寫中，並透過一些練習來培養您的「程式碼直覺」。準備好釋放您的程式碼創造力了嗎？"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
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
const workerEnv = loadEnvFile(path.join(root, "apps/worker/.env"));
const env = { ...workerEnv, ...webEnv };
for (const [k, v] of Object.entries(env)) {
  if (v) process.env[k] ??= v;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ 找不到 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const [, , projectId, newScript] = process.argv;
if (!projectId || !newScript) {
  console.error("用法：node scripts/fix-outro-script.mjs <projectId> \"<口播稿>\"");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. 取得所有章節，找出「結語」
  const { data: chapters, error: chErr } = await supabase
    .from("chapters")
    .select("id, title, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");

  if (chErr || !chapters?.length) {
    console.error("❌ 無法讀取章節：", chErr?.message);
    process.exit(1);
  }

  // 找結語章節（標題為「結語」或排序最後 + 無子步驟）
  const outroChapter =
    chapters.find((c) => c.title === "結語") ??
    chapters.at(-1);

  if (!outroChapter) {
    console.error("❌ 找不到結語章節");
    process.exit(1);
  }
  console.log(`✓ 找到章節：${outroChapter.title} (id=${outroChapter.id})`);

  // 2. 找章節分隔頁 step（step_kind = 'chapter'，sort_order = 0）
  const { data: steps, error: stErr } = await supabase
    .from("steps")
    .select("id, script, screen_summary, step_kind, sort_order")
    .eq("chapter_id", outroChapter.id)
    .order("sort_order");

  if (stErr || !steps?.length) {
    console.error("❌ 無法讀取步驟：", stErr?.message);
    process.exit(1);
  }

  const dividerStep = steps.find((s) => s.step_kind === "chapter") ?? steps[0];
  console.log(`✓ 找到分隔頁步驟：id=${dividerStep.id}, 現有 script="${dividerStep.script}"`);

  // 3. 更新 steps 表
  const { error: upErr } = await supabase
    .from("steps")
    .update({ script: newScript })
    .eq("id", dividerStep.id);

  if (upErr) {
    console.error("❌ 更新 steps 失敗：", upErr.message);
    process.exit(1);
  }
  console.log("✓ steps.script 已更新");

  // 4. 同步更新 composition_snapshot（讀取 → 修改 → 寫回）
  const { data: project, error: prErr } = await supabase
    .from("projects")
    .select("composition_snapshot")
    .eq("id", projectId)
    .single();

  if (prErr || !project?.composition_snapshot) {
    console.warn("⚠️  composition_snapshot 讀取失敗或為空，跳過 snapshot 更新");
    return;
  }

  const snap = project.composition_snapshot;
  let patched = false;
  for (const step of snap.steps ?? []) {
    if (step.id === dividerStep.id) {
      step.script = newScript;
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.warn("⚠️  composition_snapshot 中找不到對應 step id，跳過 snapshot 更新");
    return;
  }

  const { error: snapErr } = await supabase
    .from("projects")
    .update({ composition_snapshot: snap })
    .eq("id", projectId);

  if (snapErr) {
    console.error("❌ 更新 composition_snapshot 失敗：", snapErr.message);
    process.exit(1);
  }

  console.log("✓ composition_snapshot 已更新");
  console.log("\n✅ 完成！請在 CourseFlow 後台對「結語」章節重新執行「匯入口播」，再重建 presentation。");
}

main().catch((e) => {
  console.error("❌ 未預期錯誤：", e);
  process.exit(1);
});
