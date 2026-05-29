# Anchor: hook-chapter（鉤子型開場）

> ⚠️ **這是結構示意，不是抄襲模板**。先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五問。本 anchor 給的是"鉤子型開場的結構骨架"——你要保留它的
> step 切分邏輯、字號關係、佈局原則，**按本專案的主題 + 內容換動作
> 選型**。倒過來照抄 = [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 5 第 8 條「整章只用一種入場動畫」同質化反模式。

## 定位

影片開頭最常用的章節型別：**拋 N 張可疑圖 / 反例 / 截圖 → 引出主題 →
切大字 hero takeover**。

## 適用場景

- 懸念型開頭：先甩 3~4 張讓人懷疑 / 困惑的圖，再揭示原因
- "今天聊聊 X 的幾個翻車現場"：先看翻車，再切主題
- 產品釋出的"問題感"開場：先看痛點截圖，再揭示新功能

## 假設的 outline.md 章節段（抽象）

```markdown
## 2. hook — <章節標題>（6 steps）

- **step 1** (~4s) — N 張可疑圖片佔位（虛線 ghost 卡片）
- **step 2** (~5s) — 第 1 張露出：<反例 1 描述>（獨佔視覺）
- **step 3** (~5s) — 第 2 張露出：<反例 2 描述>（獨佔視覺）
- **step 4** (~5s) — 第 3 張露出：<反例 3 描述>（獨佔視覺）
- **step 5** (~4s) — 三張圖同時縮入側欄，中間出 <主題大字> takeover
- **step 6** (~3s) — 切到下一句鉤子（被 brush 劃掉）
```

## 關鍵節奏決策

| step | 節奏意圖 | 視覺 |
|---|---|---|
| 1 | 拋懸念 —— N 張未知 | 虛線 ghost 卡片，1/3 屏一張 |
| 2-N | **每張圖獨佔視覺** —— 重點不是"湊數"，是讓觀眾盯著每張圖想"這是真的嗎" | 大圖佔據 ~70% 螢幕，旁邊小字標註圖源 |
| N+1 | takeover —— 揭示主題 | 三張縮成左側迷你卡，中間巨字 |
| 末 | 鉤子收束 | brush 劃掉舊概念，引下一章 |

## 為什麼 2-N 不能 stagger 同時上

口播會**逐個念出來** —— 必須 1 項 = 1 step（[CHAPTER-CRAFT.md Part 0 原則 8](../../CHAPTER-CRAFT.md#8-多點內容必須逐個揭示絕不同時上)）。
同時 stagger 上 = 觀眾掃一眼看完，講者還在唸第一張 = PPT 直覺。

## 檔案結構

```
hook-chapter/
├── README.md       ← 本檔案
├── chapter.tsx     ← 完整章節示例 —— 預設綁 newsroom 主題
└── chapter.css
```

## 關鍵手段（地板線）

| 維度 | 這個 anchor 怎麼實現 |
|---|---|
| 素材 | `<img src="/hook/<asset>.png" />` 真截圖 |
| 字號 | hero = 144px serif (`var(--t-display-1)`) |
| 主導動作 | brush-stroke + 印章砸下（newsroom 氣質） |
| 伴隨動作 | accent 紅條 scaleX + 副標 stagger 200ms |
| 持續微動 | accent 紅條光暈 `infinite` 呼吸；圖片 ken burns 緩推 |
| 卡片樣式 | drop-shadow + 微旋轉 1deg |
| takeover | 三張圖縮入 + hero 巨字爆出 + accent 紅條貫穿 |

> **新寫章節時**：抄結構和字號關係，按本章內容 + 本主題氣質自由
> 設計動畫形式。**持續微動按需掛**，不強求 —— 詳見
> [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)「避免 AI 味」一節
> 關於「每步都掛 ken burns / 持續閃爍」的反模式。

## 切到其它主題時

- `bauhaus-bold` → brush 劃掉換 hard-cut 大色塊；hero 字型換 Archivo Black
- `terminal-green` → 三張圖換"FILE_001/002/003"佔位框；hero 用打字機
- `chalk-garden` → 粉筆感虛線 + 慢速 wiggle 入場
- `midnight-press` → blur clear 慢鏡入場 + ken burns + scanline；
  takeover 改"主標 blur 銳化 + 暖橙光暈呼吸"

**結構（N+2 步、獨佔節奏、takeover、收束）保持不變。**

## 想看具象題材應用

- 科技測評 / 實測對比類影片用這個 anchor 開場長什麼樣 →
  [`../case-tech-review/`](../case-tech-review/)
