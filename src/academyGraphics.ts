export const CELL_OBJECTS = [
  "💡", "📕", "🧸", "🌸", "⌚",
  "🔑", "🪁", "🧲", "🍎", "🎨",
  "📚", "🌱", "🧵", "🔍", "🎀",
  "🎸", "🧭", "☂️", "💎", "🧺",
  "🎒", "🍒", "🔔", "✏️", "🌻",
];

export function perceptColor(x: number, y: number) {
  const colors = ["#bcebd4", "#c8dcff", "#ffe0a3", "#d9ccff", "#ffc8d0"];
  return colors[(x + y * 2) % colors.length];
}
