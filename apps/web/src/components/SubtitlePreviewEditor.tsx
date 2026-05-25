"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { SubtitlePosition, SubtitleStyle } from "@courseflow/core";
import {
  buildSubtitleOverlayStyle,
  SUBTITLE_CANVAS_W,
  SUBTITLE_CANVAS_H,
} from "@courseflow/core";
import {
  normalizeSubtitleFontSize,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_FONT_SIZE_OPTIONS,
} from "@/lib/subtitle-options";

const CANVAS_W = SUBTITLE_CANVAS_W;

type DragMode = "move" | "resize-se" | null;
export function SubtitlePreviewEditor({
  style,
  position,
  locked,
  onStyleChange,
  onPositionChange,
}: {
  style: SubtitleStyle;
  position: SubtitlePosition;
  locked: boolean;
  onStyleChange: (patch: Partial<SubtitleStyle>) => void;
  onPositionChange: (patch: Partial<SubtitlePosition>) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origin: SubtitlePosition;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      const width = canvasRef.current?.clientWidth ?? 0;
      setPreviewScale(width > 0 ? width / CANVAS_W : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const overlayStyle = buildSubtitleOverlayStyle(style, position, previewScale);
  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * SUBTITLE_CANVAS_H,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || locked) return;
      const point = toCanvasPoint(event.clientX, event.clientY);
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;

      if (drag.mode === "move") {
        onPositionChange({
          x: Math.round(Math.min(CANVAS_W - 40, Math.max(0, drag.origin.x + dx))),
          y: Math.round(Math.min(SUBTITLE_CANVAS_H - 24, Math.max(0, drag.origin.y + dy))),
        });
        return;
      }

      if (drag.mode === "resize-se") {
        onPositionChange({
          width: Math.round(Math.max(120, drag.origin.width + dx)),
          height: Math.round(Math.max(48, drag.origin.height + dy)),
        });
      }
    },
    [locked, onPositionChange, toCanvasPoint],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const startDrag = (mode: DragMode, event: React.PointerEvent) => {
    if (locked || !mode) return;
    event.preventDefault();
    event.stopPropagation();
    const point = toCanvasPoint(event.clientX, event.clientY);
    dragRef.current = {
      mode,
      startX: point.x,
      startY: point.y,
      origin: { ...position },
    };
    setDragging(true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  };

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block w-[25%] min-w-[14rem] text-xs text-zinc-500">
          字型
          <select
            disabled={locked}
            value={style.fontFamily}
            onChange={(event) => onStyleChange({ fontFamily: event.target.value })}
            className="cf-select mt-1 w-full"
          >
            {SUBTITLE_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!SUBTITLE_FONT_OPTIONS.some((option) => option.value === style.fontFamily) ? (
              <option value={style.fontFamily}>{style.fontFamily}</option>
            ) : null}
          </select>
        </label>
        <label className="block w-[8.333%] min-w-[4.75rem] text-xs text-zinc-500">
          字級
          <select
            disabled={locked}
            value={normalizeSubtitleFontSize(style.fontSizePx)}
            onChange={(event) => onStyleChange({ fontSizePx: Number(event.target.value) })}
            className="cf-select mt-1 w-full"
          >
            {SUBTITLE_FONT_SIZE_OPTIONS.map((sizePx) => (
              <option key={sizePx} value={sizePx}>
                {sizePx}px
              </option>
            ))}
          </select>
        </label>
        <label className="block w-[8.333%] min-w-[4.75rem] text-xs text-zinc-500">
          文字色彩
          <input
            type="color"
            disabled={locked}
            value={style.color}
            onChange={(event) => onStyleChange({ color: event.target.value })}
            className="mt-1 h-9 w-full cursor-pointer rounded border border-[var(--border)] bg-transparent"
          />
        </label>
        <label className="block w-[8.333%] min-w-[4.75rem] text-xs text-zinc-500">
          文字邊框色
          <input
            type="color"
            disabled={locked}
            value={style.strokeColor}
            onChange={(event) => onStyleChange({ strokeColor: event.target.value })}
            className="mt-1 h-9 w-full cursor-pointer rounded border border-[var(--border)] bg-transparent"
          />
        </label>
        <label className="block w-[8.333%] min-w-[4.75rem] text-xs text-zinc-500">
          背景色
          <input
            type="color"
            disabled={locked}
            value={style.backgroundColor.startsWith("#") ? style.backgroundColor : "#808080"}
            onChange={(event) => onStyleChange({ backgroundColor: event.target.value })}
            className="mt-1 h-9 w-full cursor-pointer rounded border border-[var(--border)] bg-transparent"
          />
        </label>
        <label className="block w-[12.5%] min-w-[7rem] text-xs text-zinc-500">
          背景透明度 {Math.round(style.backgroundOpacity * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            disabled={locked}
            value={Math.round(style.backgroundOpacity * 100)}
            onChange={(event) =>
              onStyleChange({ backgroundOpacity: Number(event.target.value) / 100 })
            }
            className="mt-2 w-full"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        拖曳字幕區塊可移動位置；右下角控點可調整寬高。所有步驟共用同一字幕位置。
      </p>

      <div
        ref={canvasRef}
        className="relative mt-3 aspect-video w-full overflow-hidden rounded border border-[var(--border)] bg-zinc-900"
      >
        <div
          className={`absolute ${dragging ? "ring-1 ring-[var(--color-cf-accent)]" : ""} ${locked ? "cursor-default" : "cursor-move"}`}
          style={overlayStyle}
          onPointerDown={(event) => startDrag("move", event)}
        >
          字幕預覽
          {!locked ? (
            <span
              role="presentation"
              onPointerDown={(event) => startDrag("resize-se", event)}
              className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-white/80 bg-[var(--color-cf-accent)]"
              title="拖曳調整寬高"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
