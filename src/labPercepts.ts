import { CELL_OBJECTS, perceptColor } from "./academyGraphics";
import { PSLayer } from "./psMemory";

export type LabPercepts = {
  colors: string[][];
  objects: string[][];
  useColors: boolean;
  useObjects: boolean;
  keyAwareness: boolean;
};

export const LAB_COLORS = ["#bcebd4", "#c8dcff", "#ffe0a3", "#d9ccff", "#efaaaa", "#a6e1c4", "#afccf8", "#f4cc83"];
export const LAB_OBJECTS = CELL_OBJECTS.filter((object) => !["⌚", "🔑", "🔍", "🧵"].includes(object));

export function makeLabPercepts(width: number, height: number, level: number): LabPercepts {
  const colors = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    level === 2 ? ((x === 0 && y > 0) || y === height - 1 ? LAB_COLORS[1]
      : (x === 1 || x === 2) && (y === 1 || y === 2) ? LAB_COLORS[4]
      : LAB_COLORS[2]) : perceptColor(x, y),
  ));
  const objects = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => LAB_OBJECTS[(y * width + x) % LAB_OBJECTS.length]));
  return { colors, objects, useColors: true, useObjects: level !== 2, keyAwareness: level >= 3 };
}

export function perceptObject(percepts: LabPercepts, grid: string[][], x: number, y: number): string {
  const cell = grid[y]?.[x] ?? "empty";
  if (cell === "goal") return "⌚";
  if (cell.startsWith("key-")) return "🔑";
  if (cell.startsWith("door-")) return "🚪";
  if (cell === "trap") return "🧨";
  return percepts.objects[y]?.[x] ?? "";
}

export function perceptId(percepts: LabPercepts, grid: string[][], x: number, y: number, keys = 0): string {
  return `${percepts.useColors ? percepts.colors[y]?.[x] ?? "" : ""}|${percepts.useObjects ? perceptObject(percepts, grid, x, y) : ""}|${percepts.keyAwareness ? Number(keys !== 0) : ""}`;
}

export function makeLabMemory(grid: string[][], percepts: LabPercepts): PSLayer {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const slots = new Map<string, number>();
  for (let keys = 0; keys <= (percepts.keyAwareness ? 1 : 0); keys++) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const id = perceptId(percepts, grid, x, y, keys);
      if (!slots.has(id)) slots.set(id, slots.size);
    }
  }
  return new PSLayer(width, height, (x, y, keys) => slots.get(perceptId(percepts, grid, x, y, keys)) ?? 0, slots.size);
}

export function makeLevelTwoComparisonMemory(grid: string[][], percepts: LabPercepts): PSLayer {
  const memory = makeLabMemory(grid, percepts);
  const initialized = new Set<string>();
  grid.forEach((row, y) => row.forEach((cell, x) => {
    if (cell === "wall") return;
    const id = perceptId(percepts, grid, x, y);
    if (initialized.has(id)) return;
    initialized.add(id);
    const color = percepts.colors[y][x];
    // Small deterministic offsets keep all actions available in Explore and
    // Balance, while Exploit has one route: up the blue column, then right.
    const values = color === LAB_COLORS[1]
      ? [2.8, 1.15, 0.92, 1.0]
      : color === LAB_COLORS[2]
        ? [2.05, 2.45, 0.94, 1.02]
        : [2.35, 1.75, 0.97, 1.03];
    values.forEach((value, action) => { memory.hvals[memory.idx(x, y, action)] = value; });
  }));
  return memory;
}

export function replacePerceptValue(percepts: LabPercepts, kind: "colors" | "objects", oldValue: string, replacement: string): LabPercepts {
  return { ...percepts, [kind]: percepts[kind].map((row) => row.map((value) => value === oldValue ? replacement : value)) };
}
