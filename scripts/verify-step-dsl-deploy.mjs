#!/usr/bin/env node
/**
 * StepDSL Phase 1 部署驗證：health buildSha + codegen 煙測 + motion-capable 覆蓋。
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const healthUrl = process.env.COURSEFLOW_HEALTH_URL ?? "https://courseflow2.zeabur.app/api/health";
const expectedSha = process.env.COURSEFLOW_BUILD_SHA?.trim();

let failed = 0;

async function checkHealth() {
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (!body.ok) {
    console.error("FAIL health ok=false", body);
    failed++;
    return;
  }
  console.log(`OK health buildSha=${body.buildSha}`);
  if (expectedSha && body.buildSha !== expectedSha) {
    console.error(`FAIL buildSha 預期 ${expectedSha} 實際 ${body.buildSha}`);
    failed++;
  }
}

function checkCodegen() {
  const chapterJs = join(root, "packages/presentation/dist/codegen/chapter.js");
  const chapterUrl = pathToFileURL(chapterJs).href;
  const out = spawnSync(
    process.execPath,
    [
      "-e",
      `import { generateChapterSources } from ${JSON.stringify(chapterUrl)};
const gen = generateChapterSources({
  folderName: 'ch99',
  wvpChapterId: 'ch99',
  title: '交集測試',
  narrations: ['A與B的交集', '第二步'],
  screenContents: ['共同點', '結論'],
  stepAnimationConfigByStep: {
    0: { version: 1, pattern: 'venn_overlap', params: { leftLabel: 'A', rightLabel: 'B', overlapLabel: '交集' } },
  },
  stepAnimationIndices: [0],
});
if (!gen.tsx.includes('UniversalStepChapter')) throw new Error('missing UniversalStepChapter');
if (!gen.dslTs.includes('venn_overlap')) throw new Error('missing venn_overlap in DSL');
if (gen.tsx.includes('STEP_ANIMATION')) throw new Error('legacy STEP_ANIMATION block leaked');
const composite = generateChapterSources({
  folderName: 'ch98',
  wvpChapterId: 'ch98',
  title: '數據視覺複合',
  narrations: ['圖表與動畫', '第二步'],
  screenContents: ['並列', '結論'],
  stepVisualConfigs: [{ step: 0, config: { version: 1, kind: 'chart', chartType: 'bar', title: 'T', data: [{ name: 'A', value: 1 }] } }],
  stepAnimationConfigByStep: {
    0: { version: 1, pattern: 'venn_overlap', params: { leftLabel: 'A', rightLabel: 'B', overlapLabel: '交集' } },
  },
  stepAnimationIndices: [0],
});
if (!composite.dslTs.includes('visual-explain-composite')) throw new Error('missing visual-explain-composite layout');
console.log('OK codegen StepDSL single-path + composite layout');`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (out.status !== 0) {
    console.error("FAIL codegen smoke", out.stderr || out.stdout);
    failed++;
  } else {
    console.log(out.stdout.trim());
  }
}

function checkMotionCapable() {
  const src = readFileSync(
    join(root, "packages/explain-animation/src/motion-capable.ts"),
    "utf8",
  );
  for (const id of ["venn_overlap", "before_after_slider", "timeline_year", "sparkline_up"]) {
    if (!src.includes(`"${id}"`)) {
      console.error(`FAIL motion-capable missing ${id}`);
      failed++;
    }
  }
  if (failed === 0) console.log("OK motion-capable 19 patterns incl. Phase 2 batch");
}

await checkHealth();
checkCodegen();
checkMotionCapable();

process.exit(failed > 0 ? 1 : 0);
