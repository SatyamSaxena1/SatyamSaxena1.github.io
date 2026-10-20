/* Interactive front end for fuzzy-engine.js: sliders, membership plots, live rule strengths,
   the clipped output set with its centroid, and the whole road x gap decision map. */
(function () {
  var E = window.FuzzyEngine, NS = 'http://www.w3.org/2000/svg';
  var root = document.getElementById('fz'); if (!root || !E) return;
  var NAMES = ['Road condition', 'Traffic density', 'Gap in traffic'], KEYS = ['road', 'traffic', 'gap'];
  var TERM_COL = { poor: 'var(--c-cp)', average: 'var(--warm)', good: 'var(--good)', low: 'var(--c-cp)', medium: 'var(--warm)', high: 'var(--good)' };
  var state = { road: 7.5, traffic: 2.5, gap: 9 };

  function S(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function path(xs, ys, X, Y) { return xs.map(function (x, i) { return (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(ys[i]).toFixed(1); }).join(''); }

  // ---- input panels ----
  var inputs = root.querySelector('.fz-inputs');
  var panels = KEYS.map(function (k, idx) {
    var card = document.createElement('div'); card.className = 'fz-in';
    card.innerHTML = '<div class="fz-head"><label for="fz-' + k + '">' + NAMES[idx] + '</label><output id="fz-' + k + '-v"></output></div>' +
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
    if (lastT === state.traffic) return; lastT = state.traffic;
    var img = ctx.createImageData(N, N), holes = 0;
    for (var gy = 0; gy < N; gy++) for (var rx = 0; rx < N; rx++) {
      var o = E.run(rx / 4, state.traffic, 10 - gy / 4), c = o.ok ? col(o.value) : [40, 40, 52], j = (gy * N + rx) * 4;
      if (!o.ok) holes++;
      img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    mapCap.textContent = 'Traffic density fixed at ' + state.traffic.toFixed(1) + '. ' + (holes ? holes + ' of ' + N * N + (holes === 1 ? ' grid point fires' : ' grid points fire') + ' no rule at all (dark).' : 'Every grid point fires at least one rule.');
  }

  function update() {
    var o = E.run(state.road, state.traffic, state.gap);
    panels.forEach(function (p, i) {
      var v = state[KEYS[i]]; p.out.textContent = v.toFixed(1); p.line.setAttribute('x1', p.X(v)); p.line.setAttribute('x2', p.X(v));
      var f = o.fuzzified[i]; p.chips.innerHTML = ['poor', 'average', 'good'].map(function (t) { return '<span style="--c:' + TERM_COL[t] + ';opacity:' + (f[t] > 0 ? 1 : .35) + '">' + t + ' ' + f[t].toFixed(2) + '</span>'; }).join('');
    });
    [].forEach.call(rulesEl.children, function (row, i) { var a = o.activations[i]; row.querySelector('.bar i').style.width = (a * 100) + '%'; row.querySelector('.val').textContent = a.toFixed(2); row.classList.toggle('on', a > 0); });
    if (o.ok) {
      var d = o.x.map(function (x, i) { return (i ? 'L' : 'M') + OX(x).toFixed(1) + ' ' + OY(o.agg[i]).toFixed(1); }).join('') + 'L' + OX(100) + ' ' + OY(0) + 'L' + OX(0) + ' ' + OY(0) + 'Z';
      area.setAttribute('d', d); cLine.setAttribute('x1', OX(o.value)); cLine.setAttribute('x2', OX(o.value)); cLine.style.opacity = 1;
      big.textContent = o.value.toFixed(1); big.parentNode.classList.remove('bad'); err.hidden = true;
    } else {
      area.setAttribute('d', ''); cLine.style.opacity = 0; big.textContent = '—'; big.parentNode.classList.add('bad'); err.hidden = false;
    }
    var mx = state.road / 10 * 100, my = (10 - state.gap) / 10 * 100; mapMark.style.left = mx + '%'; mapMark.style.top = my + '%';
    drawMap();
  }

  root.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-preset').split(',').map(Number);
      KEYS.forEach(function (k, i) { state[k] = v[i]; panels[i].rng.value = v[i]; }); update();
    });
  });
  update();
})();
