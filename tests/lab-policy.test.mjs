import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

// Load the pure TypeScript modules without changing the app’s build setup.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString("base64")}`;
const policyUrl = moduleUrl(readFileSync(new URL("../src/labPolicy.ts", import.meta.url), "utf8"));
const { labPolicy } = await import(policyUrl);
const { shortestPathProbability } = await import(moduleUrl(readFileSync(new URL("../src/shortestPathProbability.ts", import.meta.url), "utf8")
  .replace('"./labPolicy"', JSON.stringify(policyUrl))));
const uniform = () => [1, 1, 1, 1];
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);

test("inverse temperature alone controls exploration and favors stronger weights", () => {
  assert.deepEqual(labPolicy([1, 9, 2, 3], 0), [.25, .25, .25, .25]);
  assert(labPolicy([1, 3, 1, 1], 2)[1] > labPolicy([1, 3, 1, 1], 1)[1]);
  close(labPolicy([10000, 9999, 0, 0], 5).reduce((sum, p) => sum + p, 0), 1);
  assert.deepEqual(labPolicy([], 1), []);
});

test("all shortest routes count, not just one route or blocked actions", () => {
  const grid = [["empty", "goal"], ["start", "empty"]];
  const assessment = shortestPathProbability(grid, { x: 0, y: 1 }, uniform, 1);
  assert.equal(assessment.minimumSteps, 2);
  close(assessment.probability, 2 / 16);
  const strong = (x, y) => x === 0 && y === 1 ? [10, 10, 0, 0] : x === 0 ? [0, 10, 0, 0] : [10, 0, 0, 0];
  assert(shortestPathProbability(grid, { x: 0, y: 1 }, strong, 5).probability >= .75);
});

test("walls and terminal traps exclude routes, and unreachable targets cannot qualify", () => {
  for (const obstacle of ["wall", "trap"]) {
    const assessment = shortestPathProbability([[obstacle, "goal"], ["start", "empty"]], { x: 0, y: 1 }, uniform, 1);
    assert.equal(assessment.minimumSteps, 2);
    close(assessment.probability, 1 / 16);
  }
  assert.deepEqual(shortestPathProbability([["start", "wall", "goal"]], { x: 0, y: 0 }, uniform, 1), { minimumSteps: null, probability: 0 });
});

test("keys are carried through the route and must match closed doors", () => {
  const grid = [["start", "key-blue", "door-blue-closed", "goal"]];
  const result = shortestPathProbability(grid, { x: 0, y: 0 }, uniform, 1);
  assert.equal(result.minimumSteps, 3);
  close(result.probability, 1 / 64);
  grid[0][1] = "key-red";
  assert.equal(shortestPathProbability(grid, { x: 0, y: 0 }, uniform, 1).minimumSteps, null);
});

test("a shortest route may revisit a position after collecting a key", () => {
  const grid = [["key-blue", "wall", "wall"], ["start", "door-blue-closed", "goal"]];
  const result = shortestPathProbability(grid, { x: 0, y: 1 }, uniform, 1);
  assert.equal(result.minimumSteps, 4);
  close(result.probability, 1 / 256);
});

test("multiple doors, open doors, and irrelevant keys follow the simulator’s rules", () => {
  const grid = [["start", "key-red", "door-red-closed", "key-green", "door-green-closed", "door-blue-open", "goal"]];
  const result = shortestPathProbability(grid, { x: 0, y: 0 }, uniform, 1);
  assert.equal(result.minimumSteps, 6);
  close(result.probability, 1 / 4096);
  assert.equal(shortestPathProbability([["start", "goal", "key-blue"]], { x: 0, y: 0 }, uniform, 1).minimumSteps, 1);
});
