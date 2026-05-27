#!/usr/bin/env node
/**
 * 將既有 Render「courseflow-web / worker」切換為 CourseFlow2 repo（v2 覆蓋 v1）。
 *
 * 用法（PowerShell）：
 *   $env:RENDER_API_KEY = "rnd_xxxx"   # https://dashboard.render.com/u/settings#api-keys
 *   node scripts/render-cutover.mjs
 *
 * 可選：
 *   $env:RENDER_WEB_SERVICE_ID = "srv-d89h0o6l51nc738edgc0"
 *   $env:RENDER_WORKER_SERVICE_ID = "srv-xxxxxxxx"   # 不設則依名稱 courseflow-worker 搜尋
 */

const API = "https://api.render.com/v1";
const REPO = "https://github.com/taiwanveo/CourseFlow2";
const BRANCH = "main";

const WEB_SERVICE_ID =
  process.env.RENDER_WEB_SERVICE_ID ?? "srv-d89h0o6l51nc738edgc0";

const MERGE_ENV = [
  { key: "NODE_ENV", value: "production" },
  { key: "COURSEFLOW_EDITION", value: "v2" },
];

async function api(path, opts = {}) {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    console.error("請設定環境變數 RENDER_API_KEY（Render Dashboard → Account Settings → API Keys）");
    process.exit(1);
  }
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function listServices() {
  const out = [];
  let cursor;
  for (;;) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const page = await api(`/services${q}`);
    const items = Array.isArray(page) ? page : (page?.services ?? []);
    for (const row of items) {
      const s = row.service ?? row;
      if (s?.id) out.push(s);
    }
    const last = items[items.length - 1];
    cursor = last?.cursor ?? page?.cursor ?? page?.nextCursor;
    if (!cursor || items.length === 0) break;
  }
  return out;
}

async function patchService(serviceId, body) {
  return api(`/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function putEnv(serviceId, envVars) {
  return api(`/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify(
      envVars.map(({ key, value }) => ({ envVar: { key, value } })),
    ),
  });
}

async function mergeEnv(serviceId, envVars) {
  const current = await api(`/services/${serviceId}/env-vars`);
  const rows = Array.isArray(current) ? current : [];
  const map = new Map();
  for (const row of rows) {
    const ev = row.envVar ?? row;
    if (ev?.key) map.set(ev.key, ev.value ?? "");
  }
  for (const { key, value } of envVars) map.set(key, value);
  return putEnv(
    serviceId,
    [...map.entries()].map(([key, value]) => ({ key, value })),
  );
}

async function createDeploy(serviceId) {
  return api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: true }),
  });
}

function dockerPatch(dockerfilePath) {
  return {
    repo: REPO,
    branch: BRANCH,
    rootDir: "",
    serviceDetails: {
      env: "docker",
      dockerfilePath,
      dockerContext: ".",
    },
  };
}

async function cutoverService({ id, name, type, dockerfile }) {
  console.log(`\n→ ${name} (${id}, ${type})`);
  await patchService(id, dockerPatch(dockerfile));
  console.log("  Git / Docker 已指向 CourseFlow2");
  await mergeEnv(id, MERGE_ENV);
  console.log("  已合併 COURSEFLOW_EDITION=v2（其餘 Supabase/Redis 變數保留不變）");
  const deploy = await createDeploy(id);
  const deployId = deploy?.id ?? deploy?.deploy?.id ?? "(unknown)";
  console.log(`  已觸發部署（clear cache）: ${deployId}`);
}

async function main() {
  console.log("CourseFlow v1 → v2 Render cutover");
  console.log(`Repo: ${REPO} @ ${BRANCH}`);

  const services = await listServices();
  const web =
    services.find((s) => s.id === WEB_SERVICE_ID) ??
    services.find((s) => s.name === "courseflow-web");
  if (!web) {
    throw new Error(`找不到 Web 服務（預期 ${WEB_SERVICE_ID} 或名稱 courseflow-web）`);
  }

  let workerId = process.env.RENDER_WORKER_SERVICE_ID;
  let worker = workerId ? services.find((s) => s.id === workerId) : null;
  if (!worker) {
    worker = services.find(
      (s) =>
        s.type === "background_worker" &&
        /courseflow.*worker/i.test(s.name ?? ""),
    );
  }
  if (!worker) {
    worker = services.find((s) => s.type === "background_worker");
  }

  await cutoverService({
    id: web.id,
    name: web.name,
    type: web.type,
    dockerfile: "./Dockerfile.web",
  });

  if (worker) {
    await cutoverService({
      id: worker.id,
      name: worker.name,
      type: worker.type,
      dockerfile: "./Dockerfile.worker",
    });
  } else {
    console.warn("\n⚠ 未找到 Background Worker，請在 Dashboard 手動改 worker 的 Git/Dockerfile.worker");
  }

  console.log("\n完成。請在 Supabase 執行 v2 migrations，並確認 Auth 網址仍為 https://courseflow-web-txjr.onrender.com");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
