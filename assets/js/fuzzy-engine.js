/* A small Mamdani fuzzy engine that reproduces scikit-fuzzy 0.5's ControlSystem maths, so the
   2023 notebook (Fuzzy_logic_speed_limit_v2.ipynb) can run in the browser unchanged in behaviour.
   Works in the browser (window.FuzzyEngine) and in Node (module.exports) for the parity test. */
(function (root) {
  function range(a, b) { var r = []; for (var i = a; i < b; i++) r.push(i); return r; }
  function trimf(x, abc) { // skfuzzy.trimf
    var a = abc[0], b = abc[1], c = abc[2];
    return x.map(function (v) {
      var y = 0;
      if (a !== b && v > a && v < b) y = (v - a) / (b - a);
      if (b !== c && v > b && v < c) y = (c - v) / (c - b);
      if (v === b) y = 1;
      return y;
    });
  }
  function interp(xs, ys, v) { // numpy.interp
    if (v <= xs[0]) return ys[0];
    if (v >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (var i = 1; i < xs.length; i++) if (v <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (v - xs[i - 1]) / (xs[i] - xs[i - 1]);
  }
  function automf3(u) { // automf(3): poor / average / good, evenly spaced triangles
    var lo = u[0], hi = u[u.length - 1], mid = (lo + hi) / 2;
    return { poor: trimf(u, [lo, lo, mid]), average: trimf(u, [lo, mid, hi]), good: trimf(u, [mid, hi, hi]) };
  }
  function centroid(x, m) { // skfuzzy.defuzzify.centroid (piecewise-linear area integration)
    var sm = 0, sa = 0;
    for (var i = 1; i < x.length; i++) {
      var x1 = x[i - 1], x2 = x[i], y1 = m[i - 1], y2 = m[i], mo, ar;
      if ((y1 === 0 && y2 === 0) || x1 === x2) continue;
      if (y1 === y2) { mo = 0.5 * (x1 + x2); ar = (x2 - x1) * y1; }
      else if (y1 === 0) { mo = 2 / 3 * (x2 - x1) + x1; ar = 0.5 * (x2 - x1) * y2; }
      else if (y2 === 0) { mo = 1 / 3 * (x2 - x1) + x1; ar = 0.5 * (x2 - x1) * y1; }
      else { mo = (2 / 3 * (x2 - x1) * (y2 + 0.5 * y1)) / (y1 + y2) + x1; ar = 0.5 * (x2 - x1) * (y1 + y2); }
      sm += mo * ar; sa += ar;
    }
    return sa > 0 ? sm / sa : NaN;
  }
  // points where a term's membership crosses its cut level (skfuzzy adds these before defuzzifying)
  function crossings(u, mf, cut) {
    var out = [];
    for (var i = 1; i < u.length; i++) {
      var y1 = mf[i - 1] - cut, y2 = mf[i] - cut;
      if (y1 * y2 < 0) out.push(u[i - 1] + (u[i] - u[i - 1]) * y1 / (y1 - y2));
    }
    return out;
  }

  // ---- the 2023 notebook, verbatim in meaning ----
  var IN = range(0, 11), OUT = range(0, 101);
  var MF_IN = automf3(IN);
  var MF_OUT = { low: trimf(OUT, [0, 0, 50]), medium: trimf(OUT, [0, 50, 100]), high: trimf(OUT, [50, 100, 100]) };
  var RULES = [ // [op, [road, traffic, gap], output]; null = term not used
    ['or', ['poor', 'good', 'poor'], 'low'],
    ['and', ['poor', 'average', 'average'], 'low'],
    ['and', ['average', 'good', 'poor'], 'low'],
    ['and', ['average', 'average', 'average'], 'medium'],
    ['and', ['good', 'good', 'poor'], 'medium'],
    ['and', ['good', 'average', 'average'], 'high'],
    ['and', ['good', 'poor', 'good'], 'high']
  ];

  // ---- my 2026 rewrite: one AND rule for each of the 27 combinations, so something always fires ----
  // Each input counts 0/1/2 (traffic counts in reverse: light traffic helps). Score = road + gap + (2 - traffic).
  // 0-2 low, 3-4 medium, 5-6 high; a poor road stays low unless traffic is light and the gap is large.
  var T3 = ['poor', 'average', 'good'];
  var RULES_V2 = [];
  T3.forEach(function (r, ri) { T3.forEach(function (tr, ti) { T3.forEach(function (g, gi) {
    var s = ri + gi + (2 - ti), out = s <= 2 ? 'low' : s <= 4 ? 'medium' : 'high';
    if (ri === 0) out = (ti === 0 && gi === 2) ? 'medium' : 'low';
    RULES_V2.push(['and', [r, tr, g], out]);
  }); }); });

  function fuzzify(v) { var o = {}; for (var k in MF_IN) o[k] = interp(IN, MF_IN[k], v); return o; }

  function run(road, traffic, gap, rules) {
    rules = rules || RULES;
    var f = [fuzzify(road), fuzzify(traffic), fuzzify(gap)];
    var acts = rules.map(function (r) {
      var vals = r[1].map(function (t, i) { return f[i][t]; });
      return r[0] === 'or' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    });
    var cut = { low: 0, medium: 0, high: 0 };
    rules.forEach(function (r, i) { cut[r[2]] = Math.max(cut[r[2]], acts[i]); });
    // upsampled universe: original points plus each cut-level crossing
    var pts = OUT.slice();
    Object.keys(cut).forEach(function (k) { if (cut[k] > 0 && cut[k] < 1) pts = pts.concat(crossings(OUT, MF_OUT[k], cut[k])); });
    pts.sort(function (a, b) { return a - b; });
    pts = pts.filter(function (v, i) { return i === 0 || v !== pts[i - 1]; });
    var agg = pts.map(function (x) {
      var m = 0; for (var k in cut) m = Math.max(m, Math.min(cut[k], interp(OUT, MF_OUT[k], x))); return m;
    });
    var any = agg.some(function (v) { return v > 0; });
    return { fuzzified: f, activations: acts, cut: cut, x: pts, agg: agg, ok: any, value: any ? centroid(pts, agg) : null };
  }

  var api = { run: run, IN: IN, OUT: OUT, MF_IN: MF_IN, MF_OUT: MF_OUT, RULES: RULES, RULES_V2: RULES_V2, interp: interp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FuzzyEngine = api;
})(this);
