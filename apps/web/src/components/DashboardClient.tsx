"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { formatProjectDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/cn";

type Project = {
  id: string;
  title: string;
  updatedAtLabel: string;
  previewBuilt?: boolean;
};

export function DashboardClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const createProject = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast("請輸入專案名稱", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "建立失敗", "error");
        return;
      }
      setProjects((prev) => [
        {
          id: data.project.id,
          title: data.project.title,
          updatedAtLabel: formatProjectDateTime(data.project.updated_at),
          previewBuilt: false,
        },
        ...prev,
      ]);
      setNewTitle("");
      setShowCreate(false);
      toast(`專案「${title}」已建立`, "success");
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const renameProject = async (id: string) => {
    const title = editTitle.trim();
    if (!title) {
      toast("專案名稱不可為空", "error");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "重新命名失敗", "error");
        return;
      }
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
      setEditingId(null);
      toast("專案名稱已更新", "success");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const deleteProject = async (project: Project) => {
    setBusyId(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "刪除失敗", "error");
        return;
      }
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setDeletingProject(null);
      toast(`已刪除專案「${project.title}」`, "success");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <CreateSection
        showCreate={showCreate}
        creating={creating}
        newTitle={newTitle}
        onShowCreate={() => setShowCreate(true)}
        onHideCreate={() => {
          setShowCreate(false);
          setNewTitle("");
        }}
        onTitleChange={setNewTitle}
        onSubmit={createProject}
      />

      {projects.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {projects.map((p) => (
            <li key={p.id}>
              <article
                className={cn(
                  "cf-card cf-card-padded cf-card-hover",
                  editingId === p.id && "ring-1 ring-[var(--ring)]",
                )}
              >
                {editingId === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="cf-input min-w-[200px] flex-1"
                      autoFocus
                    />
                    <Button size="sm" disabled={busyId === p.id} onClick={() => renameProject(p.id)}>
                      {busyId === p.id ? "儲存中…" : "儲存"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${p.id}/content`} className="group block">
                        <h2 className="truncate text-base font-semibold tracking-tight group-hover:text-[var(--color-cf-accent)]">
                          {p.title}
                        </h2>
                        <p className="mt-1 text-xs text-zinc-500" suppressHydrationWarning>
                          更新於 {p.updatedAtLabel}
                        </p>
                      </Link>
                    </div>
                    {p.previewBuilt ? (
                      <div className="flex min-w-[260px] flex-wrap items-center justify-center gap-2">
                        <Link
                          href={`/projects/${p.id}/wvp-play`}
                          className="cf-btn cf-btn-primary cf-btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          播放
                        </Link>
                        <Link
                          href={`/projects/${p.id}/wvp-play?auto=1`}
                          className="cf-btn cf-btn-secondary cf-btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          自動播放
                        </Link>
                      </div>
                    ) : (
                      <div className="min-w-[260px]" />
                    )}
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === p.id}
                        className="min-h-0 gap-[0.1875rem] px-[0.375rem] py-[0.1875rem] text-[0.40625rem] leading-tight"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditTitle(p.title);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        重新命名
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === p.id}
                        className="min-h-0 gap-[0.1875rem] px-[0.375rem] py-[0.1875rem] text-[0.40625rem] leading-tight"
                        onClick={() => setDeletingProject(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        刪除
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {deletingProject ? (
        <ConfirmDialog
          title="確認刪除專案"
          message={`確定要刪除「${deletingProject.title}」嗎？此操作無法復原。`}
          confirmLabel={busyId === deletingProject.id ? "刪除中…" : "確認刪除"}
          busy={busyId === deletingProject.id}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => deleteProject(deletingProject)}
        />
      ) : null}
    </>
  );
}

function CreateSection({
  showCreate,
  creating,
  newTitle,
  onShowCreate,
  onHideCreate,
  onTitleChange,
  onSubmit,
}: {
  showCreate: boolean;
  creating: boolean;
  newTitle: string;
  onShowCreate: () => void;
  onHideCreate: () => void;
  onTitleChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mb-6">
      {!showCreate ? (
        <Button onClick={onShowCreate}>+ 新專案</Button>
      ) : (
        <div className="cf-card cf-card-padded">
          <label className="cf-label" htmlFor="new-project-title">
            專案名稱
          </label>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input
              id="new-project-title"
              value={newTitle}
              placeholder="例如：Python 入門教學"
              className="cf-input min-w-[240px] flex-1"
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
            <Button disabled={creating} onClick={onSubmit}>
              {creating ? "建立中…" : "建立專案"}
            </Button>
            <Button variant="secondary" disabled={creating} onClick={onHideCreate}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="cf-empty">
      <p className="mb-4">尚無專案，建立第一個教學影片專案開始吧。</p>
      <Button onClick={onCreate}>+ 建立專案</Button>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="cf-card cf-card-padded w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
