/* Live charts: dependency-free, theme-aware, animated on scroll.
   Usage:  <div class="vz" data-chart="hbar" data-id="boxes_per_class" data-series="train,validation" data-colors="class" data-stacked></div>
   Types: vbar, hbar, line, donut, heat, sizes, pipeline, alluvial, gantt. Data comes from one JSON file (data-json on the script tag). */
(function () {
  var NS = 'http://www.w3.org/2000/svg', D = null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function S(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function H(tag, cls, html, p) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (p) p.appendChild(e); return e; }
  function fmt(n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }); }
  function compact(n) { return n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CLASS = { pantograph: 'var(--c-pan)', arm: 'var(--c-arm)', contact_point: 'var(--c-cp)', mast: 'var(--c-mast)' };
  var SER = ['var(--accent)', 'var(--s2)', 'var(--warm)', 'var(--good)'];

  /* tooltip */
  var tip = H('div', 'vz-tip'); tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  function showTip(html, x, y) { tip.innerHTML = html; tip.classList.add('on'); var w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8) + 'px'; tip.style.top = Math.max(8, y - h - 12) + 'px'; }
  function hideTip() { tip.classList.remove('on'); }
  function bindTip(el, html) { el.setAttribute('data-tip', html); el.tabIndex = 0; }
  document.addEventListener('pointermove', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t.getAttribute('data-tip'), e.clientX, e.clientY); else if (!e.target.closest || !e.target.closest('.vz-hover')) hideTip(); });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) { var r = t.getBoundingClientRect(); showTip(t.getAttribute('data-tip'), r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', hideTip); window.addEventListener('scroll', hideTip, { passive: true });

  function colorsFor(el, rows, n) {
    var m = el.getAttribute('data-colors');
    if (m === 'class') return rows.map(function (r) { return CLASS[r.label] || SER[0]; });
    return null;
  }
  function legend(el, names, cols) {
    if (!names || names.length < 2) return; var l = H('div', 'vz-legend', null, el);
    names.forEach(function (n, i) { H('span', null, '<i style="background:' + cols[i] + '"></i>' + esc(n), l); });
  }

  /* ---------- bars (HTML, so they reflow naturally) ---------- */
  function bars(el, horizontal) {
    var d = D[el.getAttribute('data-id')], names = (el.getAttribute('data-series') || '').split(',').filter(Boolean), stacked = el.hasAttribute('data-stacked');
    var dec = +(el.getAttribute('data-dec') || 0), suf = el.getAttribute('data-suffix') || '', rows = d.rows, perRow = colorsFor(el, rows), cols = SER;
    var max = +(el.getAttribute('data-max') || 0) || Math.max.apply(null, rows.map(function (r) { return stacked ? r.values.reduce(function (a, b) { return a + b; }, 0) : Math.max.apply(null, r.values); }));
    var wrap = H('div', 'vz-bars ' + (horizontal ? 'h' : 'v') + (stacked ? ' stk' : ''), null, el); wrap.style.setProperty('--n', rows.length);
    rows.forEach(function (r, ri) {
      var row = H('div', 'vz-row', null, wrap), total = r.values.reduce(function (a, b) { return a + b; }, 0);
      if (horizontal) H('label', null, esc(r.label), row);
      var track = H('div', 'vz-track', null, row);
      r.values.forEach(function (v, si) {
        var b = H('div', 'vz-bar' + (si ? ' s' + si : ''), null, track), c = perRow ? perRow[ri] : cols[si % cols.length];
        b.style.background = c; if (perRow && si > 0 && stacked) b.style.opacity = '.5'; var pct = v / max * 100;
        if (stacked) { b.style.setProperty('--p', pct + '%'); } else { b.style.setProperty('--p', pct + '%'); }
        b.style.setProperty('--i', ri * 0.07 + si * 0.05 + 's');
        bindTip(b, '<b>' + esc(r.label) + '</b><br>' + (names[si] ? esc(names[si]) + ': ' : '') + fmt(v, dec) + suf + (stacked && r.values.length > 1 ? '<br><span>total ' + fmt(total, dec) + suf + '</span>' : '') + (r.note ? '<br><span>' + esc(r.note) + '</span>' : ''));
        b.setAttribute('aria-label', r.label + ' ' + (names[si] || '') + ' ' + fmt(v, dec) + suf);
      });
      var cmp = el.hasAttribute('data-compact'); var val = H('span', 'vz-val', cmp ? compact(stacked ? total : r.values[0]) : fmt(stacked ? total : r.values[0], dec) + suf, row); if (!stacked && r.values.length > 1) val.textContent = r.values.map(function (v) { return fmt(v, dec) + suf; }).join(' · ');
      if (!horizontal) H('label', null, esc(r.label), row);
    });
    if (names.length > 1) legend(el, names, perRow ? ['var(--fg)', 'var(--muted)'].map(function (c, i) { return i ? 'rgba(255,255,255,.35)' : 'var(--muted)'; }) : cols);
  }

  /* ---------- lines (SVG) ---------- */
  function line(el) {
    var d = D[el.getAttribute('data-id')], keys = el.getAttribute('data-keys').split(','), names = (el.getAttribute('data-names') || el.getAttribute('data-keys')).split(','), W = 760, Hh = 330, m = { l: 46, r: 14, t: 14, b: 34 };
    var ymin = +(el.getAttribute('data-ymin') || 0), ymax = +(el.getAttribute('data-ymax') || 1), best = el.getAttribute('data-best'), xs = d[el.getAttribute('data-x') || 'x'];
    var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': el.getAttribute('data-label') || 'Line chart', preserveAspectRatio: 'xMidYMid meet' }, el); svg.setAttribute('class', 'vz-svg');
    var x0 = xs[0], x1 = xs[xs.length - 1]; function X(v) { return m.l + (v - x0) / (x1 - x0 || 1) * (W - m.l - m.r); } function Y(v) { return Hh - m.b - (v - ymin) / (ymax - ymin) * (Hh - m.t - m.b); }
    for (var i = 0; i <= 5; i++) { var yv = ymin + (ymax - ymin) * i / 5, yy = Y(yv); S('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: 'vz-grid' }, svg); S('text', { x: m.l - 8, y: yy + 4, class: 'vz-tick', 'text-anchor': 'end' }, svg).textContent = yv.toFixed(ymax <= 1.5 ? 1 : 0); }
    var step = Math.ceil(xs.length / 8 / 5) * 5 || 1; xs.forEach(function (v, k) { if (k % Math.max(1, Math.round(xs.length / 8)) === 0 || k === xs.length - 1) S('text', { x: X(v), y: Hh - 10, class: 'vz-tick', 'text-anchor': 'middle' }, svg).textContent = v; });
    var paths = [];
    keys.forEach(function (k, si) {
      var ys = d[k]; var dd = ys.map(function (v, j) { return (j ? 'L' : 'M') + X(xs[j]).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      if (si === 0 && el.hasAttribute('data-area')) { var a = S('path', { d: dd + 'L' + X(x1) + ' ' + Y(ymin) + 'L' + X(x0) + ' ' + Y(ymin) + 'Z', class: 'vz-area', fill: SER[si] }, svg); }
      var p = S('path', { d: dd, class: 'vz-line', stroke: SER[si % SER.length], fill: 'none' }, svg); p.style.setProperty('--d', (si * .25) + 's'); paths.push(p);
    });
    var mk = null;
    if (best) { var bi = d[best].indexOf(Math.max.apply(null, d[best])); mk = S('g', { class: 'vz-best' }, svg); S('circle', { cx: X(xs[bi]), cy: Y(d[best][bi]), r: 6 }, mk); var tx = S('text', { x: Math.min(X(xs[bi]), W - 120), y: Y(d[best][bi]) - 14, class: 'vz-bestlab', 'text-anchor': 'middle' }, mk); tx.textContent = 'best ' + d[best][bi].toFixed(3) + ' · epoch ' + xs[bi]; }
    var cross = S('line', { y1: m.t, y2: Hh - m.b, class: 'vz-cross' }, svg), dots = keys.map(function (k, si) { return S('circle', { r: 4.5, class: 'vz-dot', fill: SER[si % SER.length] }, svg); });
    var hit = S('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent', class: 'vz-hover' }, svg);
    function at(e) { var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, f = (px - m.l) / (W - m.l - m.r), k = Math.max(0, Math.min(xs.length - 1, Math.round(f * (xs.length - 1))));
      cross.setAttribute('x1', X(xs[k])); cross.setAttribute('x2', X(xs[k])); cross.style.opacity = 1; keys.forEach(function (key, si) { dots[si].setAttribute('cx', X(xs[k])); dots[si].setAttribute('cy', Y(d[key][k])); dots[si].style.opacity = 1; });
      showTip('<b>epoch ' + xs[k] + '</b>' + keys.map(function (key, si) { return '<br><i class="dotk" style="background:' + SER[si % SER.length] + '"></i>' + esc(names[si]) + ': ' + d[key][k].toFixed(3); }).join(''), e.clientX, e.clientY); }
    hit.addEventListener('pointermove', at); hit.addEventListener('pointerleave', function () { cross.style.opacity = 0; dots.forEach(function (c) { c.style.opacity = 0; }); hideTip(); });
    legend(el, names, SER);
    el.__paths = paths; paths.forEach(function (p) { var L = p.getTotalLength(); p.style.setProperty('--len', L); });
  }

  /* ---------- donut ---------- */
  function donut(el) {
    var d = D[el.getAttribute('data-id')], parts = d.parts, tot = parts.reduce(function (a, b) { return a + b.value; }, 0), R = 70, C = 2 * Math.PI * R, off = 0;
    var svg = S('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': el.getAttribute('data-label') || 'Donut chart', class: 'vz-donut' }, el), cols = ['var(--accent)', 'var(--warm)'];
    S('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: 'var(--chip)', 'stroke-width': 26 }, svg);
    parts.forEach(function (p, i) { var len = p.value / tot * C, c = S('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: cols[i], 'stroke-width': 26, 'stroke-dasharray': '0 ' + C, 'stroke-dashoffset': -off, transform: 'rotate(-90 100 100)', class: 'vz-seg' }, svg); c.style.setProperty('--len', len); c.style.setProperty('--gap', C); c.style.setProperty('--i', i * .35 + 's'); bindTip(c, '<b>' + esc(p.label) + '</b><br>' + fmt(p.value) + ' frames (' + (p.value / tot * 100).toFixed(1) + '%)'); off += len; });
    var t = S('text', { x: 100, y: 104, 'text-anchor': 'middle', class: 'vz-dc' }, svg); t.textContent = (parts[1].value / tot * 100).toFixed(1) + '%'; var t2 = S('text', { x: 100, y: 124, 'text-anchor': 'middle', class: 'vz-dl' }, svg); t2.textContent = parts[1].label;
    var box = H('div', 'vz-donut-side', null, el); parts.forEach(function (p, i) { H('div', null, '<i style="background:' + cols[i] + '"></i><b>' + fmt(p.value) + '</b> ' + esc(p.label), box); });
  }

  /* ---------- heatmaps (canvas) ---------- */
  var RAMP = [[8, 6, 40], [40, 20, 120], [100, 40, 190], [190, 80, 200], [255, 150, 120], [255, 230, 150]];
  function ramp(t) { t = Math.max(0, Math.min(1, t)) * (RAMP.length - 1); var i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(i + 1, RAMP.length - 1)]; return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(',') + ')'; }
  function heat(el, which) {
    var d = D[which], grids = d.grids, names = Object.keys(grids), wrap = H('div', 'vz-heats', null, el);
    names.forEach(function (n, k) {
      var g = grids[n], rows = g.length, cols = g[0].length, card = H('figure', 'vz-heat', null, wrap), cv = H('canvas', null, null, card); cv.width = cols * 8; cv.height = rows * 8; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', n + ' ' + (which === 'positions' ? 'position' : 'size') + ' density');
      var cx = cv.getContext('2d'); for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) { cx.fillStyle = ramp(g[y][x] / 100); cx.fillRect(x * 8, y * 8, 8, 8); }
      card.style.setProperty('--i', k * .12 + 's'); var cap = H('figcaption', null, '<b style="color:' + CLASS[n] + '">' + esc(n.replace('_', ' ')) + '</b>', card);
      if (which === 'sizes') { var m = d.median_pct[n]; cap.innerHTML += '<span>median ' + m[0] + '% × ' + m[1] + '%</span><em>x = width, y = height, up to ' + Math.round(d.extent[n] * 100) + '% of the frame</em>'; }
      else cap.innerHTML += '<em>where box centres fall (top of frame at top)</em>';
    });
  }

  /* ---------- diagrams ---------- */
  function node(parent, color, title, sub, i) { var n = H('div', 'vz-node', '<b>' + esc(title) + '</b><span>' + sub + '</span>', parent); n.style.setProperty('--c', color); n.style.setProperty('--i', i * .18 + 's'); return n; }
  var BASE = '';
  function img(p, alt) { return '<figure><img src="' + BASE + p + '" alt="' + esc(alt) + '" loading="lazy"><figcaption>' + esc(alt) + '</figcaption></figure>'; }
  function track(box) {
    var T = D.track, cur = 0, k = 0, timer = null;
    box.innerHTML = '<div class="trk"><div class="trk-tabs"></div><div class="trk-stage"><img alt="A close-up of consecutive video frames"><svg viewBox="0 0 1 1" preserveAspectRatio="none"></svg><span class="trk-n"></span></div>' +
      '<div class="trk-ctl"><button class="trk-play" aria-label="Play or pause">&#10074;&#10074;</button><input type="range" min="0" max="24" value="0" aria-label="Frame"><label class="trk-trail"><input type="checkbox" checked> trail</label></div>' +
      '<p class="trk-cap"></p></div>';
    var tabs = box.querySelector('.trk-tabs'), im = box.querySelector('.trk-stage img'), sv = box.querySelector('svg'), nn = box.querySelector('.trk-n'), rg = box.querySelector('input[type=range]'), pl = box.querySelector('.trk-play'), tr = box.querySelector('.trk-trail input'), cap = box.querySelector('.trk-cap');
    T.forEach(function (s, i) { var b = H('button', i ? '' : 'on', esc(s.site), tabs); b.onclick = function () { cur = i; [].forEach.call(tabs.children, function (x, j) { x.classList.toggle('on', j === i); }); preload(); show(0); }; });
    function src(f) { return BASE + 'track/' + T[cur].key + '/' + (f < 10 ? '0' : '') + f + '.jpg'; }
    function preload() { for (var f = 0; f < 25; f++) { var q = new Image(); q.src = src(f); } }
    function show(f) {
      k = f; rg.value = f; im.src = src(f); nn.textContent = 'frame ' + (f + 1) + ' of 25';
      var h = '';
      if (tr.checked) for (var j = 0; j <= f; j++) T[cur].frames[j].forEach(function (b) { if (b[0] === 'contact_point') h += '<circle cx="' + b[1] + '" cy="' + b[2] + '" r="' + (.003 + .004 * j / 24) + '" fill="var(--c-cp)" opacity="' + (.25 + .5 * j / Math.max(1, f)) + '"/>'; });
      T[cur].frames[f].forEach(function (b) { h += '<rect x="' + (b[1] - b[3] / 2) + '" y="' + (b[2] - b[4] / 2) + '" width="' + b[3] + '" height="' + b[4] + '" fill="none" stroke="' + CLASS[b[0]] + '" stroke-width="2.5" vector-effect="non-scaling-stroke" rx=".004"/>'; });
      sv.innerHTML = h;
      cap.innerHTML = esc(T[cur].site) + ': final boxes on 25 consecutive frames of one clip, <b style="color:var(--c-cp)">contact points</b> and the <b style="color:var(--c-pan)">pantograph</b>. Drag the slider to step through. In CVAT, boxes like these were set on a few keyframes and carried across the frames between by tracking.';
    }
    function play(on) { clearInterval(timer); timer = null; pl.innerHTML = on ? '&#10074;&#10074;' : '&#9654;'; if (on) timer = setInterval(function () { show((k + 1) % 25); }, 140); }
    pl.onclick = function () { play(!timer); }; rg.oninput = function () { play(false); show(+rg.value); }; tr.onchange = function () { show(k); };
    box.__stop = function () { play(false); }; box.__start = function () { preload(); show(0); play(!reduce); };
  }
  var STEPS = [
    ['Film', 'cabin-camera<br>footage', 'var(--accent)'], ['Pre-annotate', 'a small pretrained<br>detector proposes boxes', 'var(--s2)'], ['Track', 'boxes carried between<br>frames from keyframes', 'var(--warm)'],
    ['Review', 'every frame checked<br>and corrected in CVAT', 'var(--good)'], ['Export', 'YOLO boxes', 'var(--s2)'], ['Train', 'YOLO26x ·<br>RF-DETR', 'var(--pink)']];
  var PANEL = [
    function () { return '<p>Cabin-camera video from five routes, cut into short segments (301 of them), with frames pulled from each.</p><div class="ev4">' + img('gallery/images/f12_lucknow.jpg', 'Lucknow') + img('gallery/images/f14_mehsana.jpg', 'Mehsana') + img('gallery/images/f25_mumbai.jpg', 'Mumbai') + img('gallery/images/f36_palanpur.jpg', 'Palanpur') + '</div>'; },
    function () { return '<p>A small pretrained detector proposes boxes inside CVAT. They are a starting point: the proposal below runs too tall and gets corrected.</p><div class="ev2">' + img('story/s08-auto-annotate-dialog.jpg', 'Choosing the auto-annotation model in CVAT') + img('story/s09-auto-box.jpg', 'An automatic proposal that is too tall') + '</div>'; },
    function () { return '<p>Drawing a contact point on every frame by hand would take far too long, so boxes were set on keyframes and tracking carried them between. Below: two real runs of 25 consecutive frames.</p><div class="ev-track"></div>'; },
    function () { return '<p>Two roles in CVAT: a <b>labeller</b>, and a <b>reviewer</b> who follows behind fixing mistakes. The reviewed box on the right is what goes into the dataset.</p><div class="ev2">' + img('story/s09-auto-box.jpg', 'Before: automatic proposal') + img('story/s10-manual-box.jpg', 'After: reviewed box') + '</div>'; },
    function () { return '<p>Reviewed tasks are exported as plain YOLO text, one line per box: <code>class x_centre y_centre width height</code>, all as fractions of the frame. Boxes are axis-aligned, so a box top stays parallel to the frame bottom.</p><pre class="ev-code">0 0.583358 0.326869 0.006539 0.012406\n0 0.405194 0.341024 0.007124 0.012655</pre><p>133,245 boxes, four classes.</p>'; },
    function () { return '<p>YOLO26x: mAP@50:95 <b>0.698</b>, 1280 px, about 8 days on one RTX 4070 Ti. RF-DETR Large: <b>0.679</b>, 1120 px, about 19 hours on one H100. Different validation sets, so not a ranking.</p><div class="ev2">' + img('story/s11-yolo-training.jpg', 'A YOLO training run') + '</div>'; }];
  function pipeline(el) {
    var w = H('div', 'vz-flow', null, el), pn = H('div', 'vz-panel', null, el), open = -1, nodes = [];
    BASE = document.querySelector('script[src*="charts.js"]').getAttribute('data-json').replace(/data\/charts\.json.*/, '');
    STEPS.forEach(function (s, i) {
      var n = node(w, s[2], s[0], s[1], i); n.setAttribute('role', 'button'); n.tabIndex = 0; n.setAttribute('aria-expanded', 'false'); H('em', 'vz-more', '<span class="t">See the evidence</span><i class="chev" aria-hidden="true"></i>', n); nodes.push(n);
      function tog() {
        var tk = pn.querySelector('.ev-track'); if (tk && tk.__stop) tk.__stop();
        if (open === i) { open = -1; pn.classList.remove('open'); pn.innerHTML = ''; } else {
          open = i; pn.innerHTML = '<h4>' + esc(s[0]) + '</h4>' + PANEL[i](); pn.classList.add('open'); pn.style.setProperty('--c', s[2]);
          var t2 = pn.querySelector('.ev-track'); if (t2) { track(t2); t2.__start(); }
        }
        nodes.forEach(function (x, j) { x.classList.toggle('on', j === open); x.setAttribute('aria-expanded', j === open); x.querySelector('.vz-more .t').textContent = j === open ? 'Hide the evidence' : 'See the evidence'; });
      }
      n.onclick = tog; n.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } };
      if (i < STEPS.length - 1) { var a = H('i', 'vz-arrow', null, w); a.style.setProperty('--i', i * .18 + .12 + 's'); }
    });
  }
  /* How the data was split: an alluvial diagram. Every bar is drawn to one scale (one pixel = the same number of images in every row),
     and the ribbons between rows show where each group of images went. Counts come from the dataset build summaries. */
  function alluvial(el) {
    var X0 = 170, X1 = 985, BH = 54, K = (X1 - X0) / 34573, YA = 58, YB = 236, YC = 414, VH = 490;
    var rows = [
      { y: YA, title: 'All images', sub: '34,573 in total', segs: [
        { id: 'a1', n: 20059, c: 'var(--accent)', o: 1, t: '<b>Reviewed frames, train</b><br>20,059 images', lab: 'Reviewed frames, train', pos: 'in' },
        { id: 'a2', n: 9321, c: 'var(--pink)', o: 1, t: '<b>Mast-focused set, train</b><br>9,321 images', lab: 'Mast-focused, train', pos: 'in' },
        { id: 'a3', n: 3492, c: 'var(--accent)', o: .72, t: '<b>Reviewed frames, held out</b><br>3,492 images', lab: 'Reviewed, held out', pos: 'up1' },
        { id: 'a4', n: 1701, c: 'var(--pink)', o: .72, t: '<b>Mast-focused set, held out</b><br>1,701 images', lab: 'Mast-focused, held out', pos: 'up2' }] },
      { y: YB, title: 'YOLO26x', sub: 'trained first', segs: [
        { id: 'b1', n: 29380, c: 'var(--good)', o: 1, t: '<b>YOLO26x train</b><br>reviewed + mast-focused train', lab: 'Train', pos: 'in' },
        { id: 'b2', n: 5114, c: 'var(--warm)', o: 1, t: '<b>YOLO26x validation</b><br>5,114 images counted by the run', lab: 'Validation', pos: 'in' }] },
      { y: YC, title: 'RF-DETR Large', sub: 'trained second', segs: [
        { id: 'c1', n: 29380, c: 'var(--good)', o: 1, t: '<b>RF-DETR train</b><br>29,380 images, the same set', lab: 'Train', pos: 'in' },
        { id: 'c2', n: 3941, c: 'var(--warm)', o: 1, t: '<b>RF-DETR validation</b><br>3,941 images: 2,795 reviewed + 1,146 mast-focused', lab: 'Validation', pos: 'in' },
        { id: 'c3', n: 1252, c: 'var(--cyan)', o: 1, t: '<b>RF-DETR test</b><br>1,252 images: 697 reviewed + 555 mast-focused', lab: 'Test', pos: 'dn' }] }];
    var geo = {}, off;
    rows.forEach(function (r) { off = 0; r.segs.forEach(function (s) { s.r = r; s.x = X0 + off * K; s.w = s.n * K; s.off = off; geo[s.id] = s; off += s.n; }); });
    var svg = S('svg', { viewBox: '0 0 1000 ' + VH, 'class': 'vz-alluv', role: 'img', 'aria-label': 'Diagram of how 34,573 images were split into train and held-out sets for YOLO26x and RF-DETR' }, el);
    var defs = S('defs', {}, svg), gid = 0;
    function rib(a, a0, a1, b, b0, b1, tip, c0, c1) {
      var id = 'ag' + (gid++), g = S('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      S('stop', { offset: 0, style: 'stop-color:' + c1 + ';stop-opacity:.22' }, g); S('stop', { offset: 1, style: 'stop-color:' + c1 + ';stop-opacity:.42' }, g);
      var xa0 = X0 + a0 * K, xa1 = X0 + a1 * K, xb0 = X0 + b0 * K, xb1 = X0 + b1 * K, ya = a.r.y + BH, yb = b.r.y, m = (ya + yb) / 2;
      var p = S('path', { d: 'M' + xa0 + ' ' + ya + ' L' + xa1 + ' ' + ya + ' C' + xa1 + ' ' + m + ' ' + xb1 + ' ' + m + ' ' + xb1 + ' ' + yb + ' L' + xb0 + ' ' + yb + ' C' + xb0 + ' ' + m + ' ' + xa0 + ' ' + m + ' ' + xa0 + ' ' + ya + ' Z', fill: 'url(#' + id + ')', 'class': 'rib' }, svg);
      p.style.setProperty('--i', (.5 + gid * .08) + 's'); bindTip(p, tip);
    }
    rib(geo.a1, 0, 20059, geo.b1, 0, 20059, '<b>Reviewed train</b><br>20,059 images into YOLO26x training', 'var(--accent)', 'var(--good)');
    rib(geo.a2, 20059, 29380, geo.b1, 20059, 29380, '<b>Mast-focused train</b><br>9,321 images added at training time', 'var(--pink)', 'var(--good)');
    var hv = 5114 / 5193;
    rib(geo.a3, 29380, 32872, geo.b2, 29380, 29380 + 3492 * hv, '<b>Held out</b><br>3,492 reviewed images, validation', 'var(--accent)', 'var(--warm)');
    rib(geo.a4, 32872, 34573, geo.b2, 29380 + 3492 * hv, 34494, '<b>Held out</b><br>1,701 mast-focused images, validation', 'var(--pink)', 'var(--warm)');
    rib(geo.b1, 0, 29380, geo.c1, 0, 29380, '<b>The same 29,380 training images</b><br>RF-DETR trained on the YOLO training set', 'var(--good)', 'var(--good)');
    var sv = 3941 / 5193 * 5114;
    rib(geo.b2, 29380, 29380 + sv, geo.c2, 29380, 33321, '<b>Validation</b><br>held-out images cut in two, by image', 'var(--warm)', 'var(--warm)');
    rib(geo.b2, 29380 + sv, 34494, geo.c3, 33321, 34573, '<b>Test</b><br>the other part of the held-out images', 'var(--warm)', 'var(--cyan)');
    rows.forEach(function (r, ri) {
      var g = S('g', { 'class': 'row' }, svg);
      var t = S('text', { x: 0, y: r.y + 24, 'class': 'rt' }, g); t.textContent = r.title; var u = S('text', { x: 0, y: r.y + 42, 'class': 'rs' }, g); u.textContent = r.sub;
      r.segs.forEach(function (s, si) {
        var bar = S('rect', { x: s.x, y: r.y, width: s.w, height: BH, rx: 7, 'class': 'seg', fill: s.c, 'fill-opacity': s.o }, g); bar.style.setProperty('--i', (ri * .25 + si * .08) + 's'); bindTip(bar, s.t);
        var cx = s.x + s.w / 2, lab = S('text', { 'class': 'sl' }, g), num = null;
        if (s.pos === 'in') { lab.setAttribute('x', cx); lab.setAttribute('y', r.y + 23); lab.setAttribute('text-anchor', 'middle'); num = S('text', { x: cx, y: r.y + 42, 'text-anchor': 'middle', 'class': 'sn' }, g); }
        else if (s.pos === 'dn') { lab.setAttribute('x', s.x + s.w); lab.setAttribute('y', r.y + BH + 20); lab.setAttribute('text-anchor', 'end'); }
        else { var ly = s.pos === 'up1' ? r.y - 18 : r.y - 40; lab.setAttribute('x', s.x + s.w); lab.setAttribute('y', ly); lab.setAttribute('text-anchor', 'end'); S('line', { x1: s.x + s.w / 2, x2: s.x + s.w / 2, y1: ly + 6, y2: r.y - 2, 'class': 'ld' }, g); }
        lab.textContent = s.lab + (s.pos === 'in' ? '' : '  ' + fmt(s.n)); if (num) num.textContent = fmt(s.n);
      });
    });
    var n1 = S('text', { x: X0 + 8, y: (YA + BH + YB) / 2 + 4, 'class': 'an' }, svg); n1.textContent = 'reviewed frames split by video segment';
    var n2 = S('text', { x: X1, y: (YB + BH + YC) / 2 + 4, 'class': 'an', 'text-anchor': 'end' }, svg); n2.textContent = 'held-out images cut in two, by image';
  }
  function gantt(el) {
    var months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'], rows = [['Proof of concept (public dataset)', 0, 1.2, 'var(--accent)'], ['Depth exploration', .8, 4.5, 'var(--s2)'], ['Real-time system on trains', 2.2, 5.2, 'var(--cyan)'], ['Wire height from depth', 6.0, 7.3, 'var(--warm)'], ['Rotated-box detour (dropped)', 6.3, 7.6, 'var(--pink)'], ['CVAT labelling campaign', 6.9, 8.2, 'var(--good)'], ['YOLO26x training', 7.4, 8.1, 'var(--accent)'], ['RF-DETR training', 8.0, 8.35, 'var(--pink)']];
    var w = H('div', 'vz-gantt', null, el), scale = H('div', 'scale', null, w); H('span', null, '', scale); var mo = H('div', 'months', null, scale); months.forEach(function (m) { H('span', null, m, mo); });
    rows.forEach(function (r, i) { var row = H('div', 'grow', null, w); H('label', null, esc(r[0]), row); var tr = H('div', 'tr', null, row), b = H('div', 'gb', null, tr); b.style.left = (r[1] / 9 * 100) + '%'; b.style.width = ((r[2] - r[1]) / 9 * 100) + '%'; b.style.background = r[3]; b.style.setProperty('--i', i * .09 + 's'); bindTip(b, '<b>' + esc(r[0]) + '</b>'); });
  }

  var B = { vbar: function (e) { bars(e, false); }, hbar: function (e) { bars(e, true); }, line: line, donut: donut, heat: function (e) { heat(e, 'positions'); }, sizes: function (e) { heat(e, 'sizes'); }, pipeline: pipeline, alluvial: alluvial, gantt: gantt };
  function build(el) { var f = B[el.getAttribute('data-chart')]; if (!f || el.__built) return; el.__built = true; try { f(el); } catch (e) { el.textContent = 'This chart could not load.'; console.error(e); } }
  function start() {
    var els = [].slice.call(document.querySelectorAll('.vz[data-chart]')); els.forEach(build);
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: .18, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }
  var src = document.querySelector('script[src*="charts.js"]').getAttribute('data-json');
  fetch(src).then(function (r) { return r.json(); }).then(function (j) { D = j; start(); }).catch(function (e) { console.error('chart data failed', e); });
})();
