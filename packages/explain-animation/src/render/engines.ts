import type { ExplainAnimationConfig } from "../schema.js";
import { barHeight, counterScript, esc, scheduleScript, type SceneParts } from "./shared.js";

function percentBarScene(
  title: string,
  p: {
    beforeValue: number;
    afterValue: number;
    deltaPct?: number;
    beforeLabel: string;
    afterLabel: string;
  },
  grow: boolean,
): SceneParts {
  const max = Math.max(p.beforeValue, p.afterValue, 1);
  const h0 = barHeight(p.beforeValue, max);
  const h1 = barHeight(p.afterValue, max);
  const delta = p.deltaPct ?? Math.abs(Math.round(((p.afterValue - p.beforeValue) / Math.max(1, p.beforeValue)) * 100));
  const color = grow ? "#27ae60" : "#e74c3c";
  const y1 = 290 - h1;
  return {
    title,
    subtitle: `${p.beforeLabel} → ${p.afterLabel}`,
    svg: `<svg viewBox="0 0 560 340" xmlns="http://www.w3.org/2000/svg">
  <line x1="60" y1="290" x2="500" y2="290" stroke="var(--text-mute)" stroke-width="2"/>
  <rect x="120" y="${290 - h0}" width="100" height="${h0}" fill="#bdc3c7" rx="4"/>
  <text x="170" y="${290 - h0 - 10}" text-anchor="middle" fill="var(--text-mute)" font-size="13" font-weight="600">${esc(p.beforeLabel)}</text>
  <text x="170" y="${290 - h0 / 2}" text-anchor="middle" fill="white" font-size="20" font-weight="700">${p.beforeValue}</text>
  <rect id="growBar" x="340" y="290" width="100" height="0" fill="${color}" rx="4"
    style="transition:y 1.8s cubic-bezier(.4,1.2,.5,1),height 1.8s cubic-bezier(.4,1.2,.5,1)"/>
  <line x1="340" y1="${290 - h0}" x2="440" y2="${290 - h0}" stroke="#95a5a6" stroke-width="2" stroke-dasharray="5,4"/>
  <text x="390" y="${290 - h0 - 10}" text-anchor="middle" fill="${color}" font-size="13" font-weight="600">${esc(p.afterLabel)}</text>
  <text id="newNumber" x="390" y="${y1 + h1 / 2}" text-anchor="middle" fill="white" font-size="22" font-weight="700" opacity="0" style="transition:opacity .4s">${p.afterValue}</text>
  <text x="390" y="310" text-anchor="middle" fill="var(--text-mute)" font-size="12">${grow ? "+" : "-"}${delta}%</text>
</svg>`,
    script: scheduleScript([
      { delay: 400, code: `var b=document.getElementById('growBar');b.style.height='${h1}px';b.style.y='${y1}px';` },
      { delay: 900, code: `document.getElementById('newNumber').style.opacity='1';` },
      { delay: 1200, code: counterScript("newNumber", p.beforeValue, p.afterValue).replace(/el\.textContent=to;/, `el.textContent=String(to);`) },
    ]),
  };
}

function amountDeltaScene(
  title: string,
  p: {
    beforeValue: number;
    delta: number;
    afterValue?: number;
    unit: string;
    entity: string;
    beforeLabel: string;
    afterLabel: string;
  },
  add: boolean,
): SceneParts {
  const after = p.afterValue ?? (add ? p.beforeValue + p.delta : Math.max(0, p.beforeValue - p.delta));
  const color = add ? "#2980b9" : "#c0392b";
  return {
    title,
    subtitle: `${p.entity} ${add ? "+" : "-"}${p.delta}${p.unit}`,
    svg: `<svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg">
  <text x="280" y="50" text-anchor="middle" fill="var(--text)" font-size="28" font-weight="700">${esc(p.entity)}</text>
  <rect x="80" y="100" width="160" height="120" rx="8" fill="#ecf0f1"/>
  <text x="160" y="90" text-anchor="middle" fill="var(--text-mute)" font-size="12">${esc(p.beforeLabel)}</text>
  <text id="baseNum" x="160" y="175" text-anchor="middle" fill="var(--text)" font-size="32" font-weight="700">${p.beforeValue}</text>
  <text x="160" y="205" text-anchor="middle" fill="var(--text-mute)" font-size="12">${esc(p.unit)}</text>
  <text x="280" y="165" text-anchor="middle" fill="${color}" font-size="36" font-weight="700">${add ? "+" : "−"}${p.delta}</text>
  <rect id="resultBox" x="320" y="100" width="160" height="120" rx="8" fill="${color}" opacity="0.15" style="transition:opacity .6s"/>
  <text x="400" y="90" text-anchor="middle" fill="${color}" font-size="12" opacity="0" id="afterLbl" style="transition:opacity .5s">${esc(p.afterLabel)}</text>
  <text id="resultNum" x="400" y="175" text-anchor="middle" fill="${color}" font-size="32" font-weight="700" opacity="0" style="transition:opacity .5s">${after}</text>
  <text x="400" y="205" text-anchor="middle" fill="var(--text-mute)" font-size="12" opacity="0" id="unitLbl" style="transition:opacity .5s">${esc(p.unit)}</text>
</svg>`,
    script: scheduleScript([
      { delay: 600, code: `document.getElementById('resultBox').style.opacity='1';document.getElementById('afterLbl').style.opacity='1';document.getElementById('resultNum').style.opacity='1';document.getElementById('unitLbl').style.opacity='1';` },
      { delay: 900, code: counterScript("resultNum", p.beforeValue, after) },
    ]),
  };
}

function journeyScene(p: { fromLabel: string; toLabel: string; viaLabel?: string }): SceneParts {
  const via = p.viaLabel
    ? `<circle cx="280" cy="160" r="28" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" opacity="0" id="viaNode" style="transition:opacity .5s"/>
       <text x="280" y="166" text-anchor="middle" fill="var(--accent)" font-size="14" font-weight="600" opacity="0" id="viaTxt" style="transition:opacity .5s">${esc(p.viaLabel)}</text>`
    : "";
  return {
    title: `${p.fromLabel} → ${p.toLabel}`,
    subtitle: "歷程",
    svg: `<svg viewBox="0 0 560 280" xmlns="http://www.w3.org/2000/svg">
  <line x1="120" y1="160" x2="440" y2="160" stroke="var(--text-mute)" stroke-width="3" stroke-dasharray="420" stroke-dashoffset="420" id="pathLine" style="transition:stroke-dashoffset 1.6s ease"/>
  <circle cx="120" cy="160" r="36" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="3"/>
  <text x="120" y="168" text-anchor="middle" fill="var(--accent)" font-size="22" font-weight="700">${esc(p.fromLabel)}</text>
  ${via}
  <circle cx="440" cy="160" r="36" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="3" opacity="0.3" id="toNode" style="transition:opacity .6s"/>
  <text x="440" y="168" text-anchor="middle" fill="var(--accent)" font-size="22" font-weight="700" opacity="0.3" id="toTxt" style="transition:opacity .6s">${esc(p.toLabel)}</text>
  <polygon points="400,160 420,150 420,170" fill="var(--accent)" opacity="0" id="arrow" style="transition:opacity .4s"/>
</svg>`,
    script: scheduleScript([
      { delay: 300, code: `document.getElementById('pathLine').style.strokeDashoffset='0';` },
      { delay: 1200, code: `document.getElementById('toNode').style.opacity='1';document.getElementById('toTxt').style.opacity='1';document.getElementById('arrow').style.opacity='1';` },
      ...(p.viaLabel
        ? [{ delay: 800, code: `var v=document.getElementById('viaNode');if(v){v.style.opacity='1';document.getElementById('viaTxt').style.opacity='1';}` }]
        : []),
    ]),
  };
}

function flowStepsScene(steps: string[]): SceneParts {
  const n = steps.length;
  const gap = 400 / Math.max(1, n - 1);
  const nodes = steps
    .map((s, i) => {
      const x = 80 + i * gap;
      return `<circle cx="${x}" cy="160" r="22" fill="var(--surface)" stroke="var(--text-mute)" stroke-width="2" id="node${i}" opacity="0.35"/>
      <text x="${x}" y="166" text-anchor="middle" fill="var(--text)" font-size="11" id="lbl${i}" opacity="0">${esc(s.slice(0, 6))}</text>`;
    })
    .join("");
  const lines = Array.from({ length: n - 1 }, (_, i) => {
    const x1 = 80 + i * gap + 22;
    const x2 = 80 + (i + 1) * gap - 22;
    return `<line x1="${x1}" y1="160" x2="${x2}" y2="160" stroke="var(--accent)" stroke-width="2" opacity="0" id="ln${i}" style="transition:opacity .4s"/>`;
  }).join("");
  const scriptSteps = steps.flatMap((_, i) => [
    { delay: 400 + i * 500, code: `var n=document.getElementById('node${i}');n.style.opacity='1';n.setAttribute('fill','var(--accent-soft)');n.setAttribute('stroke','var(--accent)');document.getElementById('lbl${i}').style.opacity='1';` },
    ...(i > 0 ? [{ delay: 400 + i * 500 - 200, code: `document.getElementById('ln${i - 1}').style.opacity='1';` }] : []),
  ]);
  return {
    title: "流程",
    subtitle: `${n} 步`,
    svg: `<svg viewBox="0 0 480 260" xmlns="http://www.w3.org/2000/svg">${lines}${nodes}</svg>`,
    script: scheduleScript(scriptSteps),
  };
}

function listScene(title: string, items: string[], mode: "stagger" | "check" | "rank"): SceneParts {
  const rows = items
    .map(
      (item, i) =>
        `<g id="row${i}" opacity="0" style="transition:opacity .5s,transform .5s;transform:translateX(-12px)">
      <rect x="60" y="${50 + i * 48}" width="400" height="40" rx="8" fill="var(--accent-soft)"/>
      ${mode === "check" ? `<text x="78" y="${78 + i * 48}" fill="var(--accent)" font-size="18" id="tick${i}">○</text>` : ""}
      ${mode === "rank" ? `<text x="78" y="${78 + i * 48}" fill="var(--accent)" font-size="16" font-weight="700">#${i + 1}</text>` : ""}
      <text x="${mode === "stagger" ? 78 : 100}" y="${78 + i * 48}" fill="var(--text)" font-size="14">${esc(item.slice(0, 14))}</text>
    </g>`,
    )
    .join("");
  const scriptSteps = items.map((_, i) => ({
    delay: 350 + i * 450,
    code: `var r=document.getElementById('row${i}');r.style.opacity='1';r.style.transform='translateX(0)';${mode === "check" ? `setTimeout(function(){document.getElementById('tick${i}').textContent='✓';},300);` : ""}`,
  }));
  return { title, subtitle: `${items.length} 項`, svg: `<svg viewBox="0 0 480 ${60 + items.length * 48}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`, script: scheduleScript(scriptSteps) };
}

function sparklineScene(points: { label: string; value: number }[], unit: string): SceneParts {
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 400;
  const step = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => `${60 + i * step},${240 - barHeight(p.value, max, 160)}`).join(" ");
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${60 + i * step}" cy="${240 - barHeight(p.value, max, 160)}" r="5" fill="var(--accent)" opacity="0" id="dot${i}" style="transition:opacity .3s"/>
     <text x="${60 + i * step}" y="265" text-anchor="middle" fill="var(--text-mute)" font-size="11">${esc(p.label)}</text>
     <text x="${60 + i * step}" y="${220 - barHeight(p.value, max, 160)}" text-anchor="middle" fill="var(--accent)" font-size="12" font-weight="600" opacity="0" id="val${i}" style="transition:opacity .3s">${p.value}</text>`,
    )
    .join("");
  return {
    title: "趨勢",
    subtitle: unit,
    svg: `<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
  <polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="600" stroke-dashoffset="600" id="line" style="transition:stroke-dashoffset 1.4s ease"/>
  ${dots}
</svg>`,
    script: scheduleScript([
      { delay: 300, code: `document.getElementById('line').style.strokeDashoffset='0';` },
      ...points.map((_, i) => ({ delay: 800 + i * 200, code: `document.getElementById('dot${i}').style.opacity='1';document.getElementById('val${i}').style.opacity='1';` })),
    ]),
  };
}

function emphasisScene(text: string, sub?: string, variant: "pulse" | "ring" | "check" | "badge" = "pulse"): SceneParts {
  const extra =
    variant === "ring"
      ? `<circle cx="280" cy="150" r="80" fill="none" stroke="var(--accent)" stroke-width="4" opacity="0" id="ring" style="transition:opacity .5s, r 1s ease"/><circle cx="280" cy="150" r="40" fill="var(--accent-soft)" opacity="0" id="core" style="transition:opacity .6s"/>`
      : variant === "check"
        ? `<path d="M220 150 L250 180 L340 110" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200" id="chk" style="transition:stroke-dashoffset 1s ease"/>`
        : variant === "badge"
          ? `<polygon points="280,70 310,130 370,130 320,170 340,230 280,195 220,230 240,170 190,130 250,130" fill="var(--accent)" opacity="0" id="star" style="transition:opacity .6s,transform .6s;transform:scale(0.5)"/>`
          : `<rect x="140" y="110" width="280" height="80" rx="12" fill="var(--accent-soft)" opacity="0" id="box" style="transition:opacity .5s,transform .6s;transform:scale(0.9)"/>`;
  const anim =
    variant === "ring"
      ? [{ delay: 400, code: `document.getElementById('ring').style.opacity='1';document.getElementById('core').style.opacity='1';` }]
      : variant === "check"
        ? [{ delay: 500, code: `document.getElementById('chk').style.strokeDashoffset='0';` }]
        : variant === "badge"
          ? [{ delay: 400, code: `var s=document.getElementById('star');s.style.opacity='1';s.style.transform='scale(1)';` }]
          : [{ delay: 400, code: `var b=document.getElementById('box');b.style.opacity='1';b.style.transform='scale(1)';` }];
  return {
    title: text,
    subtitle: sub ?? "",
    svg: `<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg">${extra}
  <text x="280" y="158" text-anchor="middle" fill="var(--accent)" font-size="42" font-weight="800">${esc(text.slice(0, 8))}</text>
</svg>`,
    script: scheduleScript(anim),
  };
}

function balanceScene(p: {
  leftLabel: string;
  rightLabel: string;
  leftSub?: string;
  rightSub?: string;
  sequence: ("left" | "right" | "balance")[];
}): SceneParts {
  return {
    title: "平衡",
    subtitle: `${p.leftLabel} ⇆ ${p.rightLabel}`,
    svg: `<svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg">
  <polygon points="280,80 120,200 440,200" fill="none" stroke="var(--text-mute)" stroke-width="3"/>
  <line x1="280" y1="80" x2="280" y2="200" stroke="var(--text-mute)" stroke-width="3"/>
  <g id="beam" style="transition:transform 1.2s ease;transform-origin:280px 200px;transform:rotate(-12deg)">
    <line x1="120" y1="200" x2="440" y2="200" stroke="var(--accent)" stroke-width="6"/>
    <circle cx="120" cy="200" r="28" fill="#c0392b" opacity="0.4" id="leftW"/>
    <circle cx="440" cy="200" r="28" fill="#2980b9" opacity="0.4" id="rightW"/>
  </g>
  <text x="120" y="250" text-anchor="middle" fill="#c0392b" font-size="14" font-weight="600">${esc(p.leftLabel)}</text>
  <text x="440" y="250" text-anchor="middle" fill="#2980b9" font-size="14" font-weight="600">${esc(p.rightLabel)}</text>
</svg>`,
    script: scheduleScript([
      { delay: 500, code: `document.getElementById('leftW').style.opacity='1';` },
      { delay: 1100, code: `document.getElementById('rightW').style.opacity='1';` },
      { delay: 1800, code: `document.getElementById('beam').style.transform='rotate(0deg)';` },
    ]),
  };
}

function genericTwoCol(title: string, left: string, right: string): SceneParts {
  return {
    title,
    subtitle: "對比",
    svg: `<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="60" width="220" height="160" rx="8" fill="var(--accent-soft)" opacity="0" id="L" style="transition:opacity .6s"/>
  <rect x="300" y="60" width="220" height="160" rx="8" fill="var(--accent-soft)" opacity="0" id="R" style="transition:opacity .6s"/>
  <text x="150" y="150" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="600">${esc(left.slice(0, 8))}</text>
  <text x="410" y="150" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="600">${esc(right.slice(0, 8))}</text>
</svg>`,
    script: scheduleScript([
      { delay: 400, code: `document.getElementById('L').style.opacity='1';` },
      { delay: 900, code: `document.getElementById('R').style.opacity='1';` },
    ]),
  };
}

function partsScene(count: number, merge: boolean): SceneParts {
  const parts = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const x = 280 + Math.cos(angle) * 100;
    const y = 150 + Math.sin(angle) * 80;
    return `<rect x="${x - 20}" y="${y - 20}" width="40" height="40" rx="6" fill="var(--accent)" opacity="0.85" id="p${i}" style="transition:transform 1s ease,opacity .5s"/>`;
  }).join("");
  return {
    title: merge ? "聚合" : "拆解",
    subtitle: `${count} 塊`,
    svg: `<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg">${parts}
  <circle cx="280" cy="150" r="36" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" opacity="0" id="hub" style="transition:opacity .6s"/>
</svg>`,
    script: scheduleScript([
      ...Array.from({ length: count }, (_, i) => ({
        delay: 300 + i * 150,
        code: merge
          ? `var el=document.getElementById('p${i}');el.style.transform='translate(${280 - (280 + Math.cos((i / count) * Math.PI * 2) * 100)}px,${150 - (150 + Math.sin((i / count) * Math.PI * 2) * 80)}px)';`
          : `document.getElementById('p${i}').style.opacity='1';`,
      })),
      { delay: 300 + count * 150, code: `document.getElementById('hub').style.opacity='1';` },
    ]),
  };
}

function arcScene(percent: number, label: string): SceneParts {
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return {
    title: label || "進度",
    subtitle: `${percent}%`,
    svg: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="140" cy="100" r="${r}" fill="none" stroke="var(--text-mute)" stroke-width="12" opacity="0.25"/>
  <circle cx="140" cy="100" r="${r}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-dasharray="${c}" stroke-dashoffset="${c}" id="arc" style="transition:stroke-dashoffset 1.6s ease" transform="rotate(-90 140 100)"/>
  <text x="140" y="108" text-anchor="middle" fill="var(--accent)" font-size="28" font-weight="700" id="pct">0%</text>
</svg>`,
    script: scheduleScript([
      { delay: 400, code: `document.getElementById('arc').style.strokeDashoffset='${offset}';` },
      {
        delay: 600,
        code: `(function(){var el=document.getElementById('pct'),from=0,to=${percent},t0=null,dur=1400;
function tick(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur);el.textContent=Math.round(from+(to-from)*(1-Math.pow(1-p,3)))+'%';
if(p<1)requestAnimationFrame(tick);else el.textContent=to+'%';}
requestAnimationFrame(tick);})();`,
      },
    ]),
  };
}

function barsRaceScene(points: { label: string; value: number }[]): SceneParts {
  const max = Math.max(...points.map((p) => p.value), 1);
  const rows = points
    .map(
      (p, i) =>
        `<text x="70" y="${55 + i * 42}" fill="var(--text-mute)" font-size="12">${esc(p.label.slice(0, 4))}</text>
     <rect x="120" y="${38 + i * 42}" width="0" height="22" rx="4" fill="var(--accent)" id="bar${i}" style="transition:width 1.2s ease"/>
     <text x="400" y="${55 + i * 42}" fill="var(--accent)" font-size="12" font-weight="600" opacity="0" id="bv${i}" style="transition:opacity .3s">${p.value}</text>`,
    )
    .join("");
  return {
    title: "對比",
    subtitle: "長條",
    svg: `<svg viewBox="0 0 440 ${50 + points.length * 42}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`,
    script: scheduleScript(
      points.map((p, i) => ({
        delay: 400 + i * 300,
        code: `document.getElementById('bar${i}').style.width='${Math.round((p.value / max) * 260)}px';document.getElementById('bv${i}').style.opacity='1';`,
      })),
    ),
  };
}

function networkScene(nodes: string[], hub?: string): SceneParts {
  const cx = 280;
  const cy = 140;
  const n = nodes.length;
  const dots = nodes
    .map((node, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 100;
      const y = cy + Math.sin(a) * 90;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--accent)" stroke-width="2" opacity="0" id="e${i}" style="transition:opacity .4s"/>
      <circle cx="${x}" cy="${y}" r="18" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" opacity="0" id="n${i}" style="transition:opacity .4s"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" fill="var(--text)" font-size="10">${esc(node.slice(0, 3))}</text>`;
    })
    .join("");
  return {
    title: hub ?? "網路",
    subtitle: `${n} 節點`,
    svg: `<svg viewBox="0 0 560 280" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="24" fill="var(--accent)" opacity="0.9"/>
  ${dots}
</svg>`,
    script: scheduleScript(
      nodes.flatMap((_, i) => [
        { delay: 400 + i * 250, code: `document.getElementById('e${i}').style.opacity='1';` },
        { delay: 550 + i * 250, code: `document.getElementById('n${i}').style.opacity='1';` },
      ]),
    ),
  };
}

function funnelScene(stages: string[]): SceneParts {
  const blocks = stages
    .map((s, i) => {
      const w = 320 - i * 50;
      const x = (480 - w) / 2;
      return `<rect x="${x}" y="${40 + i * 52}" width="${w}" height="40" rx="6" fill="var(--accent)" opacity="0" id="st${i}" style="transition:opacity .5s"/>
      <text x="240" y="${68 + i * 52}" text-anchor="middle" fill="white" font-size="12">${esc(s.slice(0, 10))}</text>`;
    })
    .join("");
  return {
    title: "漏斗",
    subtitle: `${stages.length} 階`,
    svg: `<svg viewBox="0 0 480 ${60 + stages.length * 52}" xmlns="http://www.w3.org/2000/svg">${blocks}</svg>`,
    script: scheduleScript(stages.map((_, i) => ({ delay: 350 + i * 400, code: `document.getElementById('st${i}').style.opacity='${0.9 - i * 0.15}';` }))),
  };
}

function timelineYearScene(years: { year: number; label?: string }[]): SceneParts {
  const n = years.length;
  const gap = 380 / Math.max(1, n - 1);
  const nodes = years
    .map(
      (y, i) =>
        `<circle cx="${90 + i * gap}" cy="140" r="10" fill="var(--accent)" opacity="0.2" id="yr${i}" style="transition:opacity .5s,r .4s ease"/>
      <text x="${90 + i * gap}" y="175" text-anchor="middle" fill="var(--text-mute)" font-size="12" opacity="0.4" id="yt${i}" style="transition:opacity .5s">${y.year}</text>
      ${y.label ? `<text x="${90 + i * gap}" y="115" text-anchor="middle" fill="var(--text)" font-size="10" opacity="0" id="yl${i}" style="transition:opacity .4s">${esc(y.label.slice(0, 4))}</text>` : ""}`,
    )
    .join("");
  const lines = Array.from({ length: n - 1 }, (_, i) => {
    const x1 = 90 + i * gap;
    const x2 = 90 + (i + 1) * gap;
    return `<line x1="${x1}" y1="140" x2="${x2}" y2="140" stroke="var(--accent)" stroke-width="3" opacity="0" id="yln${i}" style="transition:opacity .4s"/>`;
  }).join("");
  const scriptSteps = years.flatMap((y, i) => [
    ...(i > 0 ? [{ delay: 350 + i * 450 - 150, code: `document.getElementById('yln${i - 1}').style.opacity='1';` }] : []),
    {
      delay: 350 + i * 450,
      code: `var c=document.getElementById('yr${i}');c.style.opacity='1';c.setAttribute('r','14');document.getElementById('yt${i}').style.opacity='1';${y.label ? `document.getElementById('yl${i}').style.opacity='1';` : ""}`,
    },
  ]);
  return {
    title: "年份軸",
    subtitle: `${years[0]!.year}–${years[n - 1]!.year}`,
    svg: `<svg viewBox="0 0 480 220" xmlns="http://www.w3.org/2000/svg">
  <line x1="70" y1="140" x2="410" y2="140" stroke="var(--text-mute)" stroke-width="2" opacity="0.35"/>
  ${lines}${nodes}
</svg>`,
    script: scheduleScript(scriptSteps),
  };
}

function vennOverlapScene(p: { leftLabel: string; rightLabel: string; overlapLabel?: string }): SceneParts {
  const overlap = esc(p.overlapLabel ?? "∩");
  return {
    title: "交集",
    subtitle: `${p.leftLabel} ∩ ${p.rightLabel}`,
    svg: `<svg viewBox="0 0 480 260" xmlns="http://www.w3.org/2000/svg">
  <circle cx="190" cy="130" r="72" fill="#2980b9" opacity="0" id="cL" style="transition:opacity .7s"/>
  <circle cx="290" cy="130" r="72" fill="#c0392b" opacity="0" id="cR" style="transition:opacity .7s"/>
  <ellipse cx="240" cy="130" rx="28" ry="60" fill="var(--accent)" opacity="0" id="overlap" style="transition:opacity .8s"/>
  <text x="150" y="135" text-anchor="middle" fill="white" font-size="14" font-weight="600" opacity="0" id="tL" style="transition:opacity .5s">${esc(p.leftLabel.slice(0, 4))}</text>
  <text x="330" y="135" text-anchor="middle" fill="white" font-size="14" font-weight="600" opacity="0" id="tR" style="transition:opacity .5s">${esc(p.rightLabel.slice(0, 4))}</text>
  <text x="240" y="136" text-anchor="middle" fill="white" font-size="13" font-weight="700" opacity="0" id="tO" style="transition:opacity .5s">${overlap}</text>
</svg>`,
    script: scheduleScript([
      { delay: 400, code: `document.getElementById('cL').style.opacity='0.55';document.getElementById('tL').style.opacity='1';` },
      { delay: 900, code: `document.getElementById('cR').style.opacity='0.55';document.getElementById('tR').style.opacity='1';` },
      { delay: 1500, code: `document.getElementById('overlap').style.opacity='0.85';document.getElementById('tO').style.opacity='1';` },
    ]),
  };
}

function beforeAfterSliderScene(p: {
  beforeLabel: string;
  afterLabel: string;
  sliderPosition: number;
}): SceneParts {
  const pos = Math.round(p.sliderPosition * 320 + 80);
  return {
    title: "對照",
    subtitle: `${p.beforeLabel} / ${p.afterLabel}`,
    svg: `<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg">
  <rect x="60" y="60" width="360" height="140" rx="10" fill="var(--text-mute)" opacity="0.15"/>
  <rect x="60" y="60" width="180" height="140" rx="10" fill="#95a5a6" opacity="0.5" id="beforePane"/>
  <rect x="240" y="60" width="180" height="140" rx="10" fill="var(--accent)" opacity="0" id="afterPane" style="transition:opacity .8s"/>
  <line x1="${pos}" y1="50" x2="${pos}" y2="210" stroke="var(--accent)" stroke-width="4" id="slider" style="transition:x1 .9s ease,x2 .9s ease"/>
  <circle cx="${pos}" cy="130" r="16" fill="var(--accent)" stroke="white" stroke-width="3" id="handle" style="transition:cx .9s ease"/>
  <text x="150" y="135" text-anchor="middle" fill="white" font-size="14" font-weight="600">${esc(p.beforeLabel.slice(0, 4))}</text>
  <text x="330" y="135" text-anchor="middle" fill="white" font-size="14" font-weight="600" opacity="0" id="afterTxt" style="transition:opacity .6s">${esc(p.afterLabel.slice(0, 4))}</text>
</svg>`,
    script: scheduleScript([
      { delay: 600, code: `var s=document.getElementById('slider'),h=document.getElementById('handle');s.setAttribute('x1','320');s.setAttribute('x2','320');h.setAttribute('cx','320');document.getElementById('afterPane').style.opacity='0.65';document.getElementById('afterTxt').style.opacity='1';` },
      { delay: 2200, code: `var s=document.getElementById('slider'),h=document.getElementById('handle');s.setAttribute('x1','180');s.setAttribute('x2','180');h.setAttribute('cx','180');` },
    ]),
  };
}

function equationBalanceScene(p: { leftExpr: string; rightExpr: string; balanced: boolean }): SceneParts {
  const tilt = p.balanced ? 0 : -10;
  return {
    title: "等式",
    subtitle: "=",
    svg: `<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg">
  <polygon points="240,50 120,190 360,190" fill="none" stroke="var(--text-mute)" stroke-width="3"/>
  <line x1="240" y1="50" x2="240" y2="190" stroke="var(--text-mute)" stroke-width="3"/>
  <g id="beam" style="transition:transform 1.1s ease;transform-origin:240px 190px;transform:rotate(${tilt}deg)">
    <line x1="100" y1="190" x2="380" y2="190" stroke="var(--accent)" stroke-width="5"/>
    <rect x="90" y="155" width="80" height="36" rx="6" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/>
    <rect x="310" y="155" width="80" height="36" rx="6" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/>
    <text x="130" y="178" text-anchor="middle" fill="var(--accent)" font-size="14" font-weight="700">${esc(p.leftExpr.slice(0, 8))}</text>
    <text x="350" y="178" text-anchor="middle" fill="var(--accent)" font-size="14" font-weight="700">${esc(p.rightExpr.slice(0, 8))}</text>
  </g>
  <text x="240" y="225" text-anchor="middle" fill="var(--text-mute)" font-size="22" font-weight="700" opacity="0" id="eqSign" style="transition:opacity .5s">=</text>
</svg>`,
    script: scheduleScript([
      { delay: 500, code: `document.getElementById('beam').style.transform='rotate(${tilt}deg)';` },
      { delay: 1200, code: `document.getElementById('eqSign').style.opacity='1';` },
      ...(p.balanced ? [{ delay: 1600, code: `document.getElementById('beam').style.transform='rotate(0deg)';` }] : []),
    ]),
  };
}

export function renderScene(config: ExplainAnimationConfig): SceneParts {
  switch (config.pattern) {
    case "percent_grow":
      return percentBarScene("成長", config.params, true);
    case "percent_shrink":
      return percentBarScene("縮減", config.params, false);
    case "amount_add":
      return amountDeltaScene("增加", config.params, true);
    case "amount_sub":
      return amountDeltaScene("減少", config.params, false);
    case "value_compare":
      return genericTwoCol("對照", `${config.params.leftLabel} ${config.params.left}`, `${config.params.rightLabel} ${config.params.right}`);
    case "counter_kpi": {
      const target = config.params.target;
      const unit = esc(config.params.unit);
      return {
        title: config.params.label,
        subtitle: config.params.unit,
        svg: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="120" text-anchor="middle" fill="var(--accent)" font-size="72" font-weight="800" id="kpi">0${unit}</text>
    </svg>`,
        script: scheduleScript([
          {
            delay: 400,
            code: `(function(){var el=document.getElementById('kpi'),from=0,to=${target},u='${unit}',t0=null,dur=1600;
function tick(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/dur),ease=1-Math.pow(1-p,3);
el.textContent=Math.round(from+(to-from)*ease)+u;if(p<1)requestAnimationFrame(tick);else el.textContent=to+u;}
requestAnimationFrame(tick);})();`,
          },
        ]),
      };
    }
    case "ratio_split": {
      const total = config.params.parts.reduce((s, p) => s + p.value, 0) || 1;
      let x = 60;
      const rects = config.params.parts
        .map((p, i) => {
          const w = Math.round((p.value / total) * 360);
          const el = `<rect x="${x}" y="100" width="0" height="80" fill="var(--accent)" opacity="${0.5 + i * 0.12}" id="rp${i}" style="transition:width .8s ease"/>
        <text x="${x + w / 2}" y="155" text-anchor="middle" fill="var(--text)" font-size="11">${esc(p.label.slice(0, 4))}</text>`;
          x += w + 4;
          return el;
        })
        .join("");
      return {
        title: "比例",
        subtitle: config.params.unit,
        svg: `<svg viewBox="0 0 480 220" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`,
        script: scheduleScript(
          config.params.parts.map((p, i) => {
            const w = Math.round((p.value / total) * 360);
            return { delay: 400 + i * 300, code: `document.getElementById('rp${i}').style.width='${w}px';` };
          }),
        ),
      };
    }
    case "multiplier": {
      const result = config.params.result ?? config.params.base * config.params.factor;
      return {
        title: `${config.params.factor}×`,
        subtitle: "倍數",
        svg: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
      <text x="120" y="120" fill="var(--text-mute)" font-size="36" id="b">${config.params.base}</text>
      <text x="200" y="120" fill="var(--accent)" font-size="36" font-weight="700">×${config.params.factor}</text>
      <text x="300" y="120" fill="var(--accent)" font-size="48" font-weight="800" opacity="0" id="res" style="transition:opacity .5s">${result}</text>
    </svg>`,
        script: scheduleScript([{ delay: 700, code: `document.getElementById('res').style.opacity='1';` + counterScript("res", config.params.base, result) }]),
      };
    }
    case "journey_a_to_b":
      return journeyScene(config.params);
    case "process_flow":
      return flowStepsScene(config.params.steps);
    case "funnel_narrow":
      return funnelScene(config.params.stages);
    case "milestone_path":
      return flowStepsScene(config.params.points.map((p) => p.label));
    case "balance_seesaw":
      return balanceScene(config.params);
    case "split_contrast":
      return genericTwoCol("對比", config.params.leftTitle, config.params.rightTitle);
    case "scale_compare":
      return {
        title: "秤量",
        subtitle: "",
        svg: `<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg">
      <line x1="240" y1="60" x2="240" y2="180" stroke="var(--text-mute)" stroke-width="3"/>
      <line x1="100" y1="180" x2="380" y2="180" stroke="var(--accent)" stroke-width="4" id="scale" style="transition:transform 1s ease;transform-origin:240px 180px;transform:rotate(${config.params.leftWeight > config.params.rightWeight ? -8 : 8}deg)"/>
      <circle cx="100" cy="180" r="${18 + config.params.leftWeight / 5}" fill="#c0392b" opacity="0.8"/>
      <circle cx="380" cy="180" r="${18 + config.params.rightWeight / 5}" fill="#2980b9" opacity="0.8"/>
      <text x="100" y="220" text-anchor="middle" font-size="12">${esc(config.params.leftLabel)}</text>
      <text x="380" y="220" text-anchor="middle" font-size="12">${esc(config.params.rightLabel)}</text>
    </svg>`,
        script: scheduleScript([{ delay: 600, code: `document.getElementById('scale').style.transform='rotate(0deg)';` }]),
      };
    case "spectrum_slider":
      return {
        title: "光譜",
        subtitle: "",
        svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg">
      <line x1="60" y1="60" x2="420" y2="60" stroke="var(--text-mute)" stroke-width="4"/>
      <circle cx="${60 + config.params.position * 360}" cy="60" r="14" fill="var(--accent)" id="knob" style="transition:cx 1s ease"/>
      <text x="60" y="95" font-size="11">${esc(config.params.leftLabel)}</text>
      <text x="420" y="95" text-anchor="end" font-size="11">${esc(config.params.rightLabel)}</text>
    </svg>`,
        script: "",
      };
    case "parts_merge":
      return partsScene(config.params.count, true);
    case "parts_split":
      return partsScene(config.params.count, false);
    case "layer_stack":
      return listScene("層疊", config.params.layers, "stagger");
    case "cluster_group":
      return networkScene(config.params.items);
    case "sparkline_up":
      return sparklineScene(config.params.points, config.params.unit);
    case "bars_race":
      return barsRaceScene(config.params.points);
    case "arc_progress":
      return arcScene(config.params.percent, config.params.label);
    case "pulse_highlight":
      return emphasisScene(config.params.text, config.params.sub, "pulse");
    case "ring_focus":
      return emphasisScene(config.params.text, config.params.sub, "ring");
    case "check_complete":
      return emphasisScene(config.params.text, config.params.sub, "check");
    case "badge_unlock":
      return emphasisScene(config.params.text, config.params.sub, "badge");
    case "bridge_link":
      return journeyScene({ fromLabel: config.params.leftLabel, toLabel: config.params.rightLabel });
    case "gap_close":
      return {
        title: "縮短差距",
        subtitle: "",
        svg: `<svg viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="30" fill="var(--text-mute)" opacity="0.5"/>
      <circle cx="380" cy="100" r="30" fill="var(--accent)" opacity="0.5"/>
      <line x1="130" y1="100" x2="350" y2="100" stroke="var(--accent)" stroke-width="4" stroke-dasharray="8" id="gap" style="transition:stroke-dashoffset 1.2s ease" stroke-dashoffset="0"/>
      <text x="100" y="150" text-anchor="middle" font-size="11">${esc(config.params.fromLabel)}</text>
      <text x="380" y="150" text-anchor="middle" font-size="11">${esc(config.params.toLabel)}</text>
    </svg>`,
        script: scheduleScript([{ delay: 500, code: `document.getElementById('gap').style.strokeDashoffset='${config.params.distance}';` }]),
      };
    case "network_nodes":
      return networkScene(config.params.nodes, config.params.hub);
    case "stagger_reveal":
      return listScene("揭示", config.params.items, "stagger");
    case "checklist_ticks":
      return listScene("清單", config.params.items, "check");
    case "priority_rank":
      return listScene("排序", config.params.items.map((i) => i.label), "rank");
    case "timeline_year":
      return timelineYearScene(config.params.years);
    case "venn_overlap":
      return vennOverlapScene(config.params);
    case "before_after_slider":
      return beforeAfterSliderScene(config.params);
    case "equation_balance":
      return equationBalanceScene(config.params);
    default: {
      const _exhaustive: never = config;
      return emphasisScene("演示", undefined, "pulse");
    }
  }
}
