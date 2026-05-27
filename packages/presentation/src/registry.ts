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
