import type { ChapterCodegenInput } from "./chapter-types.js";

export function buildNarrationsTs(input: ChapterCodegenInput): string {
  const beatsByStep = new Map<number, string>();
  for (const b of input.stepBeats ?? []) {
    if (typeof b.step === "number" && b.dominantAction) {
      beatsByStep.set(b.step, b.dominantAction);
    }
  }
  const narrLines = input.narrations.map((n, i) => {
    const comment = beatsByStep.get(i) ? ` // ${beatsByStep.get(i)}` : "";
    return `  ${JSON.stringify(n)},${comment}`;
  });
  return `import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
${narrLines.join("\n")}
];
`;
}
