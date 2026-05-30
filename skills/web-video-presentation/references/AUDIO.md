# 音訊合成

把每個章節 `narrations.ts` 裡的口播文字按 **step 顆粒度**合成 mp3，
落到 `presentation/public/audio/<chapter-id>/<step-N>.mp3`。執行時
Auto 模式會自動按 step 播放並自動推進——錄屏可以一鏡到底。

> **真相源**：每個章節的 `src/chapters/<NN>-<id>/narrations.ts` 是 step
> 數 + 口播文字的**唯一來源**。`outline.md` 不再參與音訊合成，章節程式碼
> 也不再手寫 `totalSteps`。這一改根除了"網頁 step 和音訊檔案數對不上"
> 這個老問題。

預設用 **IndexTTS2（本機 GPU 跑、無 API 費用）**；未裝時退到
**MiniMax CLI（`mmx-cli`，雲端、按字計費）**。本機兩個都沒裝就**詢問使用者**
用什麼 TTS，不要悄悄假裝合成成功。

---

## 檔案命名約定

```
presentation/public/audio/
├── coldopen/
│   ├── 1.mp3
│   ├── 2.mp3
│   └── ...
├── hook/
│   └── ...
└── ...
```

- 章節子目錄名 = `chapters.ts` 裡的 `id`
- 檔名 = `<step-N>.mp3`（**1-indexed**，對齊 narrations 陣列的 index + 1）
- 格式固定 mp3（後端若出 wav，由 wrapper 內部用 ffmpeg 轉檔）

---

## 標準流程

### 1. 抽取 segments

```bash
cd presentation
npm run extract-narrations
```

這會掃所有章節的 `narrations.ts`，按 `chapters.ts` 註冊順序生成
`audio-segments.json`：

```json
[
  { "chapter": "coldopen", "step": 1, "text": "...", "audio": "coldopen/1.mp3" },
  { "chapter": "coldopen", "step": 2, "text": "...", "audio": "coldopen/2.mp3" },
  ...
]
```

讓使用者**先掃一眼這個 json**，確認文字和切分都對，再開始燒 token 合成。

> 空字串的 narration 會被自動跳過（不燒 TTS token）——執行時 Auto 模式
> 按字數估時撐過這種"無聲過場"step。

### 2. 合成

```bash
which indextts2-tts && echo "→ IndexTTS2"
which mmx && echo "→ mmx-cli"
```

- `indextts2-tts` 在 → 走 [2.A](#2a-indextts2預設)（**預設路徑**）
- `mmx` 在但 `indextts2-tts` 不在 → 走 [2.C](#2c-mmx-cli後援)
- 兩個都不在 → 走 [2.B](#2b-indextts2-沒裝怎麼辦)

#### 2.A IndexTTS2（預設）

本機 GPU 跑，無 API 成本、可離線。RTX 4090 + FP16 下 RTF ~0.7（合 1 秒
口播約耗 0.7 秒）；冷啟動 ~100 秒一次性（載入模型 + 首次下載 BigVGAN /
CAMPPlus / MaskGCT HF cache 到 `index-tts/checkpoints/hf_cache/`）。

##### 呼叫合成指令碼

```bash
npm run synthesize-audio              # 增量：跳過已存在的 mp3
npm run synthesize-audio -- --force   # 全部重合成
npm run synthesize-audio -- --voice=<name>  # 指定音色（見 voice library）
```

`synthesize-audio.sh` 自動偵測 backend：找到 `indextts2-tts` 就用它（呼叫
`indextts2-tts batch ...`，**單一進程載入模型一次後序列處理整個
audio-segments.json**），找不到才退到 mmx。

> **別中斷**：batch mode 中途 ctrl+C，重跑要再吃 ~100 秒冷啟動。設計上
> 已用 atomic rename 保護中斷瞬間的 mp3 完整性，但仍盡量別中斷整個批次。

##### Voice library

```
~/.config/indextts2/voices/
├── default.wav          # 預設音色（複製自 voice_07，中文女聲）
├── voice_01.wav         # 英文男聲（給英文 narration 推薦）
├── voice_07.wav         # 中文女聲
├── voice_09.wav         # 中文女聲 + 笑意
└── voice_12.wav         # 中文驚恐
└── anon.wav         # anon 聲音

```

加自己的音色：放一個 5-15 秒乾淨人聲 wav 到 `~/.config/indextts2/voices/<name>.wav`，
不需要改任何 config，下次 `--voice=<name>` 就能用。

`indextts2-tts list-voices` 列當前可用 voices + emotion prompts。

> **音色 ≠ 語言**：IndexTTS2 是 multilingual voice clone，但用中文女聲唸英文
> 會帶口音感。**英文內容建議 `--voice=voice_01`** 或自備英文人聲 prompt。

##### 進階：情緒控制（手動）

`synthesize-audio.sh` 預設不會傳情緒參數（保持 narration 結構單純）。要對個別
段落加情緒，手動跑 `indextts2-tts synthesize`：

```bash
# 用情緒 prompt 音檔注入悲傷
indextts2-tts synthesize \
  --text "酒樓喪盡天良，開始借機競拍房間。" \
  --voice voice_07 \
  --emo-audio sad \
  --emo-alpha 0.9 \
  --out public/audio/coldopen/3.mp3 --force

# 用 8 維向量 [happy,angry,sad,afraid,disgusted,melancholic,surprised,calm]
indextts2-tts synthesize --text "..." --voice voice_09 \
  --emo-vector 0.8,0,0,0,0,0,0,0.2 --out ... --force

# 用文字描述推情緒（emo_alpha 建議 0.6）
indextts2-tts synthesize --text "..." --voice voice_12 \
  --emo-text "你嚇死我了！" --emo-alpha 0.6 --out ... --force
```

##### 校驗時長

合成完後跑：

```bash
for f in public/audio/*/*.mp3; do
  d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")
  echo "$f  ${d}s"
done
```

把每條的實際秒數彙總告訴使用者。**重點關注 ≥ 15s 的條目**——口播太長意味
著該 step 的 narration 寫得過密，或者 step 沒拆夠。讓使用者決定**改稿子
重合**還是**回章節程式碼拆 step**。

#### 2.B IndexTTS2 沒裝怎麼辦

```
本機沒檢測到 indextts2-tts。我可以：

  1. 幫你裝 IndexTTS2（推薦）
     需要：NVIDIA GPU（建議 ≥ 8GB VRAM）、CUDA 12.8+、uv、ffmpeg
     步驟見 https://github.com/index-tts/index-tts
     裝完後寫 wrapper 到 ~/.local/bin/indextts2-tts（內部 cd 進 IndexTTS
     repo 跑 uv run python ~/.local/share/indextts2/indextts2_tts.py "$@"）。

  2. 退到 MiniMax CLI
     npm install -g mmx-cli && mmx auth login --api-key sk-xxxxx
     API key 在 https://platform.minimaxi.com 獲取

  3. 用其它 TTS（你來提供）
     告訴我用什麼 —— OpenAI TTS / 阿里雲 / Azure / ElevenLabs / 其它
     最好附上呼叫方式（CLI 命令 / API endpoint + 引數）
     我會改 scripts/synthesize-audio.sh 讓它調你的工具，
     輸出檔案路徑仍按 audio-segments.json 的 audio 欄位寫
     —— 或者讓你的工具實作 indextts2-tts 的 `batch --segments ... --out-dir ...`
     介面，然後設 `TTS_BATCH_CMD=<your-cmd>` env var

  4. 暫時跳過
     稿子和 narrations 都在，你自己用任意 TTS 錄製即可
```

#### 2.C mmx-cli（後援）

MiniMax CLI，雲端 TTS，按字計費。`synthesize-audio.sh` 只在 `indextts2-tts`
**不在 PATH** 時自動退到這條路徑。

> **誠實標示**：mmx 路徑為後援、未定期驗證；MiniMax CLI 介面變化時可能需要
> 手動修 `scripts/synthesize-audio.sh` 的 mmx 分支。

##### 鑑權檢查

```bash
mmx auth status
```

未登入 → 提示使用者：

```
你的 mmx-cli 未登入。請執行：
  mmx auth login --api-key sk-xxxxx
（API key 在 https://platform.minimaxi.com 獲取）
```

登入前**不要繼續**。

##### 呼叫合成指令碼（同一條，自動退到 mmx）

```bash
npm run synthesize-audio              # 自動偵測到只有 mmx，走 mmx loop
npm run synthesize-audio -- --force
npm run synthesize-audio -- --voice=<mmx-voice-id>
```

mmx 路徑是序列呼叫（避免 rate limit）、**自動跳過已存在檔案**。每條印進度：

```
[  3/24] coldopen/3.mp3   ✓ 4s
[  4/24] coldopen/4.mp3   skip (exists)
```

格式與 IndexTTS2 路徑一致 —— 切換後端不應該讓使用者體感斷檔。

---

## 使用者自帶 TTS 的最小契約

任何 TTS 後端只要實作 IndexTTS2 wrapper 的 `batch` 介面，就可以用
`TTS_BATCH_CMD=<your-cmd>` 接進來，無需改 `synthesize-audio.sh`：

```
<your-cmd> batch \
  --segments <audio-segments.json> \
  --out-dir <output-directory> \
  [--voice=<name>] \
  [--force]
```

行為要求：
- 讀 segments、序列合成 → `<out-dir>/<segment.audio>`
- 跳過已存在的輸出檔（除非 `--force`）
- 進度行格式：`[ N/M] <chapter>/<step>.mp3   ✓ Xs` / `skip (exists)` /
  `skip (empty)` / `✗ FAILED`
- 結束印一行 summary：`✓ done — synthesized X, skipped Y, failed Z`
- `exit 2` if any failed

或者單條合成介面（同 mmx）：
| 能力 | 輸入 | 輸出 |
|---|---|---|
| 單段合成 | 一段文字 + 音色 id（可選） | 一個 mp3 / wav 檔案 |
| 錯誤反饋 | —— | 失敗時明確報錯 |
| 輸出可指定路徑 | 目標檔案路徑 | 直接寫到該路徑 |

不滿足"輸出可指定路徑"的 API（比如返回二進位流）就在外面包一層 curl /
node script 把響應寫到目標路徑。

---

## 執行時如何使用合成的音訊

合成完成後，**不需要任何額外配置**——腳手架的 `App.tsx` 已經接好：

| 模式 | 觸發方式 | 行為 |
|---|---|---|
| **Manual**（預設） | 直接開啟頁面 | 不播音訊，點選 / 方向鍵推進 |
| **Audio**（半自動） | URL `?audio=1` 或按 `M` 鍵 | 進入 step 自動播音訊，但你手動推進（點滑鼠） |
| **Auto**（全自動） | URL `?auto=1` 或按兩次 `M` 鍵 | 進入 step 播音訊 → 播完自動 next() → 進下個 step → ... |

Auto 模式首次需要按一次 `Space` 啟動（繞過瀏覽器自動播放限制），之後
全自動跑。**錄屏時開啟螢幕錄製 → 按 Space → 整片自動跑完 → stop**。

> **Auto 模式的推進規則就一句話**：每段音訊播完 + 200ms 緩衝 → 自動 next。
> **沒有"等動畫跑完"的兜底**——如果你寫的視覺動畫比口播長，會被當場切。
> 解決辦法：寫更長口播 / 拆 step / 調動畫速度（詳見
> [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 「程式碼層最小約束」）。
>
> 音訊檔案缺失（還沒合成 / 404）或 narration 是空串 → 退化到字數估時
> （`max(1500ms, 字數 × 250ms)`），保證預覽也能整片跑通。

---

## 升級老專案

`synthesize-audio.sh` 是 skill template 的一部分，每次 scaffold 都複製到新
專案。已 scaffold 的老專案**不會自動同步**新版 sh —— 想用新的 IndexTTS2 路徑
要把新版複製過去：

```bash
cp ~/.claude/skills/web-video-v2/templates/scripts/synthesize-audio.sh \
   presentation/scripts/
```

複製完後直接跑 `npm run synthesize-audio`；舊專案的 `audio-segments.json` 跟
路徑約定不需要改。

---

## 故障排查

| 現象 | 原因 / 修法 |
|---|---|
| `chapter id "X" registered but no matching folder found` | 章節資料夾應命名為 `NN-<id>`；id 必須等於 chapters.ts 裡註冊的 |
| `narrations.ts in X must export an array named "narrations"` | 該章節的 narrations.ts 沒 export 名為 narrations 的陣列 |
| `indextts2-tts: command not found` | 跑 2.B 列的 setup 步驟；確認 `~/.local/bin` 在 PATH |
| 模型載入花 ~100 秒 | 這是 IndexTTS2 cold start + 首次下載 BigVGAN / CAMPPlus / MaskGCT 到 `index-tts/checkpoints/hf_cache/`。一次性，後續 batch 內所有段共用 |
| CUDA out of memory | 模型大概要 6-10 GB VRAM；用 `--no-fp16` 反而會更耗 VRAM。關掉背景 GPU 程式（dev server / Chrome）；或在 `~/.config/indextts2/config.json` 設 `use_fp16: true`（預設已是） |
| `Voice 'X' not found` | 跑 `indextts2-tts list-voices` 看可用清單；或丟一個新 wav 進 `~/.config/indextts2/voices/` |
| 中文 voice 唸英文有口音 | 換 `--voice=voice_01` 或自備英文人聲 prompt（5-15 秒乾淨錄音） |
| 整段合成被截斷 | IndexTTS2 內部用 `max_text_tokens_per_segment=120` 自動分段，理論上不卡長度；若還是被切，把該條 narration 拆成更短兩條 |
| 中斷重跑模型又花 100s | batch mode 內部模型只載入一次。中斷後重跑要重來。建議別中斷整個批次 |
| atomic rename：中斷時的半截檔 | Python wrapper 寫 `*.mp3.tmp` → `os.replace`，正式 mp3 永遠完整；中斷不會留半截 |
| `mmx: command not found` | 退路徑：`npm install -g mmx-cli`；npm 全域 bin 不在 PATH 時 `npm config get prefix` 看一下 |
| `401 / unauthorized` (mmx) | `mmx auth login --api-key sk-xxxxx` 重新登入 |
| 瀏覽器沒播音訊 | Auto / Audio 模式下首次需要使用者手勢——確認你按了 SPACE 啟動 Auto，或者點過頁面 |
| 音訊 404 但 Auto 模式還能跑 | 找不到 mp3 時 useAudioPlayer 退化到字數估時（4 字/秒），保證預覽不中斷 |

---

## 相關連結

- IndexTTS2 倉庫：<https://github.com/index-tts/index-tts>
- IndexTTS2 模型 (HuggingFace)：<https://huggingface.co/IndexTeam/IndexTTS-2>
- mmx-cli 倉庫：<https://github.com/MiniMax-AI/cli>
- MiniMax 官方檔案：<https://platform.minimaxi.com/docs/token-plan/minimax-cli>
