# Web Video Presentation Skill

**把文章或口播稿做成點選驅動的 16:9 網頁演示，並透過錄屏產出有電影感影片的 Agent Skill。**

[English](./README.md) · [返回集合首頁](../../README.zh-CN.md)

![Web Video Presentation Skill](../../dist/imgs/web-video-presentation-skill.png)

---

## 這是什麼？

`web-video-presentation` 幫 Agent 構建一種 Vite + React + TypeScript 演示：它看起來不是傳統幻燈片，而更像為錄屏設計的影片舞臺。每次點選推進一個口播節拍，每一步獨佔 1920×1080 舞臺，進度 UI 平時隱藏，只有懸浮時出現，方便錄出乾淨畫面。

它適合：

- 把文章改寫成 B 站 / YouTube / 影片號風格口播稿
- 把已有口播稿做成有節奏的網頁演示
- 做產品演示、教程、keynote 式講解、視覺 talk
- 做「動態 PPT，但不要像 PPT」的演示體驗
- 在視覺 outline 對齊後，可選合成口播音訊

這個 Skill 的核心是**方法論 + 協作流程**。腳手架提供 token、舞臺原語、主題和示例，但每個專案仍然應該根據主題重新選擇視覺語言。

---

## 核心理念

- **固定 16:9 舞臺**：內容寫在穩定的 1920×1080 座標系裡，再按視口縮放。
- **一個全域 step 遊標**：點選或鍵盤推進 `(chapter, step)`，遊標本地持久化。
- **一步一個想法**：每個節拍獨佔整屏，不堆疊項目符號。
- **口播節拍驅動結構**：講述節奏直接映射為視覺 step。
- **隱藏 chrome**：進度控制懸浮才出現，錄屏畫面保持乾淨。
- **動效優先**：每一步都需要一個移動的視覺錨點，靜態正文是壞味道。
- **主題 token**：視覺屬性透過語義 token 驅動，換主題不只是換顏色。
- **硬 checkpoint**：稿子/主題、outline、音訊合成前都必須停下來與使用者確認。

---

## 工作流

```text
Phase 1.1  識別使用者輸入
Phase 1.2  文章 -> 口播稿
   |
Checkpoint Plan  稿子、主題、粗略素材計劃、開發模式選擇
   |
Phase 2    構建 Vite / React / TS 演示
   |
Checkpoint Audio  詢問是否合成音訊
   |
Phase 3    可選音訊合成
Phase 4    錄屏與後期
```

這些 checkpoint 是 Skill 契約的一部分：Agent 不應該從原文一路悶頭做到成品。主題選擇會影響動效氣質，outline 確認能避免章節節奏跑偏。

---

## 內含內容

```text
skills/web-video-presentation/
├── SKILL.md
├── README.md / README.zh-CN.md
├── references/
│   ├── CHAPTER-CRAFT.md
│   ├── OUTLINE-FORMAT.md
│   ├── SCRIPT-STYLE.md
│   ├── THEMES.md
│   ├── AUDIO.md
│   ├── RECORDING.md
│   ├── URL-PARAMS.md
│   └── EXAMPLES/
├── scripts/
│   └── scaffold.sh
├── templates/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
└── themes/                    # 23 套主題，每套獨立設計簽名
    ├── midnight-press/
    ├── warm-keynote/
    ├── newsroom/
    ├── bauhaus-bold/
    └── ...                     # 完整列表見 references/THEMES.md
```

---

## 快速上手

把這個 Skill 複製到你的 Agent 會掃描的目錄，然後讓 Agent 把一篇文章或口播稿做成網頁影片演示。

如果要手動腳手架：

```bash
bash skills/web-video-presentation/scripts/scaffold.sh ./presentation --theme=paper-press
```

查看可用主題：

```bash
bash skills/web-video-presentation/scripts/scaffold.sh --list-themes
```

生成的 `presentation/` 是普通 Vite + React + TypeScript 專案。啟動後用錄屏工具錄製 16:9 舞臺即可。

---

## 內建主題方向

Skill 內建 **23 套**主題，每套都有獨立的設計 DNA —— 不是簡單的換色版。下面按底色分兩組速覽，挑一套接近你目標氣質的，或者作為派生新主題的起點。

### 深色（8 套）

- `midnight-press` 暗色印刷 —— 電影感編輯、暖暗底 + 火熱橙
- `chalk-garden` 粉筆花園 —— 深石板黑板 + 手寫體 + 粉筆黃
- `terminal-green` 終端綠 —— 80 年代磷光終端 + CRT 掃描線
- `blueprint` 工程藍圖 —— 深海軍 + 製圖青 + 60px 網格
- `dark-botanical` 暗夜植物 —— 暖陶 / 玫粉 / 鎏金疊層，時尚刊物封面
- `neon-cyber` 霓虹賽博 —— 電光青 + 玫紅雙霓虹，未來派
- `bold-signal` 焦點信號 —— 大橙色焦點色卡 + Archivo Black，pitch deck
- `creative-voltage` 電壓創意 —— 飽和電光藍 + 霓黃 + halftone

### 淺色（15 套）

- `paper-press` 亮色印刷 —— 暖奶油紙 + 火熱橙
- `warm-keynote` 暖色 Keynote —— 大圓角 glass slab + 青綠 + 40px 網格
- `newsroom` 報社 —— NYT 大報、奶油 + 墨黑 + 旗紅
- `bauhaus-bold` 包浩斯 —— 0 圓角 + 4px 厚邊 + 偏移實色陰影
- `sunset-zine` 日落 Zine —— 暖桃 + 玫紅 + Fraunces + 虛線剪貼
- `monochrome-print` 黑白印刷 —— 安靜精煉，Monocle / Wallpaper 氣質
- `vintage-editorial` 復古編輯 —— 俏皮 Fraunces + 幾何疊層（圓 / 線 / 點）
- `pastel-dream` 柔光夢 —— 柔粉藍灰 + 鼠尾草綠 + 右側 pill 色條
- `split-canvas` 雙拼畫布 —— 蜜桃 + 薰衣草 50/50 雙底色
- `electric-studio` 電光企業 —— 淨白 + 電光藍 + 貼底 4px 藍條
- `indigo-porcelain` 靛藍瓷 —— 靛藍當墨（不是 accent，是字色本身）+ 瓷白
- `forest-ink` 森林墨 —— 森林綠當墨 + 象牙，舊版國家地理感
- `kraft-paper` 牛皮紙 —— 深棕當墨 + 牛皮米 + 紫銅 accent
- `dune` 沙丘 —— 炭褐 + 沙底，幾乎無 accent，建築畫廊感
- `swiss-ikb` 瑞士克萊因藍 —— 極細 200 weight + IKB + 1px 髮絲網格

完整 token 契約、每套的設計簽名、以及怎麼基於現有主題派生新主題，見 [THEMES.md](./references/THEMES.md)。

---

## Reference Map

- [SKILL.md](./SKILL.md)：完整工作流 + 六大內建能力 + 十條原則 + 所有 Phase 細節
- [CHAPTER-CRAFT.md](./references/CHAPTER-CRAFT.md)：章節實現規則（每章必讀單一入口）
- [OUTLINE-FORMAT.md](./references/OUTLINE-FORMAT.md)：outline 必須遵循的結構
- [SCRIPT-STYLE.md](./references/SCRIPT-STYLE.md)：文章轉口播稿規則
- [THEMES.md](./references/THEMES.md)：完整 token 契約 + 23 套主題 + 創作新主題
- [URL-PARAMS.md](./references/URL-PARAMS.md)：所有 URL 參數速查表
- [AUDIO.md](./references/AUDIO.md)：可選口播音訊合成流程（IndexTTS2 / mmx-cli）
- [RECORDING.md](./references/RECORDING.md)：錄屏與後期注意事項
- [EXAMPLES/](./references/EXAMPLES/)：章節結構示意（不是抄襲模板）
