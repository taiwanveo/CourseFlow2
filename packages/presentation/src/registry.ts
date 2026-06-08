import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bumpPresentationStepperKey } from "./stepper-bump.js";

export interface RegistryChapterEntry {
  folderName: string;
  wvpChapterId: string;
  title: string;
  componentName: string;
  componentFileName: string;
}

export async function writeChaptersRegistry(
  presentationDir: string,
  chapters: RegistryChapterEntry[],
  opts?: { removeExample?: boolean },
): Promise<void> {
  if (opts?.removeExample) {
    await rm(join(presentationDir, "src", "chapters", "01-example"), {
      recursive: true,
      force: true,
    });
  }

  const imports = chapters
    .map((ch) => {
      const narrVar = `narrations_${ch.wvpChapterId.replace(/-/g, "_")}`;
      return `import ${ch.componentName} from "../chapters/${ch.folderName}/${ch.componentName}";
import { narrations as ${narrVar} } from "../chapters/${ch.folderName}/narrations";`;
    })
    .join("\n");

  const entries = chapters
    .map(
      (ch) => `  {
    id: ${JSON.stringify(ch.wvpChapterId)},
    title: ${JSON.stringify(ch.title)},
    narrations: narrations_${ch.wvpChapterId.replace(/-/g, "_")},
    Component: ${ch.componentName},
  },`,
    )
    .join("\n");

  const content = `import type { ChapterDef } from "./types";
${imports}

/** CourseFlow — 由 Studio 依 chapter_craft 自動維護 */
export const CHAPTERS: ChapterDef[] = [
${entries}
];
`;

  await writeFile(join(presentationDir, "src", "registry", "chapters.ts"), content, "utf8");
  await bumpPresentationStepperKey(presentationDir);
}

/** 寫入章節間轉場設定（長度須為 chapterCount − 1） */
export async function writeChapterTransitionsRegistry(
  presentationDir: string,
  transitions: string[],
): Promise<void> {
  const lines = transitions.map((t) => `  ${JSON.stringify(t)},`).join("\n");
  const content = `/**
 * 章與章之間的轉場（由 CourseFlow Studio 打包時寫入）。
 * 長度 = 章節數 − 1；索引 i 表示第 i 章結束 → 第 i+1 章開始的轉場。
 */
export const CHAPTER_TRANSITIONS: string[] = [
${lines}
];
`;
  await writeFile(
    join(presentationDir, "src", "registry", "chapter-transitions.ts"),
    content,
    "utf8",
  );
}
