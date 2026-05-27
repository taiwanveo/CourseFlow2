# WVP 品質 Rubric（北極星對照）

對照目標：[Stanford AI 系統課程解說片](https://www.youtube.com/watch?v=eKW9ITaltWw) 與 [CHAPTER-CRAFT](../packages/wvp-bridge/vendor/web-video-presentation/references/CHAPTER-CRAFT.md)。

## 必達（MVP 匯出閘門）

1. **視覺演示**：每章含 `ListRevealGrid` / `FlowDiagram` / 自寫 SVG·Canvas·@keyframes，禁止整章純文字牆。
2. **清單揭示**：口播「第一、第二…」→ 引子 1 step + 每項 1 step（`ListRevealGrid`）。
3. **流程動畫**：概念推進章 → `FlowDiagram` 節點逐步點亮。
4. **口播綁定**：TSX 內可見文字來自 `narrations` 原文。
5. **雙源**：畫面含 `article` / `screenContent` 比口播更密的 mono cue 或標籤。
6. **Anchor**：第 1 章人工驗收後，第 2–N 章才允許批量 Craft。
7. **反 AI 味**：無紫粉漸層、假統計、`StepContentViz` 關鍵詞雲。

## 進階（持續逼近）

- Hook 多圖開場、數字 hero、對照長條（見 EXAMPLES）。
- 錄屏 `?auto=1` 在口播結束後保留 ≥900ms 動效尾韻。
- 全章 `chapter_craft.checklist_result.passed === true` 才可匯出 MP4。
