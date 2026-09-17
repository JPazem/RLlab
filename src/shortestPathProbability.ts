import { labPolicy } from "./labPolicy";

type Position = { x: number; y: number };
type State = Position & { keys: number };
export type PathAssessment = { minimumSteps: number | null; probability: number };
const DIRECTIONS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const KEY_COLORS = ["blue", "red", "green"];

// Breadth-first search over position AND collected keys. Only shortest arrivals
// propagate probability; blocked actions, traps and longer detours cannot qualify.
// Equal-length arrivals are summed, so every shortest successful route counts.
export function shortestPathProbability(
  grid: string[][],
  start: Position,
  weightsAt: (x: number, y: number) => number[],
  greediness: number,
): PathAssessment {
  const stateId = ({ x, y, keys }: State) => `${x},${y},${keys}`;
  const initial: State = { ...start, keys: 0 };
  const distances = new Map([[stateId(initial), 0]]);
  const masses = new Map([[stateId(initial), 1]]);
  const queue = [initial];
  let minimumSteps: number | null = null;
  let probability = 0;

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const id = stateId(current);
    const distance = distances.get(id)!;
    if (minimumSteps !== null && distance > minimumSteps) break;
    const mass = masses.get(id)!;
    if (grid[current.y]?.[current.x] === "goal") {
      minimumSteps = distance;
      probability += mass;
      continue;
    }
    if (minimumSteps !== null) continue;
    const policy = labPolicy(weightsAt(current.x, current.y), greediness);
    DIRECTIONS.forEach((direction, action) => {
      const next: State = { x: current.x + direction.x, y: current.y + direction.y, keys: current.keys };
      const cell = grid[next.y]?.[next.x];
      if (!cell || cell === "wall" || cell === "trap") return;
      if (cell.startsWith("door-") && cell.endsWith("-closed")) {
        const bit = KEY_COLORS.indexOf(cell.split("-")[1]);
        if (bit < 0 || !(next.keys & (1 << bit))) return;
      }
      if (cell.startsWith("key-")) {
        const bit = KEY_COLORS.indexOf(cell.slice(4));
        if (bit >= 0) next.keys |= 1 << bit;
      }
      const nextId = stateId(next);
      const nextDistance = distance + 1;
      if (!distances.has(nextId)) {
        distances.set(nextId, nextDistance);
        masses.set(nextId, 0);
        queue.push(next);
      }
      if (distances.get(nextId) === nextDistance) {
        masses.set(nextId, masses.get(nextId)! + mass * (policy[action] ?? 0));
      }
    });
  }
  return { minimumSteps, probability: Math.min(1, Math.max(0, probability)) };
}
