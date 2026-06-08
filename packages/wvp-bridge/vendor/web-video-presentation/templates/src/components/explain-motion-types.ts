/** 與 @courseflow/explain-animation DSL 對齊的精簡型別（presentation 獨立部署，不 import workspace 套件） */
export type MotionSceneConfig = {
  version?: number;
  pattern: string;
  params: Record<string, unknown>;
};

export function isMotionSceneConfig(value: unknown): value is MotionSceneConfig {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.pattern === "string" && o.params !== null && typeof o.params === "object";
}
