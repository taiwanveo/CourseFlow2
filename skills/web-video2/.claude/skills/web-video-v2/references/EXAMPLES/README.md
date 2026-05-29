# EXAMPLES —— 完整章節 / 題材 anchor

> ## ⚠️ 這是**結構示意**，不是抄襲模板
>
> 這些 example **不是給你照抄的**。它們的角色是"看一個完整章節大概
> 什麼形狀、動畫怎麼分層、CSS 用了哪些 token、outline 長什麼樣"。
>
> **正確使用流程**：
>
> 1. 走完 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md) Part 0 五問
> 2. 實在卡殼"我這一章的整體結構應該是什麼"才翻 EXAMPLES
> 3. **保留它的"形"**（step 切分邏輯、字號關係、佈局原則），**按本
>    專案的主題 + 內容換動作選型**
>
> 倒過來——先翻 EXAMPLES 選一個照搬到底 = [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
> Part 5 第 8 條「整章只用一種入場動畫」同質化反模式（每個使用者的影片
> 看起來像同一個模板的 N 個變奏）。

兩類參考資源，讓 agent 在寫章節時**有具體形狀可參考**，不用從零設計。

> **不是必須按這個寫**。卡殼時翻一翻；用力發揮時大膽偏離。

## 目錄

### A. 章節結構 anchor（與題材無關）

| 例子 | 適用場景 | 檔案 |
|---|---|---|
| [`hook-chapter/`](hook-chapter/) | **鉤子型開場** —— 多張圖片逐張揭示後 hero takeover | `chapter.tsx` + `chapter.css` |
| [`list-reveal/`](list-reveal/) | **列舉型** —— 口播說"三件事 / N 個特性"，每項 1 step | `chapter.tsx` + `chapter.css` |

每個 example 都是**完整章節**：**內容驅動主導動作** + 必要的伴隨動作
（**不強求掛持續微動**，按 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
Part 0 原則 7 節制使用）、真素材（不是佔位卡）、字號狠對比、綁了
`newsroom` 主題作為示範。

### B. 題材 case anchor（與題材相關）

| 例子 | 題材 | 檔案 |
|---|---|---|
| [`case-tech-review/`](case-tech-review/) | 科技測評 / 實測對比 / 跑分類影片 | README + outline 節選 |

> 題材 case 展示**真實 outline 的樣子**（含 article 補欄位如何填、
> 章節切分如何決策）。拿到與某個 case 題材相似的需求時，先翻它再
> 寫自己的 outline。

## 怎麼用

### 寫章節卡殼時

1. 看哪個 anchor 跟你這一章**結構最像**（鉤子型 vs 列舉型 vs 其它）
2. 翻 `README.md` 看這個例子的設計思路 + 節奏
3. 翻 `chapter.tsx` 看實現：JSX 結構、`step` 切分、用了哪些元件 / 類名
4. 翻 `chapter.css` 看動畫用了哪些 keyframes、token、`infinite` 持續
   微動寫在哪
5. 寫自己這一章時**保留 anchor 的"形"，按本章內容 + 本主題氣質換動畫選型**

### 切換主題時

每個 example 的 README 末尾有"切到其它主題怎麼換"的提示 —— 通常只需要
**換主導動作的形式**（newsroom 印章砸下 → terminal 打字機 → chalk
粉筆自繪），**結構、step 切分、字號關係不動**。

---

## ⚠️ 這兩個 anchor 是"地板"，不是"天花板"

這兩個例子已經引入印章砸下、stagger、accent 紅條 —— 但**仍然是相對克
制的版本**。**鼓勵你做得更狂、更"影片感"**：

### 進階玩法（任選搭配）

| 維度 | 這倆 anchor 給的（地板） | 可以升級到（無上限） |
|---|---|---|
| 背景層 | 純色 surface | + SVG turbulence filter 紙紋永不停斜向漂移 |
| 主導動作 | mask reveal + 印章砸下 | + Canvas 粒子從螢幕外匯聚成 hero 字 |
| 伴隨動作 | accent 紅條 scaleX | + SVG path stroke-dashoffset 自繪下劃線 / 裝飾花紋 |
| 持續微動 | accent 光暈呼吸 | + 多層粒子漂移 / scanline / ken burns 緩推 |
| 數字 hero | 直接顯示 | + JS 數字滾動（`requestAnimationFrame` + easeOutQuart） |
| 流程 / 架構 | 僅文字列 | + SVG path 自繪流程圖（每條線 stroke-dashoffset 錯峰） |
| 對比圖 | 兩段文字 | + SVG 雙柱圖自繪 + 差值數字滾動 |
| 轉場 | 章節邊界硬切 | + clip-path inset 橫向擦除轉場 |

→ 詳細工具箱見 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md) Part 2
"視覺手段全棧工具箱"（CSS / SVG / Canvas / JS 四層）。

### 實測原則

寫章節時，**先實現 anchor 同等的地板版本**（按 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
Part 0 五問選好主導動作），跑起來確認氣質對，**再決定要不要加伴隨
動作 / 持續微動**。

**判斷標準**：
- 如果不同 step 的主導動作夠多樣（PPT 警報透過 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
  Part 0 原則 7 自檢）= 不需要再加持續微動
- 如果整章主導動作太單一 = 不要靠"加持續微動"補救，**回 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
  Part 1 五問換主導動作**才是正解（參 Part 5 第 8 條「整章只用一種入場動畫」）

## 不在 EXAMPLES 裡出現的章節型別

- **數字型 hero**（"+47%"  → "幾乎快了一倍"）
- **對比型**（前後對照 / 雙柱圖）
- **連結卡片收尾**

這些場景的視覺原語已經在 [`../CHAPTER-CRAFT.md`](../CHAPTER-CRAFT.md)
Part 3 視覺工具箱（CSS / SVG / Canvas / JS 全棧）裡覆蓋了；按 anchor
的"形"組合即可。
