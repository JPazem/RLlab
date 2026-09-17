import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/logParameterScale.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parameterToSlider, sliderToParameter, LOG_PARAMETER_MARKS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("log sliders have exact zero, a minimum positive value, and a 0.3 endpoint", () => {
  assert.equal(parameterToSlider(0), 0);
  assert.equal(sliderToParameter(0), 0);
  assert.equal(sliderToParameter(1), 1e-4);
  assert.equal(sliderToParameter(80), 1e-4);
  assert(Math.abs(sliderToParameter(1000) - .3) < 1e-12);
  assert.equal(sliderToParameter(-10), 0);
  assert.equal(sliderToParameter(NaN), 0);
});

test("positive slider values are monotonic, bounded, and round-trip through the mapping", () => {
  let previous = 0;
  for (let position = 1; position <= 1000; position++) {
    const value = sliderToParameter(position);
    assert(value >= 1e-4 && value <= .3 && value >= previous);
    if (position >= 80) assert(Math.abs(parameterToSlider(value) - position) < 1e-9);
    previous = value;
  }
});

test("decade marks are evenly spaced on the positive logarithmic scale", () => {
  const decades = LOG_PARAMETER_MARKS.filter(({ value }) => [0.0001, 0.001, 0.01, 0.1].includes(value));
  const distances = decades.slice(1).map(({ value }, index) => parameterToSlider(value) - parameterToSlider(decades[index].value));
  assert(distances.every((distance) => Math.abs(distance - distances[0]) < 1e-10));
});
