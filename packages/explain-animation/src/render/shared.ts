export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SceneParts = {
  title: string;
  subtitle: string;
  svg: string;
  script: string;
};

/** 數字滾動腳本（requestAnimationFrame） */
export function counterScript(id: string, from: number, to: number, ms = 1600): string {
  return `
(function(){
  var el=document.getElementById(${JSON.stringify(id)});
  if(!el) return;
  var from=${from}, to=${to}, t0=null, dur=${ms};
  function tick(ts){
    if(!t0) t0=ts;
    var p=Math.min(1,(ts-t0)/dur);
    var ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*ease);
    if(p<1) requestAnimationFrame(tick);
    else el.textContent=to;
  }
  requestAnimationFrame(tick);
})();`;
}

/** 依延遲排程 DOM 操作 */
export function scheduleScript(steps: { delay: number; code: string }[]): string {
  const body = steps
    .map(
      (s) => `setTimeout(function(){
${s.code}
}, ${s.delay});`,
    )
    .join("\n");
  return `(function(){ ${body} })();`;
}

export function barHeight(value: number, max: number, base = 200): number {
  return Math.max(12, Math.round((value / Math.max(1, max)) * base));
}
