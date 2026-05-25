"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Transformer, Group } from "react-konva";
import type { CSSProperties } from "react";
import "@courseflow/player/styles.css";
import type Konva from "konva";
import { v4 as uuidv4 } from "uuid";
import type {
  CourseComposition,
  ImageVisualElement,
  StepSubtitle,
  StepVisual,
  TextVisualElement,
  VisualElement,
} from "@courseflow/core";
import {
  buildSubtitleOverlayStyle,
  getOrderedSteps,
  resolveSubtitleStyle,
  resolveSubtitleDisplayText,
  resolveSubtitlePosition,
  scaleTextElementUniform,
  resizeImageElementBox,
  resizeTextElementBox,
  VISUAL_TEXT_PADDING_PX,
  DEFAULT_TEXT_LINE_SPACING_PX,
  defaultContentTextBoxRect,
  visualTextBoxDomStyle,
  visualTextClassName,
} from "@courseflow/core";
import { ENTER_ANIMATIONS, TRANSITIONS } from "@courseflow/wvp-bridge/catalog";
import { VISUAL_FONT_OPTIONS } from "@/lib/visual-options";
import { nextZIndex, reorderElementLayer, type LayerAction } from "@/lib/visual-layer";
import { useToast } from "@/components/Toast";
import type { LlmProviderId } from "@courseflow/llm";
import { IMAGE_GENERATION_PROVIDERS } from "@courseflow/llm";
import { PROVIDER_LABELS } from "@/lib/llm-providers.constants";

const W = 1920;
const H = 1080;
const PREVIEW_SCALE = 0.25;
const PREVIEW_W = W * PREVIEW_SCALE;
const PREVIEW_H = H * PREVIEW_SCALE;

type ThemePreview = { shell: string; text: string; accent: string };

type ContextMenuState = {
  x: number;
  y: number;
  elementId: string;
};

function CfFilePickButton({
  label,
  accept,
  disabled,
  onFile,
  className,
}: {
  label: string;
  accept: string;
  disabled?: boolean;
  onFile: (file: File) => void | Promise<void>;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className={className ?? "cf-btn cf-btn-secondary cf-btn-sm"}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
    </>
  );
}

const AI_BTN_CLASS = "cf-btn cf-btn-secondary cf-btn-sm";

function resolveBackgroundColor(visual?: StepVisual, themePreview?: ThemePreview): string {
  if (visual?.background.type === "color" && visual.background.color) {
    return visual.background.color;
  }
  return themePreview?.shell ?? "#1a1a2e";
}

function ImageElementNode({
  el,
  selected,
  locked,
  onSelect,
  onChange,
  onContextMenu,
}: {
  el: ImageVisualElement;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ImageVisualElement>) => void;
  onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>, id: string) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);

  return (
    <Group
      id={el.id}
      ref={groupRef}
      x={el.x}
      y={el.y}
      draggable={!locked}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={(event) => onContextMenu(event, el.id)}
      onDragEnd={(event) => onChange({ x: event.target.x(), y: event.target.y() })}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const sx = node.scaleX();
        const sy = node.scaleY();
        const resized = resizeImageElementBox(el.width, el.height, sx, sy);
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: resized.width,
          height: resized.height,
        });
      }}
    >
      <Rect width={el.width} height={el.height} fill="rgba(0,0,0,0.001)" listening />
      <Rect
        width={el.width}
        height={el.height}
        stroke={selected ? "#14b8a6" : undefined}
        strokeWidth={selected ? 2 : 0}
        listening={false}
      />
    </Group>
  );
}

function TextElementNode({
  el,
  selected,
  locked,
  onSelect,
  onChange,
  onContextMenu,
}: {
  el: TextVisualElement;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextVisualElement>) => void;
  onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>, id: string) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);

  return (
    <Group
      id={el.id}
      ref={groupRef}
      x={el.x}
      y={el.y}
      draggable={!locked}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={(event) => onContextMenu(event, el.id)}
      onDragEnd={(event) => onChange({ x: event.target.x(), y: event.target.y() })}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const isUniform = Math.abs(sx - sy) < 0.12;
        if (isUniform) {
          const scale = (sx + sy) / 2;
          onChange({
            x: node.x(),
            y: node.y(),
            ...scaleTextElementUniform(el, scale),
          });
        } else {
          onChange({
            x: node.x(),
            y: node.y(),
            ...resizeTextElementBox(el, sx, sy),
          });
        }
      }}
    >
      <Rect
        width={el.width}
        height={el.height}
        fill="rgba(0,0,0,0.001)"
        listening
      />
      <Rect
        width={el.width}
        height={el.height}
        stroke={selected ? "#14b8a6" : undefined}
        strokeWidth={selected ? 2 : 0}
        listening={false}
      />
    </Group>
  );
}

/** 與播放器相同的 DOM 舞台（所見即所得預覽底層） */
function PreviewDomStage({
  visual,
  bgFill,
  themeActive,
  subtitle,
  script,
}: {
  visual?: StepVisual;
  bgFill: string;
  themeActive: boolean;
  subtitle?: StepSubtitle;
  script: string;
}) {
  const bg = visual?.background;
  const frameStyle: CSSProperties = {
    width: W,
    height: H,
    position: "relative",
    overflow: "hidden",
    transform: `scale(${PREVIEW_SCALE})`,
    transformOrigin: "top left",
    ...(bg?.type === "image" && bg.publicUrl
      ? {
          backgroundImage: `url(${bg.publicUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: bg.opacity ?? 1,
        }
      : themeActive
        ? {}
        : { backgroundColor: bgFill }),
  };

  const elements = (visual?.elements ?? []).slice().sort((a, b) => a.zIndex - b.zIndex);
  const subtitleText = subtitle
    ? resolveSubtitleDisplayText(subtitle.segments, script)
    : "";
  const subtitleStyle = subtitle
    ? buildSubtitleOverlayStyle(
        resolveSubtitleStyle(subtitle.style),
        resolveSubtitlePosition(subtitle.position),
        1,
      )
    : null;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-0"
      style={{ width: PREVIEW_W, height: PREVIEW_H }}
    >
      <div className="stage-frame" style={frameStyle}>
        {elements.map((el) => {
          if (el.type === "image") {
            return (
              <img
                key={el.id}
                className="visual-image"
                src={el.publicUrl}
                alt=""
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  opacity: el.opacity,
                  zIndex: el.zIndex,
                }}
              />
            );
          }
          const isHero = el.id.endsWith("-hero");
          return (
            <div
              key={el.id}
              className={visualTextClassName(isHero, themeActive)}
              style={visualTextBoxDomStyle(el, { themeActive }) as CSSProperties}
            >
              {el.content}
            </div>
          );
        })}
        {subtitleStyle && subtitleText ? (
          <div className="subtitle-overlay" style={subtitleStyle as CSSProperties}>
            {subtitleText}
          </div>
        ) : null}
      </div>
    </div>
  );
}


export function VisualEditorCanvas({
  projectId,
  projectTitle,
  composition,
  setComposition,
  locked,
  themePreviewCss,
  onSave,
  saving = false,
  hasUnsavedChanges = false,
}: {
  projectId: string;
  projectTitle: string;
  composition: CourseComposition;
  setComposition: (c: CourseComposition) => void;
  locked: boolean;
  themePreviewCss?: string | null;
  onSave?: () => void;
  saving?: boolean;
  hasUnsavedChanges?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [imageProvider, setImageProvider] = useState<LlmProviderId>("openai");
  const [imageProviders, setImageProviders] = useState<LlmProviderId[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((data) => {
        const configured = (data.providers ?? []).map(
          (row: { provider: string }) => row.provider as LlmProviderId,
        );
        const available = IMAGE_GENERATION_PROVIDERS.filter((p) => configured.includes(p));
        setImageProviders(available);
        if (available.length > 0) setImageProvider(available[0]!);
      })
      .catch(() => {
        /* 略過 */
      });
  }, []);

  const ordered = getOrderedSteps(composition);
  const step = ordered[stepIndex];
  const visual = composition.visuals.find((v) => v.stepId === step?.id);
  const subtitle = composition.subtitles.find((s) => s.stepId === step?.id);

  const updateVisual = useCallback(
    (patch: Partial<StepVisual>) => {
      if (!step) return;
      setComposition({
        ...composition,
        visuals: composition.visuals.map((v) =>
          v.stepId === step.id ? { ...v, ...patch } : v,
        ),
      });
    },
    [composition, setComposition, step],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<VisualElement>) => {
      if (!visual) return;
      updateVisual({
        elements: visual.elements.map((el) =>
          el.id === id ? ({ ...el, ...patch } as VisualElement) : el,
        ),
      });
    },
    [updateVisual, visual],
  );

  const uploadAsset = async (file: File, kind: "image" | "background" | "bgm") => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch(`/api/projects/${projectId}/upload-asset`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "上傳失敗");
      return data as { storagePath: string; publicUrl: string };
    } finally {
      setUploading(false);
    }
  };

  const generateAiImage = async (target: "element" | "background") => {
    if (!step || !visual) return;
    if (imageProviders.length === 0) {
      toast("AI 生圖需要 OpenAI 或 OpenRouter API Key，請至設定頁填寫", "error");
      return;
    }
    setGeneratingImage(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-step-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id, target, provider: imageProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 生圖失敗");

      if (target === "background") {
        updateVisual({
          background: {
            type: "image",
            storagePath: data.storagePath,
            publicUrl: data.publicUrl,
            opacity: visual.background.opacity ?? 1,
          },
        });
        toast("已依頁面文字生成背景圖", "success");
      } else {
        updateVisual({
          elements: [
            ...visual.elements,
            {
              id: uuidv4(),
              type: "image",
              x: 480,
              y: 320,
              width: 960,
              height: 540,
              zIndex: nextZIndex(visual.elements),
              storagePath: data.storagePath,
              publicUrl: data.publicUrl,
              opacity: 1,
            },
          ],
        });
        toast("已依頁面文字生成並插入圖片", "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI 生圖失敗", "error");
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateAllStepImages = async () => {
    const steps = ordered.filter((s) => s.stepKind !== "chapter");
    if (steps.length === 0) {
      toast("沒有可生圖的教學步驟", "error");
      return;
    }
    if (imageProviders.length === 0) {
      toast("AI 生圖需要 OpenAI 或 OpenRouter API Key，請至設定頁填寫", "error");
      return;
    }
    setGeneratingBatch(true);
    let comp = composition;
    let succeeded = 0;
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!;
        setBatchProgress(`${i + 1}/${steps.length}`);
        const res = await fetch(`/api/projects/${projectId}/generate-step-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: s.id, target: "element", provider: imageProvider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "AI 生圖失敗");

        comp = {
          ...comp,
          visuals: comp.visuals.map((v) => {
            if (v.stepId !== s.id) return v;
            return {
              ...v,
              elements: [
                ...v.elements,
                {
                  id: uuidv4(),
                  type: "image" as const,
                  x: 480,
                  y: 320,
                  width: 960,
                  height: 540,
                  zIndex: nextZIndex(v.elements),
                  storagePath: data.storagePath,
                  publicUrl: data.publicUrl,
                  opacity: 1,
                },
              ],
            };
          }),
        };
        succeeded++;
      }
      setComposition(comp);
      toast(`已為 ${succeeded} 個步驟生成並插入教學配圖`, "success");
    } catch (e) {
      setComposition(comp);
      toast(
        e instanceof Error ? e.message : "批次 AI 生圖失敗",
        succeeded > 0 ? "info" : "error",
      );
      if (succeeded > 0) {
        toast(`已完成 ${succeeded}/${steps.length} 個步驟`, "info");
      }
    } finally {
      setGeneratingBatch(false);
      setBatchProgress("");
    }
  };

  const selected = visual?.elements.find((e) => e.id === selectedId);
  const isHeroText = selected?.type === "text" && selected.id.endsWith("-hero");
  const themeActive = Boolean(themePreviewCss);
  const bgFill = themeActive
    ? "transparent"
    : resolveBackgroundColor(visual, undefined);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    if (!stage || !tr) return;
    if (!selectedId || locked) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne<Konva.Node>((n: Konva.Node) => n.id() === selectedId);
    if (node) {
      tr.nodes([node]);
      tr.forceUpdate();
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, stepIndex, visual?.elements, locked]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleContextMenu = (
    event: Konva.KonvaEventObject<PointerEvent>,
    elementId: string,
  ) => {
    if (locked) return;
    event.evt.preventDefault();
    setContextMenu({
      x: event.evt.clientX,
      y: event.evt.clientY,
      elementId,
    });
    setSelectedId(elementId);
  };

  const applyLayerAction = (action: LayerAction) => {
    if (!visual || !contextMenu) return;
    updateVisual({
      elements: reorderElementLayer(visual.elements, contextMenu.elementId, action),
    });
    setContextMenu(null);
  };

  const addTextBox = () => {
    if (!visual) return;
    const id = uuidv4();
    updateVisual({
      elements: [
        ...visual.elements,
        {
          id,
          type: "text",
          ...defaultContentTextBoxRect(),
          zIndex: nextZIndex(visual.elements),
          content: "文字方塊",
          fontFamily: "Noto Sans TC",
          fontSizePx: 48,
          color:
            visual.elements.find((e) => e.type === "text")?.type === "text"
              ? (visual.elements.find((e) => e.type === "text") as TextVisualElement).color
              : "#ffffff",
          backgroundColor: "#000000",
          backgroundOpacity: 0.35,
          textAlign: "left",
          lineHeightPx: DEFAULT_TEXT_LINE_SPACING_PX,
        },
      ],
    });
    setSelectedId(id);
  };

  const previewW = PREVIEW_W;
  const previewH = PREVIEW_H;

  const goPrevStep = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    setSelectedId(null);
    setContextMenu(null);
  };

  const goNextStep = () => {
    setStepIndex((i) => Math.min(ordered.length - 1, i + 1));
    setSelectedId(null);
    setContextMenu(null);
  };

  const panelClass = "rounded border border-[var(--border)] bg-black/20 p-2.5";

  return (
    <>
      {contextMenu ? (
        <div
          className="fixed z-[100] min-w-[160px] rounded border border-[var(--border)] bg-zinc-900 py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              ["front", "移到最上層"],
              ["forward", "往上移一層"],
              ["backward", "往下移一層"],
              ["back", "移到最下層"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => applyLayerAction(action)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="grid w-full min-w-0 items-stretch gap-x-3 gap-y-2 text-sm"
        style={{
          gridTemplateColumns: `${previewW}px minmax(0, 1fr)`,
          gridTemplateRows: "auto auto minmax(0, 1fr)",
        }}
      >
        <section className={`col-start-1 row-start-1 min-w-0 space-y-2 ${panelClass}`}>
          <h3 className="text-xs font-medium text-zinc-400">步驟與工具</h3>
          <label className="block text-xs text-zinc-500">
            目前步驟
            <select
              value={stepIndex}
              onChange={(e) => {
                setStepIndex(Number(e.target.value));
                setSelectedId(null);
                setContextMenu(null);
              }}
              className="mt-1 w-full rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-xs"
            >
              {ordered.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.stepKind === "chapter"
                    ? `【章節】${s.screenContent.slice(0, 40)}`
                    : `步驟 ${i + 1}：${s.screenContent.slice(0, 40) || `步驟 ${i + 1}`}`}
                </option>
              ))}
            </select>
          </label>
          {imageProviders.length > 1 ? (
            <label className="block text-xs text-zinc-500">
              生圖提供者
              <select
                value={imageProvider}
                disabled={locked || generatingImage || generatingBatch}
                onChange={(e) => setImageProvider(e.target.value as LlmProviderId)}
                className="cf-select mt-1 w-full text-xs"
              >
                {imageProviders.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-nowrap items-center gap-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={addTextBox}
              className={`${AI_BTN_CLASS} shrink-0 whitespace-nowrap`}
            >
              新增文字方塊
            </button>
            <button
              type="button"
              disabled={
                locked ||
                generatingImage ||
                generatingBatch ||
                uploading ||
                imageProviders.length === 0
              }
              onClick={() => generateAiImage("element")}
              className={`${AI_BTN_CLASS} shrink-0 whitespace-nowrap`}
            >
              {generatingImage ? "AI 生圖中…" : "AI 生圖"}
            </button>
            <button
              type="button"
              disabled={
                locked ||
                generatingImage ||
                generatingBatch ||
                uploading ||
                imageProviders.length === 0
              }
              onClick={generateAllStepImages}
              className={`${AI_BTN_CLASS} min-w-0 shrink whitespace-nowrap`}
            >
              {generatingBatch
                ? batchProgress
                  ? `批次生圖 ${batchProgress}…`
                  : "批次生圖中…"
                : "AI 生圖（一次生成）"}
            </button>
          </div>
          <p className="text-[11px] leading-snug text-zinc-500">
            依專案主題與各步驟螢幕內容、口說稿生成教學配圖（OpenAI / OpenRouter API Key）。
          </p>
          <p className="text-[11px] text-zinc-600">
            拖曳移動 · 邊緣調整寬高 · 角落等比縮放 · 右鍵圖層
          </p>
        </section>

        <section className={`col-start-2 row-start-1 min-w-0 space-y-2 ${panelClass}`}>
          <h3 className="text-xs font-medium text-zinc-400">步驟背景</h3>
          <p className="text-xs text-zinc-500">
            目前背景色：<span className="font-mono">{bgFill}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="min-w-0 text-xs text-zinc-500">
              背景色
              <input
                type="color"
                disabled={locked || visual?.background.type === "image"}
                value={
                  visual?.background.type === "color"
                    ? visual.background.color ?? bgFill
                    : bgFill
                }
                onChange={(e) =>
                  updateVisual({
                    background: {
                      type: "color",
                      color: e.target.value,
                      opacity: visual?.background.opacity ?? 1,
                    },
                  })
                }
                className="mt-1 h-9 w-full min-w-0 cursor-pointer rounded border border-[var(--border)]"
              />
            </label>
            <label className="min-w-0 text-xs text-zinc-500">
              背景透明度
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={locked}
                value={visual?.background.opacity ?? 1}
                onChange={(e) =>
                  updateVisual({
                    background: {
                      ...(visual?.background ?? { type: "color", color: bgFill, opacity: 1 }),
                      opacity: Number(e.target.value),
                    },
                  })
                }
                className="mt-2.5 w-full min-w-0"
              />
            </label>
            <div className="min-w-0 text-xs text-zinc-500">
              背景圖片
              <div className="mt-1 min-w-0">
                <CfFilePickButton
                  label="選擇檔案"
                  accept="image/*"
                  className="cf-btn cf-btn-secondary cf-btn-sm w-full max-w-full px-1.5 text-[10px]"
                  disabled={locked || uploading}
                  onFile={async (file) => {
                    const asset = await uploadAsset(file, "background");
                    updateVisual({
                      background: {
                        type: "image",
                        storagePath: asset.storagePath,
                        publicUrl: asset.publicUrl,
                        opacity: visual?.background.opacity ?? 1,
                      },
                    });
                  }}
                />
              </div>
            </div>
          </div>
          {visual?.background.type === "image" ? (
            <button
              type="button"
              disabled={locked}
              className="text-xs text-amber-400"
              onClick={() =>
                updateVisual({
                  background: {
                    type: "color",
                    color: bgFill,
                    opacity: 1,
                  },
                })
              }
            >
              清除背景圖（改回純色）
            </button>
          ) : null}
        </section>

        <section className={`col-start-1 row-start-2 min-w-0 space-y-2 ${panelClass}`}>
          <h3 className="text-xs font-medium text-zinc-400">動效</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 text-xs text-zinc-500">
              進場動畫
              <select
                disabled={locked}
                value={visual?.enterAnimationId ?? "fade-up"}
                onChange={(e) => updateVisual({ enterAnimationId: e.target.value })}
                className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-xs"
              >
                {ENTER_ANIMATIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs text-zinc-500">
              轉場特效
              <select
                disabled={locked}
                value={visual?.transitionId ?? "crossfade"}
                onChange={(e) => updateVisual({ transitionId: e.target.value })}
                className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-xs"
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={`col-start-2 row-start-2 min-w-0 space-y-2 ${panelClass}`}>
          <h3 className="text-xs font-medium text-zinc-400">字幕（階段 2 設定）</h3>
          <p className="text-xs text-zinc-500">
            {subtitle
              ? resolveSubtitleDisplayText(subtitle.segments, step?.script ?? "").slice(0, 80) ||
                "（無字幕文字，請回階段 2 生成）"
              : "此步驟尚無字幕資料"}
          </p>
          <p className="text-xs text-zinc-600">字幕樣式請至「語音字幕」階段調整。</p>
        </section>

        <div
          className="col-start-1 row-start-3 flex min-w-0 flex-col self-start"
          style={{ width: previewW }}
        >
        <div
          className="visual-editor-preview relative shrink-0 overflow-visible rounded border border-[var(--border)] bg-black"
          style={{ width: previewW, height: previewH }}
        >
          {themePreviewCss ? <style>{themePreviewCss}</style> : null}
          <div
            className={
              themeActive
                ? "visual-editor-preview-host cf-theme-preview-host relative"
                : "relative"
            }
            style={{ width: previewW, height: previewH }}
          >
            {themeActive ? (
              <div className="stage-fitter relative" style={{ width: previewW, height: previewH }}>
                <PreviewDomStage
                  visual={visual}
                  bgFill={bgFill}
                  themeActive={themeActive}
                  subtitle={subtitle}
                  script={step?.script ?? ""}
                />
              </div>
            ) : (
              <PreviewDomStage
                visual={visual}
                bgFill={bgFill}
                themeActive={themeActive}
                subtitle={subtitle}
                script={step?.script ?? ""}
              />
            )}
            <div className="absolute left-0 top-0 z-10" style={{ width: previewW, height: previewH }}>
            <Stage
              ref={stageRef}
              width={previewW}
              height={previewH}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage()) {
                  setSelectedId(null);
                  setContextMenu(null);
                }
              }}
            >
              <Layer scaleX={PREVIEW_SCALE} scaleY={PREVIEW_SCALE}>
                {(visual?.elements ?? [])
                  .slice()
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((el) => {
                    if (el.type === "image") {
                      return (
                        <ImageElementNode
                          key={el.id}
                          el={el}
                          selected={selectedId === el.id}
                          locked={locked}
                          onSelect={() => setSelectedId(el.id)}
                          onChange={(patch) => updateElement(el.id, patch)}
                          onContextMenu={handleContextMenu}
                        />
                      );
                    }
                    return (
                      <TextElementNode
                        key={el.id}
                        el={el}
                        selected={selectedId === el.id}
                        locked={locked}
                        onSelect={() => setSelectedId(el.id)}
                        onChange={(patch) => updateElement(el.id, patch)}
                        onContextMenu={handleContextMenu}
                      />
                    );
                  })}
                {!locked ? (
                  <Transformer
                    ref={transformerRef}
                    rotateEnabled={false}
                    keepRatio={false}
                    anchorSize={12}
                    anchorStroke="#14b8a6"
                    anchorFill="#0f766e"
                    borderStroke="#14b8a6"
                    borderStrokeWidth={2}
                    enabledAnchors={[
                      "top-left",
                      "top-center",
                      "top-right",
                      "middle-left",
                      "middle-right",
                      "bottom-left",
                      "bottom-center",
                      "bottom-right",
                    ]}
                    boundBoxFunc={(oldBox, newBox) =>
                      newBox.width < 40 || newBox.height < 24 ? oldBox : newBox
                    }
                  />
                ) : null}
              </Layer>
            </Stage>
            </div>
          </div>
        </div>

          <div className="relative w-full shrink-0" style={{ marginTop: 8 }}>
            {!locked && onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                title={hasUnsavedChanges ? "有未儲存的變更" : undefined}
                className={`cf-btn cf-btn-sm absolute left-0 top-1/2 z-10 -translate-y-1/2 disabled:opacity-50 ${
                  hasUnsavedChanges ? "visual-save-unsaved" : "cf-btn-secondary"
                }`}
              >
                {saving ? "儲存中…" : "儲存"}
              </button>
            ) : null}
            <div className="flex h-8 w-full items-center justify-center gap-2">
              <button
                type="button"
                className="visual-preview-nav-btn"
                aria-label="上一頁"
                title="上一頁"
                disabled={stepIndex <= 0}
                onClick={goPrevStep}
              >
                ◄
              </button>
              <span className="flex h-8 items-center text-[11px] leading-none tabular-nums text-zinc-500">
                {stepIndex + 1} / {ordered.length}
              </span>
              <button
                type="button"
                className="visual-preview-nav-btn"
                aria-label="下一頁"
                title="下一頁"
                disabled={stepIndex >= ordered.length - 1}
                onClick={goNextStep}
              >
                ►
              </button>
            </div>
          </div>
        </div>

        <div
          className={`col-start-2 row-start-3 flex min-h-0 min-w-0 flex-col gap-3 self-stretch overflow-y-auto ${panelClass}`}
        >
        {selected?.type === "text" ? (
          <section className="space-y-2 rounded border border-[var(--border)] p-3">
            <h3 className="text-xs font-medium text-zinc-400">文字方塊</h3>
            {isHeroText ? (
              <p className="text-xs text-zinc-500">主標題內容來自階段 1，此處不可修改文字。</p>
            ) : (
              <label className="block text-xs text-zinc-500">
                文字內容
                <textarea
                  disabled={locked}
                  value={selected.content}
                  rows={3}
                  onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-xs"
                />
              </label>
            )}
            {!isHeroText ? null : (
              <p className="text-xs text-zinc-500 line-clamp-3">{selected.content}</p>
            )}
            <div className="grid grid-cols-[5fr_1fr_1fr_1fr] gap-1.5">
              <label className="min-w-0 text-xs text-zinc-500">
                字型
                <select
                  disabled={locked}
                  value={selected.fontFamily}
                  onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })}
                  className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-1.5 py-1 text-xs"
                >
                  {VISUAL_FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs text-zinc-500">
                字級
                <input
                  type="number"
                  min={12}
                  max={200}
                  disabled={locked}
                  value={selected.fontSizePx}
                  onChange={(e) =>
                    updateElement(selected.id, { fontSizePx: Number(e.target.value) })
                  }
                  className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-1 py-1 text-xs"
                />
              </label>
              <label className="min-w-0 text-xs text-zinc-500">
                行高
                <input
                  type="number"
                  min={4}
                  max={400}
                  disabled={locked}
                  value={selected.lineHeightPx ?? DEFAULT_TEXT_LINE_SPACING_PX}
                  onChange={(e) =>
                    updateElement(selected.id, { lineHeightPx: Number(e.target.value) })
                  }
                  className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-1 py-1 text-xs"
                  title="行高 (px)"
                />
              </label>
              <label className="min-w-0 text-xs text-zinc-500">
                對齊
                <select
                  disabled={locked}
                  value={selected.textAlign}
                  onChange={(e) =>
                    updateElement(selected.id, {
                      textAlign: e.target.value as TextVisualElement["textAlign"],
                    })
                  }
                  className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-black/30 px-0.5 py-1 text-[10px]"
                >
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </label>
            </div>
            <p className="text-[10px] leading-snug text-zinc-600">
              行高預設 {DEFAULT_TEXT_LINE_SPACING_PX}px 額外行距；≥ 字級時為絕對行高
            </p>
            <div className="grid grid-cols-3 gap-2">
              <label className="min-w-0 text-xs text-zinc-500">
                文字顏色
                <input
                  type="color"
                  disabled={locked}
                  value={selected.color}
                  onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                  className="mt-1 h-9 w-full min-w-0 cursor-pointer rounded border border-[var(--border)]"
                />
              </label>
              <label className="min-w-0 text-xs text-zinc-500">
                方塊背景色
                <input
                  type="color"
                  disabled={locked}
                  value={selected.backgroundColor || "#000000"}
                  onChange={(e) =>
                    updateElement(selected.id, { backgroundColor: e.target.value })
                  }
                  className="mt-1 h-9 w-full min-w-0 cursor-pointer rounded border border-[var(--border)]"
                />
              </label>
              <label className="min-w-0 text-xs text-zinc-500">
                方塊背景透明度
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={locked}
                  value={selected.backgroundOpacity}
                  onChange={(e) =>
                    updateElement(selected.id, { backgroundOpacity: Number(e.target.value) })
                  }
                  className="mt-2.5 w-full min-w-0"
                />
              </label>
            </div>
            {!isHeroText ? (
              <button
                type="button"
                disabled={locked}
                className="text-xs text-red-400"
                onClick={() => {
                  if (!visual) return;
                  updateVisual({
                    elements: visual.elements.filter((el) => el.id !== selected.id),
                  });
                  setSelectedId(null);
                }}
              >
                刪除此文字方塊
              </button>
            ) : null}
          </section>
        ) : null}

        {selected?.type === "image" ? (
          <section className="space-y-2 rounded border border-[var(--border)] p-3">
            <h3 className="text-xs font-medium text-zinc-400">圖片元素</h3>
            <label className="block text-xs text-zinc-500">
              透明度
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={locked}
                value={selected.opacity}
                onChange={(e) =>
                  updateElement(selected.id, { opacity: Number(e.target.value) })
                }
                className="mt-1 w-full"
              />
            </label>
            <button
              type="button"
              disabled={locked}
              className="text-xs text-red-400"
              onClick={() => {
                if (!visual) return;
                updateVisual({
                  elements: visual.elements.filter((el) => el.id !== selected.id),
                });
                setSelectedId(null);
              }}
            >
              刪除此圖片
            </button>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400">圖層</h3>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-zinc-400">
            {(visual?.elements ?? [])
              .slice()
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((el) => (
                <li key={el.id}>
                  <button
                    type="button"
                    className={`w-full rounded px-2 py-1 text-left hover:bg-white/5 ${
                      selectedId === el.id ? "bg-teal-900/40 text-teal-200" : ""
                    }`}
                    onClick={() => setSelectedId(el.id)}
                  >
                    {el.type === "text" ? "文字" : "圖片"} · z{el.zIndex}
                    {el.type === "text" ? ` · ${el.content.slice(0, 12)}` : ""}
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400">素材</h3>
          <CfFilePickButton
            label="選擇檔案"
            accept="image/*"
            disabled={locked || uploading}
            onFile={async (file) => {
              if (!visual) return;
              const asset = await uploadAsset(file, "image");
              updateVisual({
                elements: [
                  ...visual.elements,
                  {
                    id: uuidv4(),
                    type: "image",
                    x: 480,
                    y: 320,
                    width: 640,
                    height: 360,
                    zIndex: nextZIndex(visual.elements),
                    storagePath: asset.storagePath,
                    publicUrl: asset.publicUrl,
                    opacity: 1,
                  },
                ],
              });
            }}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400">背景音樂</h3>
          <CfFilePickButton
            label="選擇檔案"
            accept="audio/*"
            disabled={locked || uploading}
            onFile={async (file) => {
              const asset = await uploadAsset(file, "bgm");
              setComposition({
                ...composition,
                bgm: {
                  storagePath: asset.storagePath,
                  publicUrl: asset.publicUrl,
                  volume: composition.bgm.volume,
                },
              });
            }}
          />
          {composition.bgm.publicUrl ? (
            <p className="text-xs text-emerald-400">已設定背景音樂</p>
          ) : (
            <p className="text-xs text-zinc-500">尚未上傳</p>
          )}
          <label className="block text-xs text-zinc-500">
            預設音量
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={locked}
              value={composition.bgm.volume}
              onChange={(e) =>
                setComposition({
                  ...composition,
                  bgm: { ...composition.bgm, volume: Number(e.target.value) },
                })
              }
              className="mt-1 w-full"
            />
          </label>
        </section>
        </div>
      </div>
    </>
  );
}
