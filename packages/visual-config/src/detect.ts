/** 步驟是否適合嵌入宣告式視覺（chart / table / animation） */
export function shouldStepHaveVisual(script: string, screenContent: string): boolean {
  const blob = `${script}\n${screenContent}`.trim();
  if (blob.length < 10) return false;
  if (/\d+(?:\.\d+)?\s*(%|億|萬|万|倍|人|元)?/.test(blob)) return true;
  if (/(?:第一|第二|第三|其一|其二)/.test(blob) && blob.length >= 20) return true;
  if (/(?:對照|相比|占比|比例|成長|下降|趨勢)/.test(blob)) return true;
  return false;
}
