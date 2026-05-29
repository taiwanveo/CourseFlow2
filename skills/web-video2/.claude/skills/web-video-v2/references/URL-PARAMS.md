# URL 參數總表

本 Skill 所有可用 URL 查詢參數彙整在這一份。**寫章節 / 錄屏 / 調試 / 對話定址時都先回這裡查**，不要在多份文件之間重複規格。

> **規則**：所有參數**只在頁面初始化時讀一次**（除 `?audio` / `?auto` 由 `useAutoMode` 雙向同步外）。中途改變 URL 不會熱更新，使用者需手動 reload。

---

## 速查表

| 參數 | 取值 | 預設 | 一句話 |
|---|---|---|---|
| `?auto=1` | `1` 或省略 | 省略 = manual | 進入 Auto 模式（音訊自動播 + 自動推進），錄屏一鏡到底用 |
| `?audio=1` | `1` 或省略 | 省略 | 進入 Audio 模式（音訊播但仍手動推進），講演排練用 |
| `?section=1` | `1` 或省略 | 省略 | 進入 Section 模式（自動播到本章最後一步就停） |
| `?fit=cover` | `cover` 或省略 | 省略 = contain | Stage 切到全螢幕無黑邊（對稱裁切兩側 / 上下） |
| `?subs=off` | `off` 或省略 | 省略 = on | 隱藏底部字幕條（也可用鍵盤 `S` 切換，會寫入 localStorage） |
| `?recording=1` | `1` 或省略 | 省略 | 強制隱藏 TopMenu + PageNumber（**字幕不受影響**） |
| `?speed=N` | `1` / `1.25` / `1.5` / `2` | 省略 = localStorage 記憶值或 1 | 音訊播放速度（Audio / Auto / Section 模式生效；Manual 模式無效） |
| `?chapter=N&step=M` | 整數，0-index | 省略 = 用持久化遊標 | 深連結到指定 step，供 self-check + 對話定址使用 |

---

## 逐個展開

### `?auto=1`

進入 **Auto 模式**：useAudioPlayer 載入該 step 的音訊；播完後自動 `next()` 推進；遇到 AutoStartGate 需按一次 `Space` 解鎖瀏覽器自動播放策略。

- **互動**：與 `?audio=1` 互斥。鍵盤 `M` 也能在 manual → audio → section → auto 循環切換，URL 會即時同步。
- **錄屏建議**：開啟 `?auto=1&recording=1` 是最乾淨的錄屏組合 —— 自動播 + 完全無 chrome + 字幕（除非也 `?subs=off`）。

### `?audio=1`

進入 **Audio 模式**：音訊播但**不自動推進**，講者仍需手動點選 / 按 →。適合先聽過一次完整節奏、再走錄屏。

### `?section=1`

進入 **Section 模式**：自動播當前 chapter 所有 step；播到下一 chapter 開頭時自動停（**不跨章**）。適合「自動播完本章 → 講者解說 → 手動進入下一章」的 demo 場景。

- 與 `?auto=1` 並列；鍵盤 `M` 在 manual → audio → section → auto 循環切換。
- 邊界：行為由 App-level `onAutoAdvance` 判斷 —— 當前 step 是本 chapter 最後一步時自動推進被攔下來。

### `?speed=N`

設定音訊播放速度（HTMLAudioElement `playbackRate`）。合法值：`1`、`1.25`、`1.5`、`2`，其它值會被忽略並 fallback 到 1。

- **生效範圍**：Audio / Auto / Section 模式。Manual 模式不放音訊，URL 參數仍會寫入但對畫面無作用。
- **持久化**：URL 帶 `?speed=` 時當作 opt-in 載入值並寫入 localStorage（`wv-speed-v1`）；沒帶就讀 localStorage 上次選擇，再 fallback 1。
- **動畫跟著加速（透過 token）**：章節 CSS 動畫透過 `var(--anim-*)` token 或 `calc(<ms> / var(--speed))` 包裹，會跟著速度切換自動加速。詳見 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 的「章節動畫要跟著播放速度」段。
- **UI 入口**：TopMenu 速度按鈕（hover 頂部顯示），循環 1× → 1.25× → 1.5× → 2× → 1×。Manual 模式按鈕 disabled。
- **錄屏建議**：要錄「2× 預覽快版」就 `?auto=1&recording=1&speed=2`，整片約一半時長跑完。

### `?fit=cover`

切 Stage 為 **cover 模式**：scale = max(vw/1920, vh/1080)，內容填滿 viewport，必要時對稱裁切兩側 / 上下，**無 letterbox 黑邊**。

- **預設**：不加參數 = contain 模式，scale = min(vw/1920, vh/1080)，保比例 + letterbox 黑邊，**任何 viewport 下都不裁切**，所有 1920×1080 像素都看得到。
- **何時切 cover**：要全螢幕填滿（投影 / 錄屏壓字幕 / 全螢幕展示），無法接受黑邊，且**章節作者已遵守安全區 1600×900**（核心視覺都在中央，邊角元素接受被裁）。
- **與 fit 模式相關文件**：見 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 的「安全區 1600×900」段以及 [`../SKILL.md`](../SKILL.md) 的「原則 1 / 5 / 6 細則」段。
- **註**：`?fit=contain` 也接受，但效果跟省略一樣（contain 已是預設）。

### `?subs=off`

**唯一**控制字幕條的 URL 參數。`?subs=off` = 初始化時字幕隱藏（localStorage 也會被覆寫）；省略 = 字幕**預設顯示**，包含 Auto / Section / Recording 三種模式。

- **設計理由**：字幕本身就是錄屏要保留的成片內容（觀眾在沒有音訊的環境也能讀），與 chrome 不同，所以**不受 `?recording=1` 影響**。
- **鍵盤備用**：使用者也可隨時按 `S` 切換 enabled，狀態寫入 localStorage 跨頁面保留。

### `?recording=1`

進入 **錄屏態**：強制隱藏 TopMenu 與 PageNumber（即使滑鼠 hover 也不顯示）。**字幕條不受此參數影響**，由 `?subs=off` 自己決定。

- **與 mode 的關係**：`mode === 'auto' \| 'section'` 已會強制隱藏 chrome；`?recording=1` 是在 manual 模式下也需要乾淨畫面時的後備（例如錄一段只有講者手動點選的「真錄屏」演示）。
- **錄屏建議組合**：
  - 一鏡到底自動錄屏：`?auto=1`（隱含 chrome 隱藏 + 字幕顯示）
  - 手動點選但要乾淨畫面：`?recording=1`
  - 純無字幕錄屏（極少見）：`?auto=1&subs=off`

### `?chapter=N&step=M`

**深連結**到指定 (chapter, step)。N / M 均為 **0-index 整數**。

- **用途 1：對話定址**。使用者說「重寫 2.3 的視覺」= 第 2 章第 3 步 = `?chapter=1&step=2`（注意 PageNumber 顯示是 1-index 的 `{N+1}.{M+1}`，URL 內部用 0-index 與 useStepper 一致）。
- **用途 2：self-check**。Playwright 腳本對每一組 (chapter, step) 拼 URL 開頁，搭配 `?recording=1` 取最乾淨截圖。
- **clamp 規則**：超出 chapters 或 narrations 長度時 useStepper.sanitize() 會回退到合法值（不會崩）。

---

## 與 6 大功能的對應

| 功能 | 主控參數 | 次要參數 | 鍵盤備用 |
|---|---|---|---|
| 字幕條 | `?subs=off` | — | `S` |
| TopMenu | `?recording=1`（強制隱藏） | mode | — |
| PDF 下載 | 透過 TopMenu 按鈕觸發 `window.print()`，**無 URL 參數**；body class 自動切到 `.printing` | — | — |
| PageNumber | `?recording=1`（強制隱藏） | mode | — |
| Fit 模式 | `?fit=cover` 切到全螢幕無黑邊（預設 contain = letterbox） | — | — |
| Self-check | `?chapter=N&step=M&recording=1` | — | — |

---

## 錄屏前常用組合速查

```
# 一鏡到底自動錄屏（最常用）
http://localhost:5173/?auto=1

# 一鏡到底，連字幕也不要
http://localhost:5173/?auto=1&subs=off

# 一鏡到底 + 全螢幕填滿（opt-in cover；章節須遵守安全區 1600×900）
http://localhost:5173/?auto=1&fit=cover

# 手動點選 + 乾淨畫面（給講者錄製）
http://localhost:5173/?recording=1

# 對話定址：跳第 2 章第 3 步
http://localhost:5173/?chapter=1&step=2

# Self-check 每組 (chapter, step) 用的 URL
http://localhost:5173/?chapter=N&step=M&recording=1
```

---

## 相關文件

- 章節作者落地細則：[`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md)
- 原則 1/5/6 細則（Manual / 錄屏雙態 + 全螢幕無黑邊）：[`../SKILL.md`](../SKILL.md) 的「原則 1 / 5 / 6 細則」段
- Manual / Audio / Section / Auto 四模式詳細：`useAutoMode.ts` 註解
