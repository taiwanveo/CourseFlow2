# Outline 節選 · 科技測評類 case

> **節選**：前 2 章（10 step），用來展示 outline 在科技測評題材裡的
> 形狀。完整版 7 章 36 步在呼叫此 Skill 的具體專案裡，不進 spec。

> **主題**：`midnight-press`（電影感慢鏡、blur clear、暖橙 accent、
> scanline；剋制有重量。**禁**砸下 shake / 彈簧 / emoji）
>
> **總時長**：約 6 分 30 秒

---

## 1. coldopen — 登頂懸念（5 steps · ~30s）

- **step 1** (~5s) — 暗場遠景粒子云 + 鉤子字幕"我刷到一張圖，愣了三秒"
  · 動畫：螢幕從純黑慢速 fade 到暗暖底（1.5s ease-out）→ 遠景光塵粒子云慢漂浮入（1.0s 錯峰）→ 字幕 mono 打字機逐字打出（每字 100ms）；持續微動：粒子云永不停 brownian 漂移 + 暖橙暗角光暈 6s 週期慢呼吸 + ken burns 緩推
  · 手段：CSS background 慢 fade + Canvas 粒子云慢漂 + JS typewriter + filter: drop-shadow 暖橙呼吸 + transform: scale 永動 ken burns

- **step 2** (~7s) — 排行榜慢鏡景深聚焦 + 主分數 hero 數字 blur clear 浮出
  · 動畫：截圖從 blur(12px) + scale(1.05) 慢速景深聚焦（1.5s ease-out）→ 主分數從 blur(20px) 慢慢銳化（1.2s 錯峰 400ms）→ 王冠 SVG 沿數字外圈慢速 mask reveal（1.5s）；持續微動：主分數暖橙光暈 5s 呼吸 + ken burns 緩推
  · 手段：filter: blur 反向 + transform scale 慢推 + clip-path 沿 path mask reveal + filter: drop-shadow 呼吸
  · article 補：主分數（來自 article §1，具體數字）+ 測評視窗（"X 月 N 日 ~ Y 日"）+ 投票數（mono cue 角標）—— 口播只說"換榜首"，畫面把"領先多少 / 多少票投出來的"全掛上

- **step 3** (~6s) — 第 2 名對比橫條 + "+差距分"慢浮銳化
  · 動畫：第一條從左向右慢速 mask reveal 拉到 100%（1.2s ease-out）→ 第二條同向 mask reveal 但只到 ~70%（錯峰 600ms）→ 中間空缺區差距分從 blur(15px) 慢慢銳化進場（錯峰）；持續微動：差距區暖橙光暈慢呼吸 + accent 橫線 8s 緩延展永動 + scanline 極淡 overlay 慢移
  · 手段：clip-path inset 慢 reveal + filter: blur 反向 + linear-gradient 暖光暈 + linear-gradient scanline 永動
  · article 補：第 2 名具體名字（article §1）+ 差距分（具體數字 vs 模糊"低很多"）+ 趨勢註釋（"過去 N 周首次反超"）

- **step 4** (~6s) — 官方原話 pull-quote 慢鏡入場（電影感引文）
  · 動畫：左右兩枚巨大引號 SVG 從 opacity 0 + blur(15px) 慢速銳化進場（1.0s 錯峰 200ms，**無砸下**）→ 引文文字 mono 打字機逐字打出（每字 80ms）→ 落款慢速 blur clear 浮出（0.8s）；持續微動：引號暖橙慢光暈呼吸 + 鏡頭 ken burns 緩推
  · 手段：filter: blur 反向銳化 + JS typewriter + transform translateY 慢推 + filter: drop-shadow 呼吸
  · article 補：原話直引（來自 article §1，1~2 句）+ 落款來源（"— 出處.AI"）—— 引文是 article 裡口播完全省略的"權威背書"

- **step 5** (~5s) — 主持人介紹 + 4 件事預告速覽
  · 動畫：第一行自我介紹 blur clear 慢入場（1.2s ease-out）→ 4 張佔位卡分別從 blur(15px) 慢速景深聚焦 stagger 出現（每張 250ms 錯峰，每張 1.0s 慢鏡），卡內 mono 數字 01/02/03/04 + 關鍵詞；持續微動：每張卡暖橙邊線慢光暈呼吸（錯峰 400ms）+ 遠景粒子永漂
  · 手段：filter: blur 反向 + opacity 慢 fade + transform scale 慢推 + filter: drop-shadow 多 instance 錯峰呼吸
  · article 補：4 件事的關鍵詞（來自 article 章節標題，簡化）

口播節選：
> 我刷到一張圖，愣了三秒……今天講清楚四件事。

---

## 2. why-strong — 強在哪（5 steps · ~80s）

- **step 1** (~6s) — hero"強在哪 · 四個方向" + 4 個 ghost 佔位卡
  · 動畫：hero 字元整體從 blur(20px) + opacity 0 慢速景深聚焦（1.5s ease-out）→ 下方暖橙長橫線從中心向兩側慢延展（0.8s）→ 4 張 ghost 卡片同步從 blur 慢鏡出現（保持 opacity 0.3 佔位狀態）；持續微動：暖橙下劃線 8s 週期慢光暈脈衝 + ghost 卡片暖暗邊線慢閃
  · 手段：filter: blur 反向 + transform scaleX 慢延展 + opacity 階梯填充 + filter: drop-shadow 永動呼吸
  · article 補：4 個方向各自的關鍵詞（mono cue 標籤，"01 X / 02 Y / 03 Z / 04 W"）

- **step 2** (~16s) — 第 1/4 項填實 + 大圖慢鏡 takeover
  · 動畫：卡片 1 從 ghost 狀態慢速 mask 填實（0.8s 暖暗底色 + 邊線慢光暈亮起）→ 中央 hero 大圖從 blur(15px) 慢速景深聚焦（1.5s ease-out）→ mono cue 標籤從暗角慢速 blur clear 入場（0.8s）→ 副標打字機逐字打出（每字 80ms）；持續微動：暖橙 accent 高亮條永動呼吸 + 大圖 ken burns 緩推（0.5% scale 12s 週期）+ scanline 慢移
  · 手段：filter: blur 反向 + clip-path 慢 reveal + JS typewriter + transform scale 永動 ken burns + linear-gradient scanline 永動
  · article 補：本項的具體表現（article §2 抽 1~2 個資料點 / 案例標籤）—— 口播只說"它強在 X"，畫面掛"具體強到 N% / 跑贏 M / 測評分數 K"

- **step 3** (~16s) — 第 2/4 項填實 + 列表/演示
  · 動畫：卡片 2 慢速 mask 填實（0.8s）→ mono cue 標籤 blur clear 慢入場（0.8s）→ 4 行具體細則 typewriter 逐行打出（每行 0.8s 錯峰 350ms）→ 每行末尾 mono 遊標閃爍後追加暖橙對勾 SVG path stroke 慢繪製；持續微動：mono 遊標永閃爍（800ms blink）+ scanline 慢移
  · 手段：JS typewriter + opacity blink 遊標 + SVG path stroke-dashoffset 慢繪 + linear-gradient scanline overlay 永動
  · article 補：4 行細則的具體內容（來自 article §2 第 N 段子列表）—— 口播只說"指令遵循好"，畫面把 article 列出來的 4 個具體維度"主體放哪 / 背景怎麼搭 / ..."逐行打出來

- **step 4** (~16s) — 第 3/4 項填實 + before/after 慢鏡對照 + 永動 cross-fade
- **step 5** (~16s) — 第 4/4 項填實 + 多引數預覽 + redacted 註釋

口播節選：
> 實測下來強在四個方向 ……

---

> **觀察**：每個 step 的畫面都做到"口播說一件事，畫面掛多件事"。比如
> step 2 口播只是"第一項很強"，畫面同時呈現：本項關鍵詞 / 大圖例項 /
> 具體資料點 / 副標補充 —— 這是雙源原則的具象落地。
