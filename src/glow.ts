/** Replacing eligibility trace: every other pair decays, the chosen pair is 1. */
export function updateGlowValue(value: number, eta: number, selected = false): number {
  if (selected) return 1;
  const decay = Number.isFinite(eta) ? Math.max(0, Math.min(1, eta)) : 0;
  const previous = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (1 - decay) * previous;
}
