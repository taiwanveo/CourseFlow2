# Case: 科技測評類（tech review）

一篇 AI / 工具 / 產品**實測對比**類文章 → 7 章 36 步、6 分 30 秒影片
的真實案例。

> ## ⚠️ 這是結構示意 / 歷史案例，不是抄襲模板
>
> 這個目錄的角色是讓 agent 看："**測評類影片章節怎麼切、資訊池怎麼
> 抽、章長怎麼定**"。**它包含的具體動畫描述（如"慢速 blur clear
> 1.5s ease-out / 打字機每字 80~100ms"）屬於歷史版本** —— 新版
> outline 已經**不寫動畫 / 不寫時長**（見 [`../../OUTLINE-FORMAT.md`](../../OUTLINE-FORMAT.md)）。
> 新寫 outline 時只寫"螢幕內容 + 關係名字首 + 章節級資訊池"，動畫
> 選型留給章節實現階段按 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五問決定。
>
> **看這個 case 學的應該是**：
> 1. 測評類怎麼切 7 章（鉤子 → 優點 → 場景 → 進階 → 收束）
> 2. 章長怎麼定（每章 4~6 step 防疲勞）
> 3. 雙源原則怎麼落地（hero 來自 script / 資料角標來自 article）
>
> **不應該學**：動畫選型、CSS 實現、時長數值（這些已下放到 chapter
> 階段）。

## 適用場景

- AI 模型 / 產品 / 工具的實測體驗文
- 多家產品對比（A vs B vs C）
- 跑分 / benchmark / 使用者投票資料驅動的內容
- "強在哪 / 怎麼用 / 怎麼用得好"型結構

## 關鍵決策

| 維度 | 這個案例的選擇 | 通用啟發 |
|---|---|---|
| 主題 | `midnight-press`（電影感慢鏡、blur clear、暖橙 accent、scanline） | 科技測評類適合"剋制、有重量"的暗色調；避開俏皮 / 糖果色 |
| 章節切分 | 7 章：開場懸念 / 強在哪 / 哪能用 / 怎麼用好 / Skill 介紹 / Skill 模式 / 收尾 | 測評類的標準結構：鉤子 → 優點 → 場景 → 進階 → 收束 |
| 章長 | 每章 4~6 step | 測評類資訊密度高，每章不超過 6 step 防止觀眾疲勞 |
| 雙源應用 | hero 標語來自 script、畫面密度（具體分數 / 投票數 / 時間戳）來自 article | 測評類 article 資料極多 —— 用 mono cue / 角標 / 資料浮層掛出來 |
| 動畫風格 | 慢速 blur clear / 打字機 / ken burns 緩推 | midnight-press 暗色印刷氣質，章節實現時按主題氛圍自由發揮 |

## 檔案

- [`outline-snippet.md`](outline-snippet.md) —— 前 2 章完整節選（5 + 5 step），
  展示雙源原則在 outline 裡怎麼落地

> 完整 7 章 outline 在呼叫此 Skill 的具體專案裡（`gpt-image2-video/outline.md`），
> 不放進 Skill 倉庫 —— 避免 Skill spec 被某一個專案內容汙染。

## 不在這個 case 出現的情形

測評類**通常不需要**：
- 慢節奏長鏡頭（電影感片頭 / 旅行 vlog 才需要）
- 手寫溫暖感（教育 / 親子 / 食譜才需要）
- 大量插畫（設計稿 / 工藝品類才需要）

→ 選別的 case anchor 或自由發揮。
