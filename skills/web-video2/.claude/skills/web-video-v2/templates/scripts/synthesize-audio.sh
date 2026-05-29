#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# synthesize-audio.sh — read audio-segments.json and call a TTS backend
# to produce one mp3 per segment under public/audio/<chapter>/<N>.mp3.
#
# Default backend: IndexTTS2 (local, GPU). Falls back to MiniMax mmx-cli
# if `indextts2-tts` is not in PATH. Override with TTS_BATCH_CMD env var.
#
# Prereq:
#   1. npm run extract-narrations   (writes audio-segments.json)
#   2. One of:
#      - IndexTTS2: install indextts2-tts (see references/AUDIO.md §2.A)
#      - mmx-cli:   `npm install -g mmx-cli && mmx auth login --api-key ...`
#
# Behavior:
#   • IndexTTS2 path: one process loads the model once and serialises through
#     all segments (single batch call to `indextts2-tts batch`).
#   • mmx path: original serial loop (rate-limit safe).
#   • Both paths skip segments whose mp3 already exists. --force overwrites.
#
# Usage:
#   bash scripts/synthesize-audio.sh                # incremental
#   bash scripts/synthesize-audio.sh --force        # overwrite all
#   bash scripts/synthesize-audio.sh --voice=<id>   # override voice
#   TTS_BATCH_CMD=<cmd> bash scripts/synthesize-audio.sh  # force a backend
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEGMENTS="$ROOT/audio-segments.json"
OUT_DIR="$ROOT/public/audio"

FORCE=false
VOICE_ARG=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --voice=*) VOICE_ARG="${arg#--voice=}" ;;
    *) echo "✗ unknown arg: $arg" >&2; exit 1 ;;
  esac
done

die() { echo "✗ $*" >&2; exit 1; }

if [[ ! -f "$SEGMENTS" ]]; then
  die "$SEGMENTS not found. Run: npm run extract-narrations"
fi
if ! command -v jq >/dev/null; then
  die "jq is required to read audio-segments.json"
fi

detect_backend() {
  # Explicit override always wins.
  if [[ -n "${TTS_BATCH_CMD:-}" ]]; then
    command -v "$TTS_BATCH_CMD" >/dev/null \
      || die "TTS_BATCH_CMD=$TTS_BATCH_CMD not in PATH"
    echo "$TTS_BATCH_CMD"; return
  fi
  if command -v indextts2-tts >/dev/null; then echo "indextts2-tts"; return; fi
  if command -v mmx >/dev/null;          then echo "mmx";           return; fi
  cat >&2 <<EOF
✗ No TTS backend found.

Default (recommended): IndexTTS2 — local, GPU-accelerated, no API cost.
  See references/AUDIO.md §2.A for setup.

Fallback: MiniMax mmx-cli — cloud, needs API key.
  npm install -g mmx-cli
  mmx auth login --api-key sk-xxxxx
  (key at https://platform.minimaxi.com)

To force a custom backend that speaks the indextts2-tts batch interface:
  TTS_BATCH_CMD=<your-cmd> bash scripts/synthesize-audio.sh
EOF
  exit 1
}

backend=$(detect_backend)

run_indextts2() {
  # Single call — the wrapper loads the model once and handles skip/force/
  # progress/atomic-rename itself. Output format is contract-frozen to match
  # the mmx loop below, so users don't see a visual break between backends.
  local args=(batch --segments "$SEGMENTS" --out-dir "$OUT_DIR")
  [[ -n "$VOICE_ARG" ]] && args+=(--voice="$VOICE_ARG")
  $FORCE && args+=(--force)
  "$backend" "${args[@]}"
}

run_mmx() {
  # Original serial loop, preserved as fallback. mmx-cli expects auth state in
  # ~/.config; this path is not part of the indextts2 happy-path but kept so
  # users can still drop back to cloud TTS without changes.
  if ! mmx auth status >/dev/null 2>&1; then
    die "mmx not logged in. Run: mmx auth login --api-key sk-xxxxx"
  fi

  local total i synthesized skipped failed
  total=$(jq 'length' "$SEGMENTS")
  i=0; synthesized=0; skipped=0; failed=0
  local mmx_voice_arg=""
  [[ -n "$VOICE_ARG" ]] && mmx_voice_arg="--voice $VOICE_ARG"

  while IFS= read -r row; do
    i=$((i + 1))
    local chapter step text out
    chapter=$(echo "$row" | jq -r '.chapter')
    step=$(echo "$row" | jq -r '.step')
    text=$(echo "$row" | jq -r '.text')
    out="$OUT_DIR/$chapter/$step.mp3"
    label="$chapter/$step.mp3"

    if [[ -z "$text" ]]; then
      printf "[%3d/%d] %-20s skip (empty)\n" "$i" "$total" "$label"
      skipped=$((skipped + 1))
      continue
    fi
    if [[ -f "$out" && "$FORCE" != true ]]; then
      printf "[%3d/%d] %-20s skip (exists)\n" "$i" "$total" "$label"
      skipped=$((skipped + 1))
      continue
    fi
    mkdir -p "$(dirname "$out")"
    local start elapsed
    start=$(date +%s)
    if mmx speech synthesize $mmx_voice_arg --text "$text" --out "$out" \
         >/dev/null 2>&1; then
      elapsed=$(( $(date +%s) - start ))
      printf "[%3d/%d] %-20s ✓ %ss\n" "$i" "$total" "$label" "$elapsed"
      synthesized=$((synthesized + 1))
    else
      printf "[%3d/%d] %-20s ✗ FAILED\n" "$i" "$total" "$label" >&2
      failed=$((failed + 1))
    fi
  done < <(jq -c '.[]' "$SEGMENTS")

  echo
  echo "✓ done — synthesized $synthesized, skipped $skipped, failed $failed"
  [[ $failed -eq 0 ]] || exit 2
}

case "$backend" in
  indextts2-tts) run_indextts2 ;;
  mmx)           run_mmx ;;
  *)             # custom TTS_BATCH_CMD must implement the indextts2-tts batch interface.
                 run_indextts2 ;;
esac
