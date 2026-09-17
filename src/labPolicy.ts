// Inverse temperature is the only exploration control: zero gives a uniform policy.
export function labPolicy(weights: number[], greediness: number): number[] {
  if (!weights.length) return [];
  const safeWeights = weights.map((weight) => Number.isFinite(weight) ? weight : 0);
  const maximum = Math.max(...safeWeights);
  const beta = Number.isFinite(greediness) ? Math.max(0, greediness) : 1;
  const exponentials = safeWeights.map((weight) => Math.exp((weight - maximum) * beta));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => total > 0 && Number.isFinite(total) ? value / total : 1 / weights.length);
}
