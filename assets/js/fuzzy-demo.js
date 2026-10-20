/* Interactive front end for fuzzy-engine.js: sliders, membership plots, live rule strengths,
   the clipped output set with its centroid, and the whole road x gap decision map. */
(function () {
  var E = window.FuzzyEngine, NS = 'http://www.w3.org/2000/svg';
  var root = document.getElementById('fz'); if (!root || !E) return;
  var NAMES = ['Road condition', 'Traffic density', 'Gap in traffic'], KEYS = ['road', 'traffic', 'gap'];
  var TERM_COL = { poor: 'var(--c-cp)', average: 'var(--warm)', good: 'var(--good)', low: 'var(--c-cp)', medium: 'var(--warm)', high: 'var(--good)' };
  var state = { road: 7.5, traffic: 2.5, gap: 9, set: 'v1' };
  // the rewrite renames terms so they read as what they mean; the triangles are unchanged
  var LBL = { v1: [null, null, null], v2: [null, { poor: 'light', average: 'moderate', good: 'heavy' }, { poor: 'small', average: 'medium', good: 'large' }] };
  function lbl(i, term) { var m = LBL[state.set][i]; return m ? m[term] : term; }
  function rules() { return state.set === 'v2' ? E.RULES_V2 : E.RULES; }
  var ICONS = {"road": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><path d=\"M7 21 10 3M17 21 14 3M12 6v2M12 11v2M12 16v2\"/></svg>", "traffic": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M5 16V11l2-5h10l2 5v5H5z\"/><path d=\"M5 11h14\"/><circle cx=\"8\" cy=\"16\" r=\"1.6\"/><circle cx=\"16\" cy=\"16\" r=\"1.6\"/></svg>", "gap": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><path d=\"M3 12h4M17 12h4M9 8l-2 4 2 4M15 8l2 4-2 4\"/></svg>"};

  function S(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function path(xs, ys, X, Y) { return xs.map(function (x, i) { return (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(ys[i]).toFixed(1); }).join(''); }

  // ---- input panels ----
  var inputs = root.querySelector('.fz-inputs');
  var panels = KEYS.map(function (k, idx) {
    var card = document.createElement('div'); card.className = 'fz-in';
    card.innerHTML = '<div class="fz-head"><label for="fz-' + k + '"><span class="fz-ic" aria-hidden="true">' + ICONS[k] + '</span>' + NAMES[idx] + '</label><output id="fz-' + k + '-v"></output></div>' +
      '<input type="range" id="fz-' + k + '" min="0" max="10" step="0.1" value="' + state[k] + '">';
    var W = 300, H = 110, m = { l: 8, r: 8, t: 8, b: 20 };
    var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fz-plot', role: 'img', 'aria-label': NAMES[idx] + ' membership functions' }, card);
    var X = function (v) { return m.l + v / 10 * (W - m.l - m.r); }, Y = function (v) { return H - m.b - v * (H - m.t - m.b); };
    ['poor', 'average', 'good'].forEach(function (t) { S('path', { d: path(E.IN, E.MF_IN[t], X, Y), stroke: TERM_COL[t], 'stroke-width': 2, fill: 'none' }, svg); });
    [0, 5, 10].forEach(function (v) { var tx = S('text', { x: X(v), y: H - 4, class: 'fz-tick', 'text-anchor': 'middle' }, svg); tx.textContent = v; });
    var line = S('line', { y1: m.t, y2: H - m.b, class: 'fz-mark' }, svg);
    var chips = document.createElement('div'); chips.className = 'fz-chips'; card.appendChild(chips);
    inputs.appendChild(card);
    var rng = card.querySelector('input');
    rng.addEventListener('input', function () { state[k] = +rng.value; update(); });
    return { rng: rng, out: card.querySelector('output'), line: line, X: X, chips: chips };
  });

  // ---- rules ----
  var rulesEl = root.querySelector('.fz-rules');
  E.RULES.forEach(function (r, i) {
    var row = document.createElement('div'); row.className = 'fz-rule';
    var op = r[0] === 'or' ? ' <b class="op or">OR</b> ' : ' <b class="op">AND</b> ';
    row.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="txt">IF road is <i>' + r[1][0] + '</i>' + op + 'traffic is <i>' + r[1][1] + '</i>' + op + 'gap is <i>' + r[1][2] + '</i> THEN speed is <i style="color:' + TERM_COL[r[2]] + '">' + r[2] + '</i></span><span class="bar"><i></i></span><span class="val"></span>';
    rulesEl.appendChild(row);
  });

  var grid = document.createElement('div'); grid.className = 'fz-grid'; grid.hidden = true; rulesEl.parentNode.insertBefore(grid, rulesEl.nextSibling);
  var gridCells = [];
  ['poor', 'average', 'good'].forEach(function (tr) {
    var blk = document.createElement('div'); blk.className = 'fz-blk';
    blk.innerHTML = '<b>Traffic ' + LBL.v2[1][tr] + '</b><div class="fz-cells"><span></span><span>gap small</span><span>medium</span><span>large</span></div>';
    var cells = blk.querySelector('.fz-cells');
    ['good', 'average', 'poor'].forEach(function (rd) {
      var h = document.createElement('span'); h.className = 'rh'; h.textContent = 'road ' + rd; cells.appendChild(h);
      ['poor', 'average', 'good'].forEach(function (gp) {
        var idx = -1; E.RULES_V2.forEach(function (r, i) { if (r[1][0] === rd && r[1][1] === tr && r[1][2] === gp) idx = i; });
        var out = E.RULES_V2[idx][2], c = document.createElement('span'); c.className = 'cell';
        c.style.setProperty('--c', TERM_COL[out]); c.innerHTML = '<i>' + out + '</i><em></em>';
        c.title = 'IF road is ' + rd + ' AND traffic is ' + LBL.v2[1][tr] + ' AND gap is ' + LBL.v2[2][gp] + ' THEN speed is ' + out;
        cells.appendChild(c); gridCells[idx] = c;
      });
    });
    grid.appendChild(blk);
  });
  var rulesTitle = root.querySelector('.fz-rules-title'), rulesNote = root.querySelector('.fz-rules-note');

  // ---- output ----
  var outSvg = root.querySelector('.fz-out-plot');
  var OW = 620, OH = 200, om = { l: 30, r: 10, t: 10, b: 24 };
  var OX = function (v) { return om.l + v / 100 * (OW - om.l - om.r); }, OY = function (v) { return OH - om.b - v * (OH - om.t - om.b); };
  outSvg.setAttribute('viewBox', '0 0 ' + OW + ' ' + OH);
  ['low', 'medium', 'high'].forEach(function (t) { S('path', { d: path(E.OUT, E.MF_OUT[t], OX, OY), stroke: TERM_COL[t], 'stroke-width': 1.5, fill: 'none', 'stroke-dasharray': '4 4', opacity: .7 }, outSvg); });
  [0, 25, 50, 75, 100].forEach(function (v) { var tx = S('text', { x: OX(v), y: OH - 6, class: 'fz-tick', 'text-anchor': 'middle' }, outSvg); tx.textContent = v; });
  var area = S('path', { class: 'fz-area' }, outSvg), cLine = S('line', { y1: om.t, y2: OH - om.b, class: 'fz-centroid' }, outSvg);
  var big = root.querySelector('.fz-value'), err = root.querySelector('.fz-error');

  // ---- decision map: road (x) by gap (y) at the current traffic value ----
  var cv = root.querySelector('.fz-map canvas'), ctx = cv.getContext('2d'), N = 41;
  cv.width = N; cv.height = N;
  var mapMark = root.querySelector('.fz-map .mk'), mapCap = root.querySelector('.fz-map-cap');
  function col(v) { // low red -> amber -> green, matching the term colours
    var t = v / 100, a = [226, 59, 59], b = [255, 184, 112], c = [89, 224, 165], p = t < .5 ? [a, b, t / .5] : [b, c, (t - .5) / .5];
    return p[0].map(function (x, i) { return Math.round(x + (p[1][i] - x) * p[2]); });
  }
  var lastT = null;
  function drawMap() {
    var key = state.set + state.traffic; if (lastT === key) return; lastT = key;
    var img = ctx.createImageData(N, N), holes = 0;
    for (var gy = 0; gy < N; gy++) for (var rx = 0; rx < N; rx++) {
      var o = E.run(rx / 4, state.traffic, 10 - gy / 4, rules()), c = o.ok ? col(o.value) : [40, 40, 52], j = (gy * N + rx) * 4;
      if (!o.ok) holes++;
      img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    mapCap.textContent = 'Traffic density fixed at ' + state.traffic.toFixed(1) + '. ' + (holes ? holes + ' of ' + N * N + (holes === 1 ? ' grid point fires' : ' grid points fire') + ' no rule at all (dark).' : 'Every grid point fires at least one rule.');
  }

  function update() {
    var o = E.run(state.road, state.traffic, state.gap, rules());
    panels.forEach(function (p, i) {
      var v = state[KEYS[i]]; p.out.textContent = v.toFixed(1); p.line.setAttribute('x1', p.X(v)); p.line.setAttribute('x2', p.X(v));
      var f = o.fuzzified[i]; p.chips.innerHTML = ['poor', 'average', 'good'].map(function (t) { return '<span style="--c:' + TERM_COL[t] + ';opacity:' + (f[t] > 0 ? 1 : .35) + '">' + lbl(i, t) + ' ' + f[t].toFixed(2) + '</span>'; }).join('');
    });
    var v2 = state.set === 'v2';
    rulesEl.hidden = v2; grid.hidden = !v2;
    rulesTitle.textContent = v2 ? '27 rules, one per combination, firing live' : 'The seven rules, firing live';
    rulesNote.textContent = v2 ? 'Every cell is an AND rule. Score = road + gap + (2 - traffic), each counted 0 to 2: 0-2 low, 3-4 medium, 5-6 high; a poor road stays low unless traffic is light and the gap large. Brighter cells are firing harder.'
                               : 'AND takes the smaller membership, OR the larger. Each rule cuts its output set at that strength.';
    if (v2) gridCells.forEach(function (c, i) { var a = o.activations[i]; c.style.setProperty('--a', a); c.classList.toggle('on', a > 0); c.querySelector('em').textContent = a > 0 ? a.toFixed(2) : ''; });
    else [].forEach.call(rulesEl.children, function (row, i) { var a = o.activations[i]; row.querySelector('.bar i').style.width = (a * 100) + '%'; row.querySelector('.val').textContent = a.toFixed(2); row.classList.toggle('on', a > 0); });
    if (o.ok) {
      var d = o.x.map(function (x, i) { return (i ? 'L' : 'M') + OX(x).toFixed(1) + ' ' + OY(o.agg[i]).toFixed(1); }).join('') + 'L' + OX(100) + ' ' + OY(0) + 'L' + OX(0) + ' ' + OY(0) + 'Z';
      area.setAttribute('d', d); cLine.setAttribute('x1', OX(o.value)); cLine.setAttribute('x2', OX(o.value)); cLine.style.opacity = 1;
      big.textContent = o.value.toFixed(1); big.parentNode.classList.remove('bad'); err.hidden = true;
    } else {
      area.setAttribute('d', ''); cLine.style.opacity = 0; big.textContent = '—'; big.parentNode.classList.add('bad'); err.hidden = false;
    }
    var mx = state.road / 10 * 100, my = (10 - state.gap) / 10 * 100; mapMark.style.left = mx + '%'; mapMark.style.top = my + '%';
    drawMap();
    // let the 3D highway (highway.js) follow along
    root.__fz = { road: state.road, traffic: state.traffic, gap: state.gap, ok: o.ok, value: o.value, cut: o.cut, acts: o.activations, set: state.set, rules: rules() };
    root.dispatchEvent(new CustomEvent('fz:update', { detail: root.__fz }));
  }

  root.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.set = b.getAttribute('data-set');
      root.querySelectorAll('[data-set]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      root.setAttribute('data-set', state.set); update();
    });
  });
  root.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-preset').split(',').map(Number);
      KEYS.forEach(function (k, i) { state[k] = v[i]; panels[i].rng.value = v[i]; }); update();
    });
  });
  update();
})();
