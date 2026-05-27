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

/** 單一變數 upsert（避免 bulk PUT 把 Dashboard 空 key / secret 占位一併送回去） */
async function upsertEnv(serviceId, key, value) {
  const k = key.trim();
  if (!k) return;
  const encoded = encodeURIComponent(k);
  return api(`/services/${serviceId}/env-vars/${encoded}`, {
    method: "PUT",
    body: JSON.stringify({ key: k, value: value ?? "" }),
  });
}

async function mergeEnv(serviceId, envVars) {
  for (const { key, value } of envVars) {
    await upsertEnv(serviceId, key, value);
  }
}

async function createDeploy(serviceId) {
  return api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: "clear" }),
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

async function cutoverService({ id, name, type, dockerfile, skipGit }) {
  console.log(`\n→ ${name} (${id}, ${type})`);
  if (!skipGit) {
    await patchService(id, dockerPatch(dockerfile));
    console.log("  Git / Docker 已指向 CourseFlow2");
  } else {
    console.log("  （略過 Git/Docker，僅更新 env + 部署）");
  }
  await mergeEnv(id, MERGE_ENV);
  console.log("  已設定 COURSEFLOW_EDITION=v2、NODE_ENV=production");
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

  const skipGit = process.env.RENDER_CUTOVER_SKIP_GIT === "1";

  await cutoverService({
    id: web.id,
    name: web.name,
    type: web.type,
    dockerfile: "./Dockerfile.web",
    skipGit,
  });

  if (worker) {
    await cutoverService({
      id: worker.id,
      name: worker.name,
      type: worker.type,
      dockerfile: "./Dockerfile.worker",
      skipGit,
    });
  } else {
    console.warn("\n⚠ 未找到 Background Worker，請在 Dashboard 手動改 worker 的 Git/Dockerfile.worker");
  }

  console.log(
    "\n完成。Supabase migrations 若已套用，請至 Dashboard 確認 deploy 成功後開啟 https://courseflow-web-txjr.onrender.com",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
