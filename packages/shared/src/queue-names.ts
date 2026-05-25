/** BullMQ 5+ 不允許佇列名稱含 `:`，Web 與 Worker 共用此常數。v2 前綴避免與 v1 Redis 撞名。 */
export const QUEUE_NAMES = {
  content: "courseflow-v2-content",
  audio: "courseflow-v2-audio",
  subtitles: "courseflow-v2-subtitles",
  craft: "courseflow-v2-craft",
  render: "courseflow-v2-render",
  record: "courseflow-v2-record",
  /** @deprecated v1 投影片視覺佇列，v2 請用 craft */
  visuals: "courseflow-v2-visuals-deprecated",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
