"use client";

import { playFinishedSound, playWarningSound } from "@/lib/ui-sounds";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastOptions = {
  /** 長時間 AI／批次任務成功完成時播放 Finished 音效 */
  taskComplete?: boolean;
};

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 10_000;
const TOAST_DURATIONS: Partial<Record<ToastType, number>> = {
  warning: 3_000,
  success: 3_000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", options?: ToastOptions) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      if (type === "error") {
        playWarningSound();
      } else if (type === "success" && options?.taskComplete) {
        playFinishedSound();
      }
      window.setTimeout(() => dismiss(id), TOAST_DURATIONS[type] ?? TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <ToastViewport toasts={toasts} onDismiss={dismiss} />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
            t.type === "success"
              ? "border-emerald-600/50 bg-emerald-950 text-emerald-100"
              : t.type === "error"
                ? "border-red-600/50 bg-red-950 text-red-100"
                : t.type === "warning"
                  ? "border-amber-600/50 bg-amber-950 text-amber-100"
                  : "border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]"
          }`}
        >
          <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded p-1 text-xs opacity-70 hover:opacity-100"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 必須在 ToastProvider 內使用");
  }
  return ctx;
}
