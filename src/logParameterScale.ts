// Reserve a small gap for exact zero; positive values span logarithmic decades.
export const LOG_PARAMETER_MIN = 1e-4;
export const LOG_PARAMETER_MAX = 0.3;
export const LOG_SLIDER_MAX = 1000;
const POSITIVE_START = 80;
const LOG_RANGE = Math.log10(LOG_PARAMETER_MAX / LOG_PARAMETER_MIN);

export function parameterToSlider(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const bounded = Math.min(LOG_PARAMETER_MAX, Math.max(LOG_PARAMETER_MIN, value));
  return POSITIVE_START + (LOG_SLIDER_MAX - POSITIVE_START) * Math.log10(bounded / LOG_PARAMETER_MIN) / LOG_RANGE;
}

export function sliderToParameter(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  const bounded = Math.min(LOG_SLIDER_MAX, Math.max(POSITIVE_START, position));
  return Math.min(LOG_PARAMETER_MAX, LOG_PARAMETER_MIN * 10 ** ((bounded - POSITIVE_START) / (LOG_SLIDER_MAX - POSITIVE_START) * LOG_RANGE));
}

export const LOG_PARAMETER_MARKS = [
  { value: 0, label: "0" },
  { value: 0.0001, label: "0.0001" },
  { value: 0.0003, label: "0.0003" },
  { value: 0.001, label: "0.001" },
  { value: 0.003, label: "0.003" },
  { value: 0.01, label: "0.01" },
  { value: 0.03, label: "0.03" },
  { value: 0.1, label: "0.1" },
  { value: LOG_PARAMETER_MAX, label: "0.3" },
];
