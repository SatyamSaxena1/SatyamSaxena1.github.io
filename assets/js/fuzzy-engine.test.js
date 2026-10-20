// Parity check: fuzzy-engine.js against scikit-fuzzy 0.5 running the 2023 notebook.  Run: node assets/js/fuzzy-engine.test.js
const assert = require("assert"), E = require("./fuzzy-engine.js");
// [road, traffic, gap, skfuzzy output, or null when no rule fires (skfuzzy raises KeyError: 'speed_limit')]
const REF = [[5, 5, 5, 50.0], [10, 0, 10, 83.3333], [10, 5, 5, 83.3333], [0, 10, 0, 16.6667], [7.5, 2.5, 9, 62.971],
  [10, 10, 10, 16.6667], [8, 3, 6, 58.7805], [2, 4, 5, 41.2195], [10, 0, 5, null], [6, 4, 6, 50.9524]];
for (const [r, t, g, v] of REF) {
  const o = E.run(r, t, g);
  if (v === null) assert.ok(!o.ok, "should fire no rule: " + [r, t, g]);
  else assert.ok(Math.abs(o.value - v) < 1e-3, [r, t, g] + ": " + o.value + " vs " + v);
}
console.log("fuzzy parity ok:", REF.length, "cases");
