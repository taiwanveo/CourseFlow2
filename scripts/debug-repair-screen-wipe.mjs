/**
 * 本機驗證 H-A：repair 是否會把含螢幕文案的 ListReveal 判定為需升級。
 */
import { needsChapterContentUpgrade } from "../packages/presentation/dist/visual-demo.js";
import { generateChapterSources } from "../packages/presentation/dist/codegen/chapter.js";

const sampleTsx = `import { ListRevealGrid } from "../../components/ListRevealGrid";
const ITEMS = [
  { num: "01", title: "程式碼代理：提升開發效率的工具", body: "" }
] as const;
export default function ChapterChapter01({ step }) {
  return (
    <ListRevealGrid
      step={step}
      introTitle={"Harness Engineering for Coding Agent Users：給程式碼代理使用者的駕馭工程"}
      introSub={""}
      items={[...ITEMS]}
    />
  );
}`;

const narrations = ["intro", "content step"];

const needsUpgrade = needsChapterContentUpgrade(sampleTsx, "/* css */", narrations);
console.log("[DEBUG-c64e28] needsChapterContentUpgrade (current build):", needsUpgrade);

if (needsUpgrade) {
  const regen = generateChapterSources({
    folderName: "00-chapter-01",
    wvpChapterId: "chapter-01",
    title: "Harness",
    narrations,
    forceTemplate: "list-reveal",
  });
  console.log("[DEBUG-c64e28] regenerated has placeholder:", /重點 1|本章/.test(regen.tsx));
  console.log("[DEBUG-c64e28] regenerated has agent text:", /程式碼代理/.test(regen.tsx));
  console.log("[DEBUG-c64e28] regenerated item:", regen.tsx.match(/title:\s*"([^"]+)"/)?.[1]);
} else {
  console.log("[DEBUG-c64e28] repair would SKIP upgrade — screen text preserved");
}

// 模擬 d0546c0 舊邏輯
const oldWouldUpgrade =
  /ListRevealGrid/.test(sampleTsx) && !/imageUrl|lr-featured-img/.test(sampleTsx);
console.log("[DEBUG-c64e28] d0546c0 old logic wouldUpgrade:", oldWouldUpgrade);
