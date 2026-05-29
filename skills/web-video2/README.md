# web-video2

一個 Claude Agent Skill —— 把口播稿、文章、課程、產品演示、talk 做成點選驅動的 16:9 網頁演示，可錄屏產出有電影感的影片。

## 致謝

本專案基於非常出色的 [`web-video-presentation`](https://github.com/ConardLi/garden-skills/tree/main/skills/web-video-presentation) skill（來自 [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills)）改寫。萬分感謝 [@ConardLi](https://github.com/ConardLi) 與 garden-skills 社群 —— 設計哲學、整套工作流（口播稿 → outline → checkpoint → 逐章開發 → 可選音訊合成 → 錄屏）、(chapter, step) 遊標模型、主題 token 架構、「這是影片，不是 PPT」的十條原則、Vite + React + TS 腳手架都源自上游。沒有他們的工作就不會有這個 repo。

## 本 fork 多了什麼

在上游 skill 之上補強了六項能力：

1. **底部字幕條** —— 直接顯示 `narrations[step]`
2. **頂部 hover 功能表** —— Restart / Pause / Play / Auto Section / Auto All + 速度切換 + PDF 下載
3. **一鍵匯出 PDF 簡報** —— 一頁 = 一個 step
4. **右下角頁碼 `{chapter}.{step}`** —— 對話定址用（「重寫 2.3」）
5. **可選全螢幕無黑邊** —— `?fit=cover` opt-in；預設 `contain` 保留上游「what you design is what you see」承諾
6. **Playwright 自動排版自檢** —— 巡所有 step、量字級、查溢出，產 HTML / JSON 報告

並對十條原則中的三條（16:9 固定舞臺 / 隱藏邊角控制元件 / 舞臺無 chrome）做了「Manual / 錄屏雙態」的細則調整 —— 把使用情境從「只錄屏」擴張到「錄屏 + 互動演講 + PDF 簡報 + 對話定址」四種。

Skill 本體（`.claude/skills/web-video-v2/`）已寫成獨立、自洽的工具 —— 文件內部不再引用上游版本。完整改動清單見 [`CHANGES.md`](./CHANGES.md)。

## 目錄結構

```
web-video2/
├── README.md                       ← 本檔
├── CHANGES.md                      ← 相對於上游的完整改動紀錄
├── demo/                           ← demo 內容
└── .claude/skills/web-video-v2/    ← skill 本體
    ├── SKILL.md
    ├── README.md
    ├── manifest.json
    ├── references/
    ├── scripts/
    ├── templates/
    └── themes/
```
