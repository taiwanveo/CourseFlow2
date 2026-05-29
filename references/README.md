# 外部參考（朋友分享）

本目錄存放**非 CourseFlow 原始碼**的設計參考，供 WVP / Craft 演進時 `@` 引用。

| 檔案 | 作者方向 | CourseFlow 採用重點 |
|------|----------|---------------------|
| [theme-content-aware-slide-viz-guide.md](./theme-content-aware-slide-viz-guide.md) | 宣告式 JSON + zod + 三層架構 | **主軸**：LLM 不寫繪圖 code；`colorRole` 對應 WVP token |
| [SlideVisualAI.jsx](./SlideVisualAI.jsx) | Next/React + recharts 原型 | **參考實作**：ChartRenderer 行為；配色改為 token 驅動 |

路線圖見 [docs/WVP-ROADMAP-NEXT.md](../docs/WVP-ROADMAP-NEXT.md)。  
新成員上手請先讀 [docs/HANDOVER.md](../docs/HANDOVER.md)。
