#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scaffold.sh —— 一鍵腳手架，建立一個 video-presentation 專案。
#
# 用法：
#   bash scripts/scaffold.sh <target-dir> [--theme=<id>]
#   bash scripts/scaffold.sh --list-themes
#
# 例子：
#   bash <path-to-web-video-v2>/scripts/scaffold.sh ./presentation
#   bash <path-to-web-video-v2>/scripts/scaffold.sh ./talk --theme=paper-press
#   bash <path-to-web-video-v2>/scripts/scaffold.sh --list-themes
#
# 跑完後，看 SKILL.md "Phase 2.4 實現單章" + references/CHAPTER-CRAFT.md
# 瞭解每章怎麼寫。卡殼時翻 references/EXAMPLES/ 找完整章節 anchor。
#
# 之後切換主題，覆蓋一個檔案即可：
#   cp <path-to-web-video-v2>/themes/<id>/tokens.css \
#      <project>/src/styles/tokens.css
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$SKILL_DIR/templates"
THEMES_DIR="$SKILL_DIR/themes"
DEFAULT_THEME="midnight-press"

list_themes() {
  echo "可用主題（來自 ${THEMES_DIR}）:"
  echo
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    local meta="$dir/theme.json"
    [[ -f "$meta" ]] || continue
    # 沒有 jq，簡單 grep + sed 提欄位
    local id name desc
    id=$(grep -E '"id"' "$meta" | head -n1 | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
    name=$(grep -E '"nameZh"' "$meta" | head -n1 | sed -E 's/.*"nameZh":[[:space:]]*"([^"]+)".*/\1/')
    desc=$(grep -E '"descriptionZh"' "$meta" | head -n1 | sed -E 's/.*"descriptionZh":[[:space:]]*"([^"]+)".*/\1/')
    printf "  • %-18s %s\n      %s\n\n" "$id" "$name" "$desc"
  done
  echo "用 --theme=<id> 選定一個。預設：${DEFAULT_THEME}。"
}

# ── 解析引數 ──
TARGET=""
THEME="$DEFAULT_THEME"
for arg in "$@"; do
  case "$arg" in
    --list-themes)
      list_themes
      exit 0
      ;;
    --theme=*)
      THEME="${arg#--theme=}"
      ;;
    --*)
      echo "✗ 未知引數: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; fi
      ;;
  esac
done

TARGET="${TARGET:-presentation}"
THEME_DIR="$THEMES_DIR/$THEME"
THEME_TOKENS="$THEME_DIR/tokens.css"

if [[ ! -d "$THEME_DIR" || ! -f "$THEME_TOKENS" ]]; then
  echo "✗ 找不到主題 '${THEME}'。可用主題：" >&2
  echo >&2
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    echo "    • $(basename "$dir")" >&2
  done
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null || true)" ]]; then
  echo "✗ 目標目錄 '${TARGET}' 已存在且非空，已中止。" >&2
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "✗ 需要 npm，但在 PATH 裡沒找到。" >&2
  exit 1
fi

echo "▸ 在 $TARGET 建立 Vite + React + TS 專案"
echo "▸ 使用主題：$THEME"
npm create vite@latest "$TARGET" -- --template react-ts >/dev/null

cd "$TARGET"
echo "▸ 安裝依賴（可能要等一會）..."
npm install >/dev/null 2>&1

echo "▸ 安裝 tsx（用於 extract-narrations 指令碼）..."
npm install --save-dev tsx >/dev/null 2>&1

echo "▸ 用演示骨架替換預設 boilerplate"

# 幹掉我們不要的 Vite 預設 boilerplate
rm -f \
  src/App.tsx src/App.css \
  src/main.tsx src/index.css \
  src/assets/react.svg \
  public/vite.svg \
  README.md
rmdir src/assets 2>/dev/null || true

# 把腳手架檔案拷到專案根
mkdir -p \
  src/styles src/hooks src/components src/registry \
  src/chapters/01-example \
  public scripts

cp "$TEMPLATES/vite.config.ts" .
cp "$TEMPLATES/index.html" .

cp "$TEMPLATES/src/main.tsx" src/main.tsx
cp "$TEMPLATES/src/App.tsx"  src/App.tsx

# tokens.css 來自所選主題
cp "$THEME_TOKENS"                          src/styles/tokens.css
cp "$TEMPLATES/src/styles/base.css"         src/styles/base.css
cp "$TEMPLATES/src/styles/animations.css"   src/styles/animations.css
cp "$TEMPLATES/src/styles/fonts.css"        src/styles/fonts.css
cp "$TEMPLATES/src/styles/print.css"        src/styles/print.css   # PDF export

cp "$TEMPLATES/src/hooks/useStageScale.ts"        src/hooks/useStageScale.ts
cp "$TEMPLATES/src/hooks/useStepper.ts"           src/hooks/useStepper.ts
cp "$TEMPLATES/src/hooks/useAudioPlayer.ts"       src/hooks/useAudioPlayer.ts
cp "$TEMPLATES/src/hooks/useAutoMode.ts"          src/hooks/useAutoMode.ts
cp "$TEMPLATES/src/hooks/useViewportFit.ts"       src/hooks/useViewportFit.ts        # Fit mode
cp "$TEMPLATES/src/hooks/useSubtitleSettings.ts"  src/hooks/useSubtitleSettings.ts   # Subtitle settings
cp "$TEMPLATES/src/hooks/usePauseControl.ts"      src/hooks/usePauseControl.ts       # Pause / TopMenu
cp "$TEMPLATES/src/hooks/usePdfExport.ts"         src/hooks/usePdfExport.ts          # PDF export
cp "$TEMPLATES/src/hooks/usePlaybackRate.ts"      src/hooks/usePlaybackRate.ts       # Speed cycle

cp "$TEMPLATES/src/components/Stage.tsx"          src/components/Stage.tsx
cp "$TEMPLATES/src/components/MaskReveal.tsx"     src/components/MaskReveal.tsx
cp "$TEMPLATES/src/components/ProgressBar.tsx"    src/components/ProgressBar.tsx
cp "$TEMPLATES/src/components/ProgressBar.css"    src/components/ProgressBar.css
cp "$TEMPLATES/src/components/AutoStartGate.tsx"  src/components/AutoStartGate.tsx
cp "$TEMPLATES/src/components/AutoStartGate.css"  src/components/AutoStartGate.css
cp "$TEMPLATES/src/components/AutoToggle.tsx"     src/components/AutoToggle.tsx
cp "$TEMPLATES/src/components/AutoToggle.css"     src/components/AutoToggle.css
cp "$TEMPLATES/src/components/SubtitleBar.tsx"    src/components/SubtitleBar.tsx     # Subtitle bar
cp "$TEMPLATES/src/components/SubtitleBar.css"    src/components/SubtitleBar.css
cp "$TEMPLATES/src/components/TopMenu.tsx"        src/components/TopMenu.tsx         # Top hover menu
cp "$TEMPLATES/src/components/TopMenu.css"        src/components/TopMenu.css
cp "$TEMPLATES/src/components/PageNumber.tsx"     src/components/PageNumber.tsx      # Bottom-right page number
cp "$TEMPLATES/src/components/PageNumber.css"     src/components/PageNumber.css

cp "$TEMPLATES/src/registry/types.ts"    src/registry/types.ts
cp "$TEMPLATES/src/registry/chapters.ts" src/registry/chapters.ts

cp "$TEMPLATES/src/chapters/01-example/Example.tsx"     src/chapters/01-example/Example.tsx
cp "$TEMPLATES/src/chapters/01-example/Example.css"     src/chapters/01-example/Example.css
cp "$TEMPLATES/src/chapters/01-example/narrations.ts"   src/chapters/01-example/narrations.ts

# Audio pipeline scripts (extract-narrations + synthesize-audio).
cp "$TEMPLATES/scripts/extract-narrations.ts"  scripts/extract-narrations.ts
cp "$TEMPLATES/scripts/synthesize-audio.sh"    scripts/synthesize-audio.sh
chmod +x scripts/synthesize-audio.sh

# Visual self-check (Playwright). The browser binary itself is fetched
# lazily on first `npm run self-check` by the script (see
# scripts/visual-self-check.ts → ensureChromium) to keep scaffold time down.
cp "$TEMPLATES/scripts/visual-self-check.ts"   scripts/visual-self-check.ts
echo "▸ 安裝 playwright（self-check 用，略大一些）..."
npm install --save-dev playwright >/dev/null 2>&1

# Wire all skill-provided scripts into npm so contributors don't have to
# remember the exact command. Uses node to merge into the existing package.json.
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
p.scripts = Object.assign({}, p.scripts, {
  "extract-narrations": "tsx scripts/extract-narrations.ts",
  "synthesize-audio":   "bash scripts/synthesize-audio.sh",
  "self-check":         "tsx scripts/visual-self-check.ts",
});
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'

# 留個標記，以後能查這個專案從哪個主題起步的
{
  echo "$THEME"
} > .theme

# 跑一次 typecheck 確認接線 OK
echo "▸ 跑 typecheck ..."
if npx tsc --noEmit; then
  echo "✓ typecheck 透過"
else
  echo "✗ typecheck 失敗 —— 請看上面的錯誤" >&2
  exit 1
fi

cat <<EOF

✓ 完成。下一步：

  1. cd $TARGET
  2. npm run dev      # 預設 http://localhost:5174（被佔會自動換埠）

當前主題：${THEME}（見 .theme）

然後：

  • 點舞臺任意位置推進全域性 step 計數器。
  • 滑鼠移到底部邊緣可顯出進度條；滑鼠移到右上角可顯出播放模式切換。
  • 把 src/chapters/01-example/ 替換成你自己的章節
    （流程見 SKILL.md "Phase 2.4 實現單章" —— 每章一次到位完整版本，
     不分骨架 / 精修兩步；動畫選型由 chapter agent 按 CHAPTER-CRAFT.md
     Part 0 原則 7 + Part 1 五問決定）。
  • 在 src/registry/chapters.ts 註冊每個新章節。
  • **每章必須有 narrations.ts**（與 Example.tsx 同目錄），
    陣列長度 = step 數，是音訊合成 + Auto 模式的唯一真相源。
  • 章節改了就 bump src/hooks/useStepper.ts 的 STORAGE_KEY 末尾版本號。

錄製：

  • 手動模式：直接開啟 http://localhost:5174（點選 / 方向鍵推進）
  • 半自動：URL 加 ?audio=1 — 音訊跟 step 切，但你手動推進
  • 全自動錄屏：URL 加 ?auto=1 — 按一次 SPACE 啟動，整片自動播 + 推進
                按 M 鍵隨時切換三種模式。

音訊合成（可選，錄製前做）：

  npm run extract-narrations    # 掃所有章節 narrations.ts → audio-segments.json
  npm run synthesize-audio      # 預設 IndexTTS2 本機合成；沒裝退到 mmx-cli
                                # → public/audio/<id>/<step>.mp3
                                # （安裝方式見 references/AUDIO.md §2.A）

寫章節時必讀（單一入口，路徑在 SKILL 倉庫內）：

  • $SKILL_DIR/references/CHAPTER-CRAFT.md
      Part 0 十條原則 / Part 1 開工 5 問 / Part 2 關係→動作決策樹 /
      Part 3 視覺工具箱 / Part 4 時長 / Part 5 反 AI 味反模式 /
      Part 6 程式碼硬規則 / Part 7 完工自檢 / Part 8 反饋速查
  • $SKILL_DIR/themes/$THEME/theme.json
      看 descriptionZh / mood / bestFor —— 參考主題氣質
      （動畫 / 時長 / 字號 / emoji 由 chapter agent 在每章自由決定）

卡殼時可翻：

  • $SKILL_DIR/references/EXAMPLES/
      完整章節 anchor（鉤子型 / 列舉型）—— 看"形"，不要照搬

要換一個主題，覆蓋 tokens.css 即可：
  cp $SKILL_DIR/themes/<id>/tokens.css src/styles/tokens.css

想自創主題，看 $SKILL_DIR/references/THEMES.md。

EOF
