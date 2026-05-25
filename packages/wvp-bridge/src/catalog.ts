export const ENTER_ANIMATIONS = [
  { id: "fade-up", label: "淡入上移", cssClass: "anim-fade-up" },
  { id: "fade-in", label: "淡入", cssClass: "anim-fade-in" },
  { id: "scale-in", label: "縮放進入", cssClass: "anim-scale-in" },
  { id: "slide-left", label: "左滑進入", cssClass: "anim-slide-left" },
  { id: "blur-in", label: "模糊清晰", cssClass: "anim-blur-in" },
] as const;

export const TRANSITIONS = [
  { id: "crossfade", label: "交叉淡化", hfId: "crossfade" },
  { id: "wipe-right", label: "向右擦除", hfId: "wipe-right" },
  { id: "push-left", label: "向左推移", hfId: "push-left" },
  { id: "cover", label: "色塊覆蓋", hfId: "cover" },
] as const;

export function getEnterAnimation(id: string) {
  return ENTER_ANIMATIONS.find((a) => a.id === id) ?? ENTER_ANIMATIONS[0];
}

export function getTransition(id: string) {
  return TRANSITIONS.find((t) => t.id === id) ?? TRANSITIONS[0];
}
