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

// Probability of reaching a target within the shortest route plus a small
// allowance. Blocked actions consume a step and leave the agent in place.
export function timelyPathProbability(
  grid: string[][],
  start: Position,
  weightsAt: (x: number, y: number, keys: number) => number[],
  greediness: number,
  target = "goal",
  tolerance = 0,
  initialKeys = 0,
): PathAssessment {
  const id = (state: State) => `${state.x},${state.y},${state.keys}`;
  const move = (state: State, direction: Position): State | null => {
    const x = state.x + direction.x;
    const y = state.y + direction.y;
    const cell = grid[y]?.[x];
    if (!cell || cell === "wall" || cell.startsWith("door-") && cell.endsWith("-closed") && !(state.keys & (1 << KEY_COLORS.indexOf(cell.split("-")[1])))) return { ...state };
    if (cell === "trap") return null;
    let keys = state.keys;
    if (cell.startsWith("key-")) {
      const bit = KEY_COLORS.indexOf(cell.slice(4));
      if (bit >= 0) keys |= 1 << bit;
    }
    return { x, y, keys };
  };
  const initial: State = { ...start, keys: initialKeys };
  if (grid[initial.y]?.[initial.x] === target) return { minimumSteps: 0, probability: 1 };
  const queue: Array<{ state: State; steps: number }> = [{ state: initial, steps: 0 }];
  const seen = new Set([id(initial)]);
  let minimumSteps: number | null = null;
  for (let index = 0; index < queue.length; index++) {
    const { state, steps } = queue[index];
    if (grid[state.y]?.[state.x] === target) { minimumSteps = steps; break; }
    DIRECTIONS.forEach((direction) => {
      const next = move(state, direction);
      if (!next || id(next) === id(state) || seen.has(id(next))) return;
      seen.add(id(next));
      queue.push({ state: next, steps: steps + 1 });
    });
  }
  if (minimumSteps === null) return { minimumSteps: null, probability: 0 };

  const states = new Map([[id(initial), initial]]);
  let masses = new Map([[id(initial), 1]]);
  let probability = 0;
  for (let step = 1; step <= minimumSteps + Math.max(0, tolerance); step++) {
    const nextMasses = new Map<string, number>();
    masses.forEach((mass, stateId) => {
      const state = states.get(stateId)!;
      const policy = labPolicy(weightsAt(state.x, state.y, state.keys), greediness);
      DIRECTIONS.forEach((direction, action) => {
        const next = move(state, direction);
        if (!next) return;
        const share = mass * (policy[action] ?? 0);
        if (grid[next.y]?.[next.x] === target) { probability += share; return; }
        if (grid[next.y]?.[next.x] === "goal") return;
        const nextId = id(next);
        states.set(nextId, next);
        nextMasses.set(nextId, (nextMasses.get(nextId) ?? 0) + share);
      });
    });
    masses = nextMasses;
  }
  return { minimumSteps, probability: Math.min(1, Math.max(0, probability)) };
}
