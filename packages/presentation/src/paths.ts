import { join } from "node:path";

/** 專案內 WVP presentation 目錄（相對於專案工作根） */
export const PRESENTATION_DIR = "presentation";

export const SOURCE_FILES = {
  article: "article.md",
  script: "script.md",
  outline: "outline.md",
} as const;

export function presentationRoot(projectWorkDir: string): string {
  return join(projectWorkDir, PRESENTATION_DIR);
}

export function chapterDir(projectWorkDir: string, folderName: string): string {
  return join(presentationRoot(projectWorkDir), "src", "chapters", folderName);
}

export function narrationsFile(projectWorkDir: string, folderName: string): string {
  return join(chapterDir(projectWorkDir, folderName), "narrations.ts");
}

/** Storage 前綴：{userId}/{projectId}/ */
export function storageProjectPrefix(userId: string, projectId: string): string {
  return `${userId}/${projectId}`;
}

export function storagePresentationPrefix(userId: string, projectId: string): string {
  return `${storageProjectPrefix(userId, projectId)}/${PRESENTATION_DIR}`;
}
