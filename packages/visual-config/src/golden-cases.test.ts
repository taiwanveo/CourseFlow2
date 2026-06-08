import assert from "node:assert/strict";
import { test } from "node:test";
import { runGoldenCaseHeuristics } from "./golden-cases.js";

test("B4：啟發式 VisualConfig 黃金案例", () => {
  const result = runGoldenCaseHeuristics();
  assert.equal(
    result.failed.length,
    0,
    result.failed.map((f) => `${f.id}: ${f.reason}`).join("\n"),
  );
  assert.ok(result.passed > 0, "至少應通過一則黃金案例");
});
