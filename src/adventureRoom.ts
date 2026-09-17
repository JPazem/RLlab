import { CELL_OBJECTS } from "./academyGraphics";

export type Point = { x: number; y: number };
export type Action = "up" | "right" | "down" | "left";

// An irregular, connected tree: bends and dead ends, but no alternative route
// to the watch. Gaps are not percepts and cannot be entered.
export const ROOM_LAYOUT = [
  "##...W",
  "##.#.#",
  "...###",
  ".#####",
  "S....#",
];
export const ROOM_WIDTH = ROOM_LAYOUT[0].length;
export const ROOM_HEIGHT = ROOM_LAYOUT.length;
export const ROOM_CELLS: Point[] = ROOM_LAYOUT.flatMap((row, y) =>
  [...row].flatMap((cell, x) => cell === "#" ? [] : [{ x, y }]),
);

function marker(symbol: string): Point {
  const point = ROOM_CELLS.find(({ x, y }) => ROOM_LAYOUT[y][x] === symbol);
  if (!point) throw new Error(`Missing adventure room marker: ${symbol}`);
  return point;
}

export const START = marker("S");
export const WATCH = marker("W");

export function isRoomCell({ x, y }: Point): boolean {
  return x >= 0 && y >= 0 && x < ROOM_WIDTH && y < ROOM_HEIGHT && ROOM_LAYOUT[y][x] !== "#";
}

export function move(point: Point, action: Action): Point {
  const next = { ...point };
  if (action === "up") next.y -= 1;
  if (action === "right") next.x += 1;
  if (action === "down") next.y += 1;
  if (action === "left") next.x -= 1;
  return isRoomCell(next) ? next : { ...point };
}

// Three shades of each Academy pastel family give every percept its own color.
const colors = [
  "#bcebd4", "#c8dcff", "#ffe0a3", "#d9ccff", "#ffc8d0",
  "#a6e1c4", "#afccf8", "#f4cc83", "#c3b3ed", "#efafb9",
  "#d3f1e1", "#dae7ff", "#ffebc6", "#e8deff", "#ffdde2",
];
const objects = CELL_OBJECTS.filter((object) => !["⌚", "🔍", "🧵"].includes(object));
export function roomPercept(point: Point) {
  const index = ROOM_CELLS.findIndex(({ x, y }) => x === point.x && y === point.y);
  const start = point.x === START.x && point.y === START.y;
  const nextToStart = point.x === START.x + 1 && point.y === START.y;
  return {
    color: colors[index],
    colorFamily: index % 5,
    object: point.x === WATCH.x && point.y === WATCH.y ? "⌚" : start ? "🔍" : nextToStart ? "🧵" : objects[index % objects.length],
  };
}

export function initialRoomWeights(point: Point): number[] {
  // Encourage Nova to return from the four-cell dead end, without hiding actions.
  return point.y === START.y && point.x > START.x
    ? [2.4, 1, 1, 2.4]
    : [2.4, 2.4, 1, 1];
}

function findRoute(): Point[] {
  const queue: Point[][] = [[START]];
  const visited = new Set([`${START.x},${START.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const route = queue[index];
    const point = route[route.length - 1];
    if (point.x === WATCH.x && point.y === WATCH.y) return route;
    for (const action of ["up", "right", "down", "left"] as Action[]) {
      const next = move(point, action);
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push([...route, next]);
    }
  }
  throw new Error("The adventure watch is unreachable");
}

export const WATCH_ROUTE = findRoute();

// Visit side branches before finding the watch, revealing every percept in Lesson 2.
function guidedTrip(): Point[] {
  const route = [START];
  const key = (point: Point) => `${point.x},${point.y}`;
  const seen = new Set(WATCH_ROUTE.map(key));
  function explore(point: Point) {
    seen.add(key(point));
    route.push(point);
    for (const action of ["up", "right", "down", "left"] as Action[]) {
      const next = move(point, action);
      if (seen.has(key(next))) continue;
      explore(next);
      route.push(point);
    }
  }
  WATCH_ROUTE.forEach((point, index) => {
    for (const action of ["up", "right", "down", "left"] as Action[]) {
      const next = move(point, action);
      if (seen.has(key(next))) continue;
      explore(next);
      route.push(point);
    }
    if (index + 1 < WATCH_ROUTE.length) route.push(WATCH_ROUTE[index + 1]);
  });
  return route;
}

export const GUIDE_ROUTE = guidedTrip();
export const GUIDE_ACTIONS: Action[] = GUIDE_ROUTE.slice(1).map((point, index) => {
  const previous = GUIDE_ROUTE[index];
  return point.x > previous.x ? "right" : point.x < previous.x ? "left" : point.y > previous.y ? "down" : "up";
});
