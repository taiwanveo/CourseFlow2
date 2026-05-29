# `outline.md` 格式 spec

影片章節規劃的產出檔案。**使用者可以直接編輯**，所以格式必須人類友好
（用 markdown 不用 JSON / YAML）。

!重要：閱讀此檔案後必須繼續閱讀 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 的全部內容，瞭解對網頁效果的真實需求，然後再開始編寫 outline

> ## ⚠️ outline 是開發計劃，不是視覺規劃
>
> outline 只規劃**節奏 + 內容 + 資訊密度**：
>
> - 章節切分 / 每章 step 數 / 每步估時
> - 每步螢幕內容（hero / 標語 / 資料 / 列表項）
> - 章節級**資訊池**（從 article 抽的數字 / 引用 / 案例 / 標籤）
>
> **outline 裡的 step 數是初始預估**。最終 step 數以章節實現時的
> `narrations.ts` 為準——後者既是 step 數源，也是音訊合成源
> （詳見 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 「程式碼層最小約束」+
> [`AUDIO.md`](AUDIO.md)）。如果實現時章節 step 數和 outline 不一致，
> 回過來同步 outline 即可，不需要糾結"對得嚴絲合縫"。

> **寫 outline 前必讀**（雙源原則，[CHAPTER-CRAFT.md Part 0 原則 10](CHAPTER-CRAFT.md#10-雙源原則scriptmd-定節拍--articlemd-定畫面密度)）：
>
> - **`script.md`** —— 決定**節拍**：按 `---` 切節拍，每節拍 1~2 step、估時
> - **`article.md`**（如有）—— 決定**畫面資訊密度**：每章首段抽**資訊池**

---

## 抽象示例（看格式）

````markdown
# Video Outline

> **主題**：`<theme-id>`（Checkpoint Plan 已選定）—— <一句話風格描述>
> **總時長**：約 <T> 分 <S> 秒（口播 ~<X> 字 ÷ 4 字/秒）
> **章節數**：<N> 章 / <M> 步

---

## 1. <chapter-id> — <章節標題>（<S> steps · ~<T>s）

**資訊池**（chapter agent 按需掛角標 / 副標 / pull-quote / mono cue）：
- <型別：數字 / 引用 / 出處 / 案例 / 詞義 / 時間 / 對比 / ...>：<內容> —— <來源 article §X / Lxx>
- ...

**開發計劃**：

- step 1 (~Ts) — <螢幕內容>
- ...

口播節選：
> <1~3 句節選，對應到 script.md 完整文字>

---

## 2. <chapter-id> — ...
````

> **關於時長**：outline 裡**只**寫 step 的 `(~Ts)` 口播估時（音畫對齊
> 用），**絕對不寫**動畫時長 / 錯峰量 / keyframe 數值。這些都在章節開發
> 階段決定（[`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) Part 3 時長參考）。

> **想看具象示例**：
> - 鉤子型開場結構 → [`EXAMPLES/hook-chapter/`](EXAMPLES/hook-chapter/)
> - 列舉型章節結構 → [`EXAMPLES/list-reveal/`](EXAMPLES/list-reveal/)
> - 科技測評類（實測 / 對比 / 跑分） → [`EXAMPLES/case-tech-review/`](EXAMPLES/case-tech-review/)

---

## 欄位約定

### 頂部 metadata block

用引用塊（`>`）形式，方便掃一眼整體規模：

| 欄位 | 必填 | 說明 |
|---|---|---|
| **主題** | ✓ | Checkpoint Plan 必須已選定。chapter agent 實現時按主題顏色 / 字型 token 走，動畫 / 節奏 / 視覺演示由章節自由發揮 |
| **總時長** | ✓ | 估算口播時長（中文 ~ 250 字 / 分鐘） |
| **章節數** | ✓ | `N 章 / M 步` |

### 章節標題：`## N. <id> — <title>（<S> steps · ~<T>s）`

| 部分 | 規則 |
|---|---|
| `N` | 1-indexed 順序，對齊 `chapters.ts` 的註冊順序 |
| `<id>` | **小寫 + 連字元**。會成為 React `key` / 資料夾名 (`src/chapters/0N-<id>/`) / 音訊子目錄 (`public/audio/<id>/`) |
| `<title>` | 給人看的中文標題。**不會**進 React 程式碼 |
| `<S> steps` | 該章 step 總數 |
| `~<T>s` | 該章口播總估時（中文 ~ 4 字/秒） |

合法 id：`coldopen`、`hook`、`why-good`、`why-good-text-render`。
不合法：`why_good`（用連字元）、`Hook`（小寫）、`第一章`（拉丁字元）。

### 章節首段「資訊池」（**雙源原則核心落地**）

每章獨立列出從 `article.md` 抽的細節集合，**讓 chapter agent 實現每步
畫面時按需取用**——可能掛成右下角 mono 角標 / 副標小字 /
pull-quote 引用 / 資料浮層。

#### 資訊池條目格式

```
- <型別>：<具體內容> —— <來源 article §X / Lxx 或簡注>
```

> **沒 article（使用者直接給 script）**：資訊池退化為"主動設計畫面資訊
> 密度"——靠數字 / 對比 / 後設資料等讓畫面比口播資訊密。可以列"畫面
> 裝飾元素池"而非"article 抽取池"。

### Step 列表：每步 **1 行**

```
- step N (~Ts) — <螢幕內容>
```

| 規則 | 原因 |
|---|---|
| `step N` 1-indexed | agent 實現時 `if (step === N - 1) ...`（注意零基偏移） |
| **`(~Ts)`** 必填 | 按 script.md 本步對應口播段字數 ÷ 4 估算（中文 ~ 4 字/秒）。範圍 3~10s |
| **螢幕內容** | 一句話講清楚這一步舞臺上有什麼：hero / 標語 / 資料 / 裝飾元素。**≤ 1 行**，再多就該拆 step |
| **不寫動畫** | 寫死 = 翻譯機化（詳見本檔案頂部框） |
| **不寫時長數值 / 錯峰量** | 這些在章節開發階段決定 |
| **不寫實現手段** | filter / SVG / Canvas 選型留給 chapter agent |


### 口播節選（每章末尾，可選但推薦）

精煉 1~3 句，**不是完整稿子**，僅供章節規劃階段對照"這章在講什麼"。
完整文字回 `script.md`。`outline.md` 章節 = `script.md` 中兩個明顯
主題切換之間的段落。

> 音訊合成（[`AUDIO.md`](AUDIO.md)）會**回到 `script.md`** 切分完整
> 文字，**不**用 outline 節選。

---

## 命名規則速查

| 物件 | 規則 | 示例 |
|---|---|---|
| 章節 id | 小寫 + 連字元 | `coldopen`, `why-good` |
| 章節資料夾 | `0N-<id>` | `src/chapters/01-coldopen/` |
| 章節元件 | PascalCase | `Coldopen.tsx`, `WhyGood.tsx` |
| 章節 CSS 類字首 | 章節縮寫（避免跨章衝突） | `.cd-` / `.wg-` / `.mg-` |
| 音訊子目錄 | `<id>/` | `public/audio/coldopen/` |
| 音訊檔案 | `<step-N>.mp3` (1-indexed) | `public/audio/coldopen/1.mp3` |

---

## 章節切分的經驗法則

- **每章 3~8 步**。少於 3 步太薄；多於 8 步觀眾會忘記這章在講啥
- **總時長 ÷ 30 秒** ≈ 章節數（一章約 30~60 秒講完）
- **每章 = 一個聚焦主題**。"為什麼強 + 怎麼用" 是兩章，不是一章
- **章節邊界 = 口播稿裡講者會換語氣 / 換主題的位置**。讀 `script.md`
  時哪裡你下意識想"咳一聲接下一段"，那裡就是章節邊界
- **慢節奏 / 長鏡頭風主題**（midnight-press / 電影感片頭）每章可少到
  2~3 step；**資訊密集型**（科技測評 / 對比表）每章可放寬到 8~10 step

---

## 素材清單（outline.md 末尾）

```markdown
## 素材清單

### 1. coldopen
- ✓ <資源 1 描述> （<已就位路徑>）
- ⚠️ <資源 2 描述>（待提供）
- ⚠️ <資源 3 描述>（待提供）

---

## 自檢（寫完 outline **強制**執行，不可跳過）

> ⚠️ **硬性流程**：outline 寫完後**必須**走自檢 → 修改 → 提交 三步。
> **禁止**寫完直接進入 Checkpoint Plan 讓使用者對齊。
>
> **執行方式**（按能力降級）：
>
> 1. **優先 Agent Teams**：開一個獨立 reviewer agent，傳入 `outline.md`
>    + 本節自檢清單 + `script.md` / `article.md` 路徑，讓它**逐項核查 +
>    出結論**（哪幾條 fail + 證據）。
> 2. **其次 subAgent**：當前 agent 沒 Teams 但能開 subagent，用 subagent
>    走同樣流程。
> 3. **都沒有**：自己**嚴格逐項**核查。
>
> 拿到結論後**先按 fail 項改 outline，再進入 Checkpoint Plan**。

- [ ] 每個 step 都是**單一句螢幕內容描述**，沒有"動畫"行 / "手段"行
- [ ] 沒有任何 step 寫了具體毫秒 / 秒數（除 `(~Ts)` 口播估時）
- [ ] 每章首段都有「資訊池」block，至少 3 條 article 抽取項，**每條
      必帶來源標註**（`—— 來源 article §X / Lxx`）—— 沒標註 chapter agent
      回不到原文
- [ ] **所有 step `(~Ts)` 累加 ≈ 頂部宣告的總時長**（誤差 < 10%）—— 不
      一致說明節奏規劃失真
- [ ] 章節切分符合"每章 3~8 步 / 30~60s 一聚焦主題"經驗
- [ ] 末尾「素材清單」分章節列出，✓ / ⚠️ 標註清楚
- [ ] 指令碼不得包含標題、序號等非口播內容，僅包含人類正常可讀的內容

寫完看一眼：**outline 是不是乾淨到 chapter agent 看了能立刻開工 + 還有
設計空間**？是 = 合格。如果你看了都覺得"太空，agent 不知道動畫選什麼"
