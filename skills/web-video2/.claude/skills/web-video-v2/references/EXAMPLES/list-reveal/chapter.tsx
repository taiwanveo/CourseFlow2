// ⚠️ 這是 anchor 參考程式碼，不會被任何專案編譯。
//    抄到真實專案時（presentation/src/chapters/NN-list/），
//    把下面兩個 import 改成：
//      import { MaskReveal } from "../../components/MaskReveal";
//      import type { ChapterStepProps } from "../../registry/types";
import { MaskReveal } from "../../../templates/src/components/MaskReveal";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
import "./chapter.css";

/**
 * list-reveal · 完整章節示例
 * ─────────────────────────────────────────
 * 預設綁 newsroom 主題。
 *
 * 關鍵手段：
 * - 槽位用 hero-num（serif 巨號）替代普通文字編號
 * - 引子用 masthead 雙線規則 + serif 大字
 * - 槽位狀態切換有專屬動畫：
 *     ghost  → active：mask reveal 標題 + 數字砸下（accent 紅）
 *     active → past   ：accent 灰化（filter）
 * - 關鍵：所有槽位的 React 節點位置不重排，只切換 className
 */
const ITEMS = [
  { num: "01", title: "文字渲染", body: "圖裡的文字也能正確寫出來" },
  { num: "02", title: "指令遵循", body: "可以給到非常具體的要求" },
  { num: "03", title: "照片真實感", body: "光影 / 材質 / 人物接近真實" },
];

export default function ListRevealChapter({ step }: ChapterStepProps) {
  // step 1 — 引子
  if (step === 0) {
    return (
      <div className="lr-scene scene-pad lr-intro">
        <header className="lr-masthead">
          <span className="lr-rule" />
          <span className="lr-kicker">第一部分</span>
          <span className="lr-rule" />
        </header>
        <MaskReveal show duration={1100}>
          <h1 className="lr-intro-h">
            強在<span className="lr-em">哪</span>
          </h1>
        </MaskReveal>
        <MaskReveal show delay={400} duration={900}>
          <div className="lr-intro-sub">三件事 —— 一個個看</div>
        </MaskReveal>

        <div className="lr-grid">
          {ITEMS.map((it) => (
            <Slot key={it.num} state="ghost" item={it} />
          ))}
        </div>
      </div>
    );
  }

  const activeIdx = step - 1;
  return (
    <div className="lr-scene scene-pad">
      <header className="lr-masthead">
        <span className="lr-rule" />
        <span className="lr-kicker">第一部分 · 強在哪</span>
        <span className="lr-rule" />
      </header>

      <div className="lr-grid">
        {ITEMS.map((it, i) => {
          const state =
            i < activeIdx ? "past" : i === activeIdx ? "active" : "ghost";
          return <Slot key={it.num} state={state} item={it} />;
        })}
      </div>
    </div>
  );
}

function Slot({
  state,
  item,
}: {
  state: "ghost" | "active" | "past";
  item: { num: string; title: string; body: string };
}) {
  return (
    <div className={`lr-slot lr-slot-${state}`}>
      <div className="lr-slot-num">{item.num}</div>
      <div className="lr-slot-content">
        {state !== "ghost" && (
          <>
            <MaskReveal show duration={900} key={`${item.num}-title`}>
              <div className="lr-slot-title">{item.title}</div>
            </MaskReveal>
            {state === "active" && (
              <MaskReveal show delay={350} duration={900}>
                <div className="lr-slot-body">{item.body}</div>
              </MaskReveal>
            )}
          </>
        )}
      </div>
    </div>
  );
}
