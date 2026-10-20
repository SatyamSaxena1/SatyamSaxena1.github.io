/* Heat-map lab: the two heat-map cards grow into a full explainer.
   Tab 1 turns real box-centre dots into a heat map (and lets you measure regions); tab 2 shows box sizes and why a tiny contact point is so sensitive to a small slip.
   Data: assets/data/heatlab.json (counts computed from the real label files). No dependencies. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var script = document.querySelector('script[src*="heatlab.js"]');
  var BASE = script.getAttribute('data-base'), DATA = script.getAttribute('data-json');
  var D = null, dlg, inner, openFrom = null, closing = false;
  var CLS = [['pantograph', 'Pantograph', '--c-pan'], ['contact_point', 'Contact point', '--c-cp'], ['mast', 'Mast', '--c-mast'], ['arm', 'Arm', '--c-arm']];
  var STOPS = [[3, 2], [6, 3], [12, 6], [16, 9], [32, 18], [48, 27], [96, 54]];
  var FW = 1920, FH = 1080;
  var RAMP = [[0, [58, 43, 189]], [.35, [140, 70, 232]], [.65, [255, 106, 106]], [1, [255, 211, 107]]];

  function $(s, p) { return (p || document).querySelector(s); }
  function el(tag, cls, html, p) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (p) p.appendChild(e); return e; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 0 : d); }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#999'; }
  function rgb(t) {
    for (var i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
      var a = RAMP[i - 1], b = RAMP[i], u = (t - a[0]) / (b[0] - a[0]);
      return [0, 1, 2].map(function (k) { return Math.round(a[1][k] + (b[1][k] - a[1][k]) * u); });
    }
    return RAMP[RAMP.length - 1][1];
  }
  function fill(t) { var c = rgb(t); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (.2 + .74 * t).toFixed(3) + ')'; }
  function rebin(pos, nx, ny) {
    var fx = 96 / nx, fy = 54 / ny, out = [], y, x, i, j;
    for (y = 0; y < ny; y++) { out.push(new Array(nx).fill(0)); for (j = 0; j < fy; j++) for (x = 0; x < nx; x++) for (i = 0; i < fx; i++) out[y][x] += pos[y * fy + j][x * fx + i]; }
    return out;
  }
  function maxOf(g) { var m = 0; g.forEach(function (r) { r.forEach(function (v) { if (v > m) m = v; }); }); return m; }
  function logT(c, m) { return c > 0 ? Math.log1p(c) / Math.log1p(m) : 0; }

  /* ---------------- dialog shell with the card-to-lab transition ---------------- */
  function build() {
    if (dlg) return;
    dlg = el('dialog', 'lab', null, document.body); dlg.setAttribute('aria-label', 'Heat map explainer');
    inner = el('div', 'lab-inner', '<button class="lab-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="lab-tabs" role="tablist" aria-label="Explainers"><button role="tab" id="tab-pos" aria-controls="pane-pos" type="button">Where things appear</button><button role="tab" id="tab-size" aria-controls="pane-size" type="button">Why contact points are hard</button></div>' +
      '<section class="lab-pane" id="pane-pos" role="tabpanel" aria-labelledby="tab-pos"></section><section class="lab-pane" id="pane-size" role="tabpanel" aria-labelledby="tab-size"></section>', dlg);
    $('.lab-x', dlg).onclick = close;
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dlg.addEventListener('mousedown', function (e) { if (e.target === dlg) close(); });
    var tabs = [].slice.call(dlg.querySelectorAll('[role=tab]'));
    tabs.forEach(function (t, i) {
      t.onclick = function () { selectTab(i); };
      t.onkeydown = function (e) { var j = e.key === 'ArrowRight' ? (i + 1) % 2 : e.key === 'ArrowLeft' ? (i + 1) % 2 : -1; if (j >= 0) { e.preventDefault(); selectTab(j); tabs[j].focus(); } };
    });
    posLab($('#pane-pos', dlg)); sizeLab($('#pane-size', dlg));
    window.addEventListener('resize', function () { if (dlg.open && !closing) { posResize(); sizeResize(); refit(); } });
  }
  var TAB = 0;
  function selectTab(i) {
    TAB = i; dlg.querySelectorAll('[role=tab]').forEach(function (t, k) { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    dlg.querySelectorAll('.lab-pane').forEach(function (p, k) { p.hidden = k !== i; });
    if (i === 0) posEnter(); else sizeEnter();
    if (dlg.open && dlg.classList.contains('shown')) refit();
  }
  function finalRect() {
    var w = Math.min(1200, innerWidth - 24); inner.style.width = w + 'px'; inner.style.height = 'auto';
    var h = Math.min(inner.scrollHeight + 2, innerHeight - 24); inner.style.height = h + 'px';
    return { l: (innerWidth - w) / 2, t: (innerHeight - h) / 2, w: w, h: h };
  }
  function refit() { if (dlg && dlg.open && !closing) setBox(finalRect(), 30); }
  function setBox(r, radius) { var s = dlg.style; s.left = r.l + 'px'; s.top = r.t + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px'; s.borderRadius = radius + 'px'; }

  function open(card, tab) {
    if (!D) return;
    build(); openFrom = card; closing = false;
    var r = card.getBoundingClientRect();
    dlg.classList.remove('shown'); dlg.style.transition = 'none'; setBox({ l: r.left, t: r.top, w: r.width, h: r.height }, 26);
    dlg.showModal(); selectTab(tab); card.classList.add('lifted');
    var f = finalRect(); void dlg.offsetWidth;
    if (reduce) { setBox(f, 30); dlg.classList.add('shown'); return; }
    dlg.style.transition = ''; setBox(f, 30); dlg.classList.add('shown');
  }
  function close() {
    if (closing || !dlg || !dlg.open) return; closing = true; posStop();
    var card = openFrom, done = function () { if (dlg.open) dlg.close(); closing = false; if (card) { card.classList.remove('lifted'); card.focus({ preventScroll: true }); } };
    var r = card && card.getBoundingClientRect(), visible = r && r.bottom > 0 && r.top < innerHeight;
    dlg.classList.remove('shown');
    if (reduce || !visible) { done(); return; }
    setBox({ l: r.left, t: r.top, w: r.width, h: r.height }, 26); setTimeout(done, 520);
  }

  /* ---------------- Tab 1: from dots to heat ---------------- */
  var P = {};
  function posLab(pane) {
    pane.innerHTML =
      '<div class="lab-main"><div class="lab-col">' +
      '<div class="chips" role="group" aria-label="Class"></div>' +
      '<div class="stage" tabindex="0" aria-label="Frame with box centres. Drag to measure an area; the arrow keys are not needed, use the preset buttons."><img src="' + BASE + 'heat/frame.jpg" alt="" draggable="false"><canvas></canvas><div class="cellbox"></div><div class="brush"></div><div class="tip" role="status"></div></div>' +
      '<div class="scrub"><button class="play" type="button" aria-label="Replay the build">&#9654;</button><input type="range" min="0" max="7" value="0" aria-label="From dots to heat map"><output></output></div>' +
      '<div class="scale"><div class="bar"></div><div class="ticks"></div><span class="cap">boxes per cell, log scale</span></div>' +
      '</div><aside class="lab-side"><ol class="steps3"></ol><div class="readout"><p class="fact"></p><div class="try"><span>Measure:</span><button type="button" data-p="mid">Middle third</button><button type="button" data-p="top">Top half</button><button type="button" data-p="clear">Clear</button></div><p class="meas" aria-live="polite">Drag on the frame to measure an area.</p><div class="mbar"><i></i></div></div></aside></div>';
    P.pane = pane; P.cls = 'pantograph'; P.s = 0; P.last = null; P.brush = null;
    var chips = $('.chips', pane); CLS.forEach(function (c) { var b = el('button', null, '<i style="background:var(' + c[2] + ')"></i>' + c[1], chips); b.type = 'button'; b.dataset.c = c[0]; b.onclick = function () { P.cls = c[0]; P.brush = null; posChips(); posRefresh(false); }; });
    P.stage = $('.stage', pane); P.cv = $('canvas', P.stage); P.range = $('input', pane); P.out = $('output', pane);
    P.range.oninput = function () { posStop(); P.s = +P.range.value; posRefresh(true); };
    $('.play', pane).onclick = function () { posPlay(); };
    pane.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { var k = b.dataset.p; P.brush = k === 'mid' ? { x0: 1 / 3, x1: 2 / 3, y0: 0, y1: 1 } : k === 'top' ? { x0: 0, x1: 1, y0: 0, y1: .5 } : null; posMeasure(); }; });
    var S = [['Every box has a centre.', 'Each dot is where one real box\'s centre landed. Here, 500 of the <b class="nn"></b> boxes are drawn.'], ['Count the dots in each cell.', 'Lay a grid over the frame and count. Big cells give a rough answer. Hover a cell to read its count.'], ['Shrink the cells, colour by count.', 'Fine cells turn the counts into a picture. The colour runs on a log scale, so a spot with 10 boxes still shows beside one with 1,000.']];
    var ol = $('.steps3', pane); S.forEach(function (s, i) { el('li', null, '<b>' + s[0] + '</b><span>' + s[1] + '</span>', ol); });
    var st = P.stage, drag = null;
    st.addEventListener('pointermove', function (e) { if (drag) { var p = pt(e); P.brush = { x0: Math.min(drag.x, p.x), x1: Math.max(drag.x, p.x), y0: Math.min(drag.y, p.y), y1: Math.max(drag.y, p.y) }; posMeasure(); } hover(e); });
    st.addEventListener('pointerdown', function (e) { posStop(); drag = pt(e); st.setPointerCapture(e.pointerId); P.brush = { x0: drag.x, x1: drag.x, y0: drag.y, y1: drag.y }; });
    st.addEventListener('pointerup', function () { if (drag && P.brush && (P.brush.x1 - P.brush.x0 < .01 || P.brush.y1 - P.brush.y0 < .01)) P.brush = null; drag = null; posMeasure(); });
    st.addEventListener('pointerleave', function () { $('.tip', st).classList.remove('on'); $('.cellbox', st).style.display = 'none'; });
    function pt(e) { var r = st.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; }
    function hover(e) {
      var p = pt(e), tip = $('.tip', st), box = $('.cellbox', st), d = D.classes[P.cls], r = st.getBoundingClientRect();
      if (P.s === 0) { box.style.display = 'none'; tip.innerHTML = 'across ' + pct(p.x) + '% · down ' + pct(p.y) + '%'; }
      else {
        var sx = STOPS[P.s - 1][0], sy = STOPS[P.s - 1][1], ix = Math.min(sx - 1, Math.floor(p.x * sx)), iy = Math.min(sy - 1, Math.floor(p.y * sy)), g = rebin(d.pos, sx, sy), c = g[iy][ix];
        box.style.display = 'block'; box.style.left = ix / sx * 100 + '%'; box.style.top = iy / sy * 100 + '%'; box.style.width = 100 / sx + '%'; box.style.height = 100 / sy + '%';
        tip.innerHTML = '<b>' + fmt(c) + '</b> centres here<br><span>' + pct(c / d.n, 1) + '% of all ' + CLS.filter(function (k) { return k[0] === P.cls; })[0][1].toLowerCase() + ' boxes</span>';
      }
      tip.classList.add('on'); var x = e.clientX - r.left + 14, y = e.clientY - r.top - 10; tip.style.left = Math.min(x, r.width - tip.offsetWidth - 6) + 'px'; tip.style.top = Math.max(4, y - tip.offsetHeight) + 'px';
    }
    posChips();
  }
  function posChips() { P.pane.querySelectorAll('.chips button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.c === P.cls); }); }
  function posSize() {
    var w = P.stage.clientWidth, h = Math.round(w * 9 / 16), dpr = Math.min(2, devicePixelRatio || 1);
    P.cv.width = Math.round(w * dpr); P.cv.height = Math.round(h * dpr); P.last = null;
  }
  function paint(ctx, w, h, s) {
    var d = D.classes[P.cls], col = css(CLS.filter(function (k) { return k[0] === P.cls; })[0][2]);
    ctx.clearRect(0, 0, w, h);
    if (s === 0) {
      ctx.fillStyle = col; var r = Math.max(2.2, w / 300);
      d.dots.forEach(function (p) { ctx.globalAlpha = .88; ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, r, 0, 6.2832); ctx.fill(); });
      ctx.globalAlpha = 1; return;
    }
    var nx = STOPS[s - 1][0], ny = STOPS[s - 1][1], g = rebin(d.pos, nx, ny), m = maxOf(g), cw = w / nx, ch = h / ny;
    for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) { var c = g[y][x]; if (c) { ctx.fillStyle = fill(logT(c, m)); ctx.fillRect(Math.floor(x * cw), Math.floor(y * ch), Math.ceil(cw), Math.ceil(ch)); } }
    if (nx <= 48) { ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.beginPath(); for (x = 1; x < nx; x++) { ctx.moveTo(Math.round(x * cw) + .5, 0); ctx.lineTo(Math.round(x * cw) + .5, h); } for (y = 1; y < ny; y++) { ctx.moveTo(0, Math.round(y * ch) + .5); ctx.lineTo(w, Math.round(y * ch) + .5); } ctx.stroke(); }
  }
  function posRefresh(animate) {
    if (!P.cv.width) posSize();
    var s = P.s, w = P.cv.width, h = P.cv.height, ctx = P.cv.getContext('2d'), off = document.createElement('canvas'); off.width = w; off.height = h; paint(off.getContext('2d'), w, h, s);
    cancelAnimationFrame(P.raf);
    if (!animate || reduce || !P.last) { ctx.clearRect(0, 0, w, h); ctx.drawImage(off, 0, 0); P.last = off; }
    else { var t0 = performance.now(), prev = P.last; (function f(now) { var a = Math.min(1, (now - t0) / 280); ctx.clearRect(0, 0, w, h); ctx.globalAlpha = 1 - a; ctx.drawImage(prev, 0, 0); ctx.globalAlpha = a; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1; if (a < 1) P.raf = requestAnimationFrame(f); else P.last = off; })(t0); }
    P.range.value = s; P.range.style.setProperty('--p', s / 7 * 100 + '%');
    P.out.textContent = s === 0 ? 'dots' : STOPS[s - 1][0] + ' × ' + STOPS[s - 1][1] + ' cells';
    var step = s === 0 ? 0 : s <= 3 ? 1 : 2; P.pane.querySelectorAll('.steps3 li').forEach(function (li, i) { li.classList.toggle('on', i === step); li.classList.toggle('done', i < step); });
    var d = D.classes[P.cls], name = CLS.filter(function (k) { return k[0] === P.cls; })[0][1].toLowerCase();
    P.pane.querySelector('.nn').textContent = fmt(d.n) + ' ' + name;
    var tot = 0, mid = 0, top = 0; d.pos.forEach(function (row, y) { row.forEach(function (v, x) { tot += v; if (x >= 32 && x < 64) mid += v; if (y < 27) top += v; }); });
    $('.fact', P.pane).innerHTML = '<b>' + pct(mid / tot, 1) + '%</b> of ' + name + ' centres sit in the middle third of the frame\'s width, and <b>' + pct(top / tot, 1) + '%</b> in the top half.';
    legend(s); posMeasure(); $('.cellbox', P.stage).style.display = 'none';
  }
  function legend(s) {
    var sc = $('.scale', P.pane), bar = $('.bar', sc), tk = $('.ticks', sc);
    sc.classList.toggle('off', s === 0);
    bar.style.background = 'linear-gradient(90deg,' + RAMP.map(function (r) { var c = rgb(r[0]); return 'rgb(' + c.join(',') + ') ' + r[0] * 100 + '%'; }).join(',') + ')';
    if (s === 0) { tk.innerHTML = ''; return; }
    var g = rebin(D.classes[P.cls].pos, STOPS[s - 1][0], STOPS[s - 1][1]), m = maxOf(g), h = '';
    [1, 10, 100, 1000, 10000, 100000].forEach(function (v) { if (v < m) h += '<span style="left:' + logT(v, m) * 100 + '%">' + fmt(v) + '</span>'; });
    tk.innerHTML = h + '<span style="left:100%;transform:translateX(-100%)">' + fmt(m) + '</span>';
  }
  function posMeasure() {
    var b = P.brush, br = $('.brush', P.stage), meas = $('.meas', P.pane), mb = $('.mbar i', P.pane), d = D.classes[P.cls];
    if (!b) { br.style.display = 'none'; meas.innerHTML = 'Drag on the frame to measure an area, or use a preset.'; mb.style.width = '0'; return; }
    br.style.display = 'block'; br.style.left = b.x0 * 100 + '%'; br.style.top = b.y0 * 100 + '%'; br.style.width = (b.x1 - b.x0) * 100 + '%'; br.style.height = (b.y1 - b.y0) * 100 + '%';
    var tot = 0, ins = 0; d.pos.forEach(function (row, y) { row.forEach(function (v, x) { tot += v; var cx = (x + .5) / 96, cy = (y + .5) / 54; if (cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1) ins += v; }); });
    var area = (b.x1 - b.x0) * (b.y1 - b.y0), name = CLS.filter(function (k) { return k[0] === P.cls; })[0][1].toLowerCase();
    meas.innerHTML = 'This area is <b>' + pct(area) + '%</b> of the frame but holds <b>' + pct(ins / tot, 1) + '%</b> of ' + name + ' centres (' + fmt(ins) + ' of ' + fmt(tot) + ').';
    mb.style.width = ins / tot * 100 + '%';
  }
  function posPlay() {
    posStop(); P.s = 0; posRefresh(false); var i = 0;
    P.timer = setInterval(function () { i++; if (i > 7) { posStop(); return; } P.s = i; posRefresh(true); }, i === 0 ? 700 : 620);
  }
  function posStop() { clearInterval(P.timer); P.timer = null; }
  function posResize() { if (!P.pane) return; posSize(); posRefresh(false); }
  function posEnter() { if (!P.pane || TAB !== 0) return; setTimeout(function () { posResize(); refit(); if (reduce) { P.s = 7; posRefresh(false); } else posPlay(); }, reduce ? 0 : 480); }

  /* ---------------- Tab 2: how big, and why contact points are hard ---------------- */
  var Z = {};
  function sizeLab(pane) {
    pane.innerHTML =
      '<div class="lab-main"><div class="lab-col">' +
      '<div class="chips" role="group" aria-label="Class"></div>' +
      '<div class="szgrid"><div class="szheat"><canvas aria-label="Box width against height density"></canvas><div class="ax ay">height ↑</div><div class="ax axx">width →</div><div class="mk"></div><div class="tip"></div></div>' +
      '<div class="szpv"><div class="pv"><img src="' + BASE + 'heat/frame.jpg" alt=""><div class="med"></div><div class="ghost"></div></div><p class="pvt"></p></div></div>' +
      '</div><aside class="lab-side"><h3>The nudge test</h3><p class="lead">A box counts as right when it overlaps the true box enough (IoU). Slip every box sideways and down by a few pixels and watch the overlap.</p>' +
      '<label class="nudge">Slip by <output></output><input type="range" min="0" max="30" value="5" aria-label="Pixels of slip"></label>' +
      '<canvas class="ill" aria-label="A box and a copy slipped by a few pixels"></canvas><div class="ious"></div>' +
      '<p class="note">AP@50:95 averages the score over overlap thresholds from 0.5 to 0.95, so a box that overlaps by 0.3 fails every one of them. Median box sizes are on a 1920 × 1080 frame.</p></aside></div>';
    Z.pane = pane; Z.cls = 'contact_point'; Z.d = 5; Z.ghost = null;
    var chips = $('.chips', pane); CLS.forEach(function (c) { var b = el('button', null, '<i style="background:var(' + c[2] + ')"></i>' + c[1], chips); b.type = 'button'; b.dataset.c = c[0]; b.onclick = function () { Z.cls = c[0]; Z.ghost = null; sizeRefresh(); }; });
    Z.cv = $('.szheat canvas', pane); Z.range = $('.nudge input', pane); Z.out = $('.nudge output', pane);
    Z.range.oninput = function () { Z.d = +Z.range.value; nudge(); };
    var ious = $('.ious', pane); CLS.forEach(function (c) { el('div', 'iou', '<label style="color:var(' + c[2] + ')">' + c[1] + '</label><div class="trk"><i style="background:var(' + c[2] + ')"></i><u style="left:50%"></u><u style="left:75%"></u></div><b></b>', ious).dataset.c = c[0]; });
    var hm = $('.szheat', pane);
    hm.addEventListener('pointermove', function (e) {
      var r = Z.cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * 30), y = Math.floor((e.clientY - r.top) / r.height * 30);
      if (x < 0 || y < 0 || x > 29 || y > 29) return; Z.ghost = { x: x, y: y }; ghost(true);
      var tip = $('.tip', hm), d = D.classes[Z.cls], c = d.size[y][x], e30 = d.extent / 30;
      tip.innerHTML = '<b>' + fmt(c) + '</b> boxes<br><span>' + pct(x * e30, 1) + '–' + pct((x + 1) * e30, 1) + '% wide, ' + pct((29 - y) * e30, 1) + '–' + pct((30 - y) * e30, 1) + '% tall</span>';
      tip.classList.add('on'); var hr = hm.getBoundingClientRect(), tx = e.clientX - hr.left + 14, ty = e.clientY - hr.top - 10; tip.style.left = Math.min(tx, hr.width - tip.offsetWidth - 6) + 'px'; tip.style.top = Math.max(4, ty - tip.offsetHeight) + 'px';
    });
    hm.addEventListener('pointerleave', function () { Z.ghost = null; $('.tip', hm).classList.remove('on'); ghost(false); });
  }
  function sizeEnter() { if (!Z.pane || TAB !== 1) return; setTimeout(function () { sizeRefresh(); refit(); }, reduce ? 0 : 420); }
  function sizeResize() { if (Z.pane) sizeRefresh(); }
  function sizeRefresh() {
    var d = D.classes[Z.cls], size = Math.min(Z.pane.querySelector('.szheat').clientWidth, 460), dpr = Math.min(2, devicePixelRatio || 1);
    Z.cv.style.width = size + 'px'; Z.cv.style.height = size + 'px'; Z.cv.width = size * dpr; Z.cv.height = size * dpr;
    var ctx = Z.cv.getContext('2d'), m = maxOf(d.size), cs = Z.cv.width / 30; ctx.clearRect(0, 0, Z.cv.width, Z.cv.height);
    for (var y = 0; y < 30; y++) for (var x = 0; x < 30; x++) { var c = d.size[y][x]; if (c) { ctx.fillStyle = fill(logT(c, m)); ctx.fillRect(Math.floor(x * cs), Math.floor(y * cs), Math.ceil(cs), Math.ceil(cs)); } }
    var mk = $('.mk', Z.pane); mk.style.left = d.median[0] / d.extent * 100 + '%'; mk.style.top = (1 - d.median[1] / d.extent) * 100 + '%'; mk.innerHTML = '<span>median</span>';
    Z.pane.querySelectorAll('.chips button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.c === Z.cls); });
    $('.axx', Z.pane).textContent = 'box width, 0 to ' + pct(d.extent) + '% of the frame →'; $('.ay', Z.pane).textContent = 'box height, 0 to ' + pct(d.extent) + '% ↑';
    ghost(false); nudge();
  }
  function ghost(on) {
    var d = D.classes[Z.cls], g = $('.ghost', Z.pane), med = $('.med', Z.pane), t = $('.pvt', Z.pane), col = 'var(' + CLS.filter(function (k) { return k[0] === Z.cls; })[0][2] + ')';
    med.style.cssText = 'width:' + d.median[0] * 100 + '%;height:' + d.median[1] * 100 + '%;border-color:' + col;
    if (on && Z.ghost) {
      var e30 = d.extent / 30, w = (Z.ghost.x + .5) * e30, h = (29 - Z.ghost.y + .5) * e30;
      g.style.cssText = 'display:block;width:' + w * 100 + '%;height:' + h * 100 + '%;border-color:' + col; t.innerHTML = 'A box this size is about <b>' + Math.round(w * FW) + ' × ' + Math.round(h * FH) + ' px</b> on a 1920 × 1080 frame.';
    } else { g.style.display = 'none'; t.innerHTML = 'Dashed: the median box, <b>' + Math.round(d.median[0] * FW) + ' × ' + Math.round(d.median[1] * FH) + ' px</b>. Hover the heat map to see other sizes.'; }
  }
  function iou(w, h, d) { var o = Math.max(0, w - d) * Math.max(0, h - d); return o / (2 * w * h - o); }
  function nudge() {
    var d = Z.d, cd = D.classes[Z.cls]; Z.out.textContent = d + ' px';
    CLS.forEach(function (c) { var m = D.classes[c[0]].median, v = iou(m[0] * FW, m[1] * FH, d), row = $('.iou[data-c=' + c[0] + ']', Z.pane); $('i', row).style.width = v * 100 + '%'; $('b', row).textContent = v.toFixed(2); row.classList.toggle('sel', c[0] === Z.cls); });
    var cv = $('.ill', Z.pane), wpx = cv.clientWidth || 300, hpx = Math.round(wpx * .62), dpr = Math.min(2, devicePixelRatio || 1); cv.style.height = hpx + 'px'; cv.width = wpx * dpr; cv.height = hpx * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var w = cd.median[0] * FW, h = cd.median[1] * FH, sc = Math.min(wpx * .62 / (w + 30), hpx * .62 / (h + 30)), ox = (wpx - w * sc) / 2 - 8, oy = (hpx - h * sc) / 2 - 8, col = css(CLS.filter(function (k) { return k[0] === Z.cls; })[0][2]);
    ctx.fillStyle = col; ctx.globalAlpha = .22; ctx.fillRect(ox, oy, w * sc, h * sc); ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.strokeRect(ox, oy, w * sc, h * sc);
    var dx = d * sc; ctx.setLineDash([6, 4]); ctx.strokeStyle = css('--fg'); ctx.strokeRect(ox + dx, oy + dx, w * sc, h * sc); ctx.setLineDash([]);
    if (w > d && h > d) { ctx.fillStyle = css('--fg'); ctx.globalAlpha = .3; ctx.fillRect(ox + dx, oy + dx, (w - d) * sc, (h - d) * sc); ctx.globalAlpha = 1; }
    ctx.fillStyle = css('--muted'); ctx.font = '12px system-ui,sans-serif'; ctx.fillText(Math.round(w) + ' × ' + Math.round(h) + ' px box, shown to scale', 10, hpx - 10);
  }

  /* ---------------- wire up the cards ---------------- */
  function wire() {
    document.querySelectorAll('[data-lab]').forEach(function (card) {
      var go = function () { open(card, card.getAttribute('data-lab') === 'size' ? 1 : 0); };
      card.addEventListener('click', go);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  fetch(DATA).then(function (r) { return r.json(); }).then(function (j) { D = j; wire(); }).catch(function (e) { console.error('heatlab data failed', e); });
})();
