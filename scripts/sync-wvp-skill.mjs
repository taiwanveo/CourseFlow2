#!/usr/bin/env node
/**
 * Sync web-video-presentation skill into CourseFlow vendor paths.
 * Usage: node scripts/sync-wvp-skill.mjs [sourceDir]
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const defaultSource = join(root, "skills", "web-video-presentation");
const source = resolve(process.argv[2] ?? defaultSource);

const targets = [
  join(root, "skills", "web-video-presentation"),
  join(root, "packages", "wvp-bridge", "vendor", "web-video-presentation"),
];

if (!existsSync(source)) {
  console.error(`來源不存在: ${source}`);
  process.exit(1);
}

for (const target of targets) {
  if (resolve(source) === resolve(target)) {
    console.log(`跳過（來源與目標相同）: ${target}`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
  console.log(`已同步 → ${target}`);
}

console.log("WVP skill 同步完成");
