# 內建 Agent Skills

## web-video-presentation

本目錄為 [web-video-presentation](https://github.com/ConardLi/garden-skills/tree/main/skills/web-video-presentation) 的**專案內建副本**，供 CourseFlow 腳手架（`wvp scaffold`）與 Studio 使用，無需依賴本機 `~/.agents/skills/` 或設定 `WVP_SKILL_DIR`。

同步更新（從本機 Skill 安裝處覆蓋）：

```powershell
node scripts/sync-wvp-skill.mjs
# 或指定來源：
node scripts/sync-wvp-skill.mjs "C:\path\to\web-video-presentation"
```

執行後會同步至：

- `skills/web-video-presentation/`
- `packages/wvp-bridge/vendor/web-video-presentation/`

## CourseFlow 平台

Monorepo 根目錄請見 [README.md](../README.md)。主要入口：

- `apps/web` — Next.js Studio
- `apps/worker` — TTS / HyperFrames 渲染 worker
- `packages/*` — 共用套件
