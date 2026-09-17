import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString("base64")}`;
const glowUrl = moduleUrl(readFileSync(new URL("../src/glow.ts", import.meta.url), "utf8"));
const { updateGlowValue } = await import(glowUrl);
const { PSLayer } = await import(moduleUrl(readFileSync(new URL("../src/psMemory.ts", import.meta.url), "utf8").replace('"./glow"', JSON.stringify(glowUrl))));
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

test("selected glow replaces the old value with 1, including repeated choices", () => {
  const memory = new PSLayer(2, 2);
  for (let i = 0; i < 20; i++) memory.updateGlow(0, 0, 1, .1);
  assert.equal(memory.getG(0, 0, 1), 1);
  assert(memory.gvals.every((value) => value >= 0 && value <= 1));
});

test("all unselected pairs decay, even when they share the percept or action", () => {
  const memory = new PSLayer(2, 2);
  memory.gvals.fill(1);
  memory.updateGlow(0, 0, 1, .1);
  assert.equal(memory.getG(0, 0, 1), 1);
  close(memory.getG(0, 0, 0), .9);
  close(memory.getG(1, 0, 1), .9);
  close(memory.getG(1, 1, 2), .9);
  memory.updateGlow(1, 1, 2, .1);
  close(memory.getG(0, 0, 1), .9);
  close(memory.getG(0, 0, 0), .81);
  assert.equal(memory.getG(1, 1, 2), 1);
});

test("shared Adventure/Lab glow rule handles zero and full decay and enforces bounds", () => {
  assert.equal(updateGlowValue(.7, 0), .7);
  assert.equal(updateGlowValue(.7, 1), 0);
  assert.equal(updateGlowValue(9, .1), .9);
  assert.equal(updateGlowValue(-1, .1), 0);
  assert.equal(updateGlowValue(NaN, .1), 0);
  assert.equal(updateGlowValue(.2, 1, true), 1);
});

test("reward uses the replaced glow and display snapshots stay frozen during hidden steps", () => {
  const memory = new PSLayer(2, 2);
  memory.updateGlow(0, 0, 0, .1);
  memory.updateGlow(0, 0, 0, .1);
  const snapshot = memory.copy();
  memory.rewardUpdate(2, .01, 1);
  assert.equal(memory.getH(0, 0, 0), 3);
  memory.updateGlow(1, 1, 2, .1);
  assert.equal(snapshot.getG(0, 0, 0), 1);
  assert.equal(snapshot.getH(0, 0, 0), 1);
  assert.equal(snapshot.getG(1, 1, 2), 0);
  memory.gvals[0] = 5;
  memory.normalize();
  assert.equal(memory.gvals[0], 1);
});
