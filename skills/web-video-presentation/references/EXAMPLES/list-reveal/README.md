# Anchor: list-reveal（列舉型逐個揭示）

> ⚠️ **這是結構示意，不是抄襲模板**。先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五問。本 anchor 給的是"列舉型章節的結構骨架"（單網格 N 槽位 +
> 每 step 只填一個槽位 + 位置不重排）——保留這個**結構**，**按本專案的
> 主題 + 內容換動作選型**。倒過來照抄 = [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 5 第 8 條「整章只用一種入場動畫」同質化反模式。

## 定位

口播說"三件事 / 四個原因 / N 個特性"時，**每項 1 step 逐個揭示**。
影片中段最常用的章節型別，**最容易翻車成 PPT** —— 這是為什麼需要 anchor。

## 適用場景

- "<主體> 強在哪 → 三件事"
- "選購 <X> → 四個角度"
- "為什麼我喜歡 <X> → 五個理由"
- 任何"主題 + N 個並列子項"的結構

## 假設的 outline.md 章節段（抽象）

```markdown
## 4. <chapter-id> — <主題 N 件事>（N+1 steps）

- **step 1** (~3s) — masthead 引子"<N 件事>"
- **step 2** (~6s) — 第 1 件：<標題> + <article 抽來的細節>
- **step 3** (~6s) — 第 2 件：<標題>
- ...
- **step N+1** (~6s) — 第 N 件：<標題>
```

## 關鍵節奏決策

| step | 視覺佈局 |
|---|---|
| 1 | 中心引子大字 + 序號 01/02/.../N 佔位（**不顯示內容**，純佔位） |
| 2 | "01" 槽位填充：標題 + 簡短說明 + accent 編號；其餘仍是 ghost |
| 3 | "02" 填充；01 已啟用變次級；其餘仍 ghost |
| ... | 當前槽位填充；之前的啟用降級；之後的 ghost |

## CHAPTER-CRAFT.md Part 0 原則 8 的核心實現

> "佈局不重排，只是單元格內容變化"

整個章節只有**一個網格佈局**，N 個槽位的 React 節點位置完全不變。
變的只是每個槽位的內容狀態（ghost / active / past）。這樣：
- 單元格不會重排 → 視覺穩
- 每點一次只有"一個槽位變化" → 觀眾視線明確鎖定新揭示的項

**反模式**：每點一次重新渲染整個佈局 → 已揭示的項也跟著抖動 / 重新
入場 → 觀眾不知道該看哪。

## 檔案結構

```
list-reveal/
├── README.md
├── chapter.tsx     ← 完整章節示例 —— 預設綁 newsroom 主題
└── chapter.css
```

## 關鍵手段（地板線）

| 維度 | 這個 anchor 怎麼實現 |
|---|---|
| 字號 | 標題 64px / 巨號 144px serif |
| 槽位狀態 | dashed → 巨號紅色高亮 → 灰化數字（**位置不重排**） |
| 序號 | hero-num 字型（襯線大數字） |
| 主導動作 | mask reveal（標題）+ 數字砸下（accent 紅） |
| 伴隨動作 | 副標 stagger 200ms + accent 橫線 scaleX |
| 持續微動 | active 槽位的數字 accent 光暈 `infinite` 呼吸 |
| 引子 | masthead 雙線規則 + serif 大字 |

> **新寫章節時**：抄結構（單網格 N 槽位、每 step 只填一個槽位、位置
> 不重排），按本章內容 + 本主題氣質自由設計主導動作的形式。

## 切到其它主題時

- `bauhaus-bold` → 序號換 Archivo Black + 大色塊；用 hard-cut 砸下
- `terminal-green` → 序號 `[01]` `[02]` `[03]` 風格；打字機入場
- `chalk-garden` → 粉筆下劃線手繪 + wiggle 入場
- `midnight-press` → 數字 blur clear 慢銳化 + 暖橙光暈慢呼吸

**結構不變**：N+1 step、單網格 N 槽位、每 step 只填一個槽位。

## 想看具象題材應用

- 科技測評 / 實測對比類影片用這個 anchor 長什麼樣 →
  [`../case-tech-review/outline-snippet.md`](../case-tech-review/outline-snippet.md)
  裡 `## 2. why-strong` 章節
