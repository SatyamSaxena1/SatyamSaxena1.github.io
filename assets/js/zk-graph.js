/* Live Obsidian-style graph of the safe-for-work notes from my Reddit-to-Zettelkasten vault (Aug 2025 export).
   Posts are coloured by topic and sized by the pipeline's neural weight; the most shared TF-IDF concepts glow,
   sized by how many posts mention them. Layout is d3-force (the kind of physics Obsidian's graph uses);
   drawing, hover fades, zoom and pan are hand-rolled on a 2D canvas. */
(function () {
  var box = document.getElementById('zk-live'); if (!box || !window.d3 || !d3.forceSimulation) { if (box) box.hidden = true; return; }
  var cv = box.querySelector('canvas'), x = cv.getContext('2d'), info = box.querySelector('.zk-info');
  var tip = box.querySelector('.zk-tip'), legend = box.querySelector('.zk-legend');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CATS = [
    { k: 'ai', name: 'AI & ML', col: '#8a6bff', subs: 'learnmachinelearning LocalLLaMA ChatGPTCoding StableDiffusion ChatGPTPro LangChain ClaudeAI ChatGPT MachineLearning LocalLLM Oobabooga datascience AutoGPT AI_Agents ollama comfyui aiArt HPC' },
    { k: 'career', name: 'Careers & study', col: '#ffb870', subs: 'csMajors developersIndia gradadmissions Indians_StudyAbroad PhD leetcode GRE resumes cscareerquestions jobsearchhacks RemoteJobseekers postdoc MBA IntltoUSA ycombinator IndianEngineers StartUpIndia scrum codingbootcamp explainlikeimfive softwarearchitecture' },
    { k: 'hw', name: 'Hardware & iOS', col: '#59e0a5', subs: 'jailbreak ZephyrusM16 sideloaded GamingLaptops Piracy tech technews RealDebrid LegacyJailbreak eGPU Addons4Kodi setupapp AltStore StremioAddons AV1 FPGA flipperzero selfhosted pcmasterrace macbook Windows10 RISCV storage DataHoarder EmulationOnAndroid privacytoolsIO' },
    { k: 'film', name: 'Film & cameras', col: '#ff7eb6', subs: 'cinematography AnalogCommunity hometheater movies VintageLenses imax Screenwriting projectors SonyAlpha unrealengine4 TrueFilm' }
  ];
  var catOf = {}; CATS.forEach(function (c) { c.n = 0; c.subs.split(' ').forEach(function (s) { catOf[s] = c; }); });

  fetch(box.getAttribute('data-src')).then(function (r) { return r.json(); }).then(start).catch(function () { box.hidden = true; });

  function start(d) {
    var N = [], L = [], byId = {};
    d.notes.forEach(function (n) { var c = catOf[n.sub] || CATS[0]; c.n++;
      var o = { id: n.id, n: n, post: true, cat: c, r: 2.2 + n.w * 5, deg: 0 }; N.push(o); byId[n.id] = o; });
    d.concepts.forEach(function (c) { var o = { id: 'c:' + c, label: c, post: false, deg: 0 }; N.push(o); byId[o.id] = o;
      d.notes.forEach(function (n) { if (n.kw.indexOf(c) >= 0) L.push({ source: o, target: byId[n.id] }); }); });
    L.forEach(function (l) { l.source.deg++; l.target.deg++; });
    N.forEach(function (o, i) {
      if (!o.post) o.r = 3.5 + Math.sqrt(o.deg) * 1.35;
      o.nb = [];   // neighbours, for hover
      o.h = 0; o.f = 1; o.born = reduce ? -9 : (o.post ? 0.25 + Math.random() * 0.9 : Math.random() * 0.35);
    });
    L.forEach(function (l) { l.source.nb.push(l.target); l.target.nb.push(l.source); });

    // ---------- canvas sizing ----------
    var W, H, dpr = Math.min(2, window.devicePixelRatio || 1), bgGrad;
    function size() {
      W = box.clientWidth; H = W < 600 ? Math.min(560, W * 1.3) : Math.max(380, Math.min(580, W * 0.72));
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
      bgGrad = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bgGrad.addColorStop(0, '#1d1a2e'); bgGrad.addColorStop(1, '#0d0c14');
    }
    size();
    N.forEach(function (o, i) { var a = i * 2.4, r = 6 * Math.sqrt(i); o.x = W / 2 + Math.cos(a) * r; o.y = H / 2 + Math.sin(a) * r; });

    // a soft glow sprite, drawn once and stamped behind concept nodes
    var glow = document.createElement('canvas'); glow.width = glow.height = 64;
    var gx = glow.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, 'rgba(160,135,255,.55)'); gg.addColorStop(0.4, 'rgba(138,107,255,.18)'); gg.addColorStop(1, 'rgba(138,107,255,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);

    // ---------- physics ----------
    var sim = d3.forceSimulation(N)
      .force('link', d3.forceLink(L).distance(function (l) { return 26 + l.source.r * 1.5; }).strength(function (l) { return 0.9 / Math.min(l.source.deg, l.target.deg); }))
      .force('charge', d3.forceManyBody().strength(function (o) { return o.post ? -12 : -40 - o.deg * 3; }).distanceMax(320))
      .force('collide', d3.forceCollide(function (o) { return o.r + 1.5; }).iterations(2))
      .force('x', d3.forceX(W / 2)).force('y', d3.forceY(H / 2))
      .alphaDecay(0.018).velocityDecay(0.32).stop();
    function shape() { sim.force('x').x(W / 2).strength(0.07 * Math.sqrt(H / W)); sim.force('y').y(H / 2).strength(0.07 * Math.sqrt(W / H)); }   // squeeze to the canvas's shape
    shape();

    // ---------- view: eased zoom and pan ----------
    var view = { k: 1, tx: 0, ty: 0 }, goal = { k: 1, tx: 0, ty: 0 };
    function toWorld(px, py) { return [(px - view.tx) / view.k, (py - view.ty) / view.k]; }
    var autoFit = true;
    function fit() {   // frame the whole graph, leaving room for the legend bar on top
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      N.forEach(function (o) { x0 = Math.min(x0, o.x - o.r); y0 = Math.min(y0, o.y - o.r); x1 = Math.max(x1, o.x + o.r); y1 = Math.max(y1, o.y + o.r); });
      var top = 52, pad = 14, k = Math.min(1.6, (W - pad * 2) / (x1 - x0), (H - top - pad) / (y1 - y0));
      goal.k = k; goal.tx = (W - (x1 - x0) * k) / 2 - x0 * k; goal.ty = top + (H - top - pad - (y1 - y0) * k) / 2 - y0 * k;
    }
    function zoomAt(px, py, f) {
      autoFit = false;
      var k = Math.max(0.6, Math.min(4, goal.k * f)), wx = (px - goal.tx) / goal.k, wy = (py - goal.ty) / goal.k;
      goal.k = k; goal.tx = px - wx * k; goal.ty = py - wy * k; wake();
    }

    // ---------- state ----------
    var hot = null, cat = null, drag = null, pan = null, pinch = null, pointers = {}, t0 = performance.now(), last = t0, running = false, visible = true, seen = !('IntersectionObserver' in window);
    function focusOf(o) {   // 1 = in focus, 0 = faded
      if (hot) return o === hot || hot.nb.indexOf(o) >= 0 ? 1 : 0;
      if (cat) return o.post ? (o.cat === cat ? 1 : 0) : (o.nb.some(function (p) { return p.cat === cat; }) ? 1 : 0);
      return 1;
    }
    function easeBack(t) { t = Math.min(1, Math.max(0, t)); var s = 1.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }

    function frame(now) {
      running = false;
      var dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      if (sim.alpha() > sim.alphaMin() || drag) { sim.tick(); if (autoFit && !drag) fit(); }
      var busy = sim.alpha() > sim.alphaMin() || !!drag || t < 1.6;
      // ease view and highlight values
      var e = reduce ? 1 : 1 - Math.exp(-dt * 12);
      ['k', 'tx', 'ty'].forEach(function (p) { view[p] += (goal[p] - view[p]) * e; if (Math.abs(goal[p] - view[p]) > 0.002) busy = true; });
      N.forEach(function (o) {
        var tf = focusOf(o), th = o === hot ? 1 : 0;
        o.f += (tf - o.f) * e; o.h += (th - o.h) * e;
        if (Math.abs(tf - o.f) > 0.01 || Math.abs(th - o.h) > 0.01) busy = true;
        o.s = reduce ? 1 : easeBack((t - o.born) / 0.55);
      });
      draw(t);
      if (busy) wake();
    }
    function wake() { if (!running && visible) { running = true; requestAnimationFrame(frame); } }

    // ---------- drawing ----------
    function draw() {
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = bgGrad; x.fillRect(0, 0, W, H);
      x.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
      var anyFocus = !!(hot || cat), lw = 0.7 / view.k;

      // background edges in one path; edges touching the focus drawn on top in the post's colour
      x.beginPath();
      L.forEach(function (l) { var a = l.source, b = l.target; if (a.s < 0.3 || b.s < 0.3) return; if (anyFocus && a.f > 0.5 && b.f > 0.5) return;
        x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); });
      x.strokeStyle = anyFocus ? 'rgba(150,140,220,.035)' : 'rgba(150,140,220,.11)'; x.lineWidth = lw; x.stroke();
      if (anyFocus) L.forEach(function (l) { var a = l.source, b = l.target, f = Math.min(a.f, b.f); if (f < 0.05) return;
        x.globalAlpha = f * 0.75; x.strokeStyle = b.cat ? b.cat.col : '#b9a8ff'; x.lineWidth = (hot ? 1.3 : 0.9) / view.k;
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
      x.globalAlpha = 1;

      // posts
      N.forEach(function (o) { if (!o.post || o.s <= 0) return;
        x.globalAlpha = (0.25 + 0.75 * o.f) * Math.min(1, o.s);
        x.fillStyle = o.cat.col; x.beginPath(); x.arc(o.x, o.y, o.r * o.s * (1 + o.h * 0.6), 0, 6.283); x.fill();
        if (o.h > 0.02) { x.globalAlpha = o.h; x.strokeStyle = '#fff'; x.lineWidth = 1.5 / view.k; x.stroke(); }
      });
      // concepts: glow, core, ring
      N.forEach(function (o) { if (o.post || o.s <= 0) return;
        var r = o.r * o.s * (1 + o.h * 0.35), a = (0.2 + 0.8 * o.f) * Math.min(1, o.s);
        x.globalAlpha = a * (0.55 + o.h * 0.45); x.drawImage(glow, o.x - r * 3.2, o.y - r * 3.2, r * 6.4, r * 6.4);
        x.globalAlpha = a; x.fillStyle = '#efeaff'; x.beginPath(); x.arc(o.x, o.y, r, 0, 6.283); x.fill();
        x.strokeStyle = '#8a6bff'; x.lineWidth = 2 / view.k; x.stroke();
      });
      // labels: concepts by size (more appear as you zoom in), plus the hovered post
      x.textAlign = 'center'; x.lineJoin = 'round';
      N.forEach(function (o) {
        var show = o.post ? o.h : Math.max(o.h, Math.min(1, (o.deg * view.k - 9) / 10));
        if (show < 0.03 || o.s < 0.5) return;
        var fs = (o.post ? 11 : 10.5 + Math.min(4, o.deg / 12)) / view.k, txt = o.post ? 'r/' + o.n.sub : o.label;
        x.font = (o.post ? '600 ' : '700 ') + fs + 'px system-ui, -apple-system, sans-serif';
        x.globalAlpha = show * (0.15 + 0.85 * o.f);
        x.strokeStyle = 'rgba(13,12,20,.85)'; x.lineWidth = 3 / view.k; x.strokeText(txt, o.x, o.y + o.r * o.s + fs + 1 / view.k);
        x.fillStyle = o.post ? o.cat.col : '#f3f0ff'; x.fillText(txt, o.x, o.y + o.r * o.s + fs + 1 / view.k);
      });
      x.globalAlpha = 1;
      placeTip();
    }

    // ---------- tooltip and info line ----------
    function placeTip() {
      if (!hot) { tip.classList.remove('on'); return; }
      var px = hot.x * view.k + view.tx, py = hot.y * view.k + view.ty, w = tip.offsetWidth;
      tip.style.transform = 'translate(' + Math.round(Math.max(8, Math.min(W - w - 8, px - w / 2))) + 'px,' + Math.round(py > 110 ? py - tip.offsetHeight - 14 : py + 18) + 'px)';
      tip.classList.add('on');
    }
    function show(o) {
      if (o === hot) return; hot = o;
      if (!o) info.innerHTML = info.getAttribute('data-hint');
      else {
        tip.innerHTML = '<b></b><span></span>';
        tip.firstChild.textContent = o.post ? o.n.title : o.label;
        tip.lastChild.textContent = o.post ? 'r/' + o.n.sub + ' · ' + o.n.kw.slice(0, 5).join(', ') : 'concept · in ' + o.deg + ' of these notes';
        info.textContent = (o.post ? o.n.title + ' (r/' + o.n.sub + ')' : 'Concept: ' + o.label + ', in ' + o.deg + ' notes');
      }
      wake();
    }

    // ---------- legend: filter by topic ----------
    CATS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<i></i><span></span><em></em>'; b.firstChild.style.background = c.col; b.children[1].textContent = c.name; b.lastChild.textContent = c.n;
      b.addEventListener('click', function () { cat = cat === c ? null : c;
        [].forEach.call(legend.children, function (el) { el.setAttribute('aria-pressed', String(el === b && cat === c)); }); wake(); });
      legend.appendChild(b);
    });

    // ---------- pointer: hover, drag nodes, pan, pinch ----------
    function local(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function hit(px, py) { var w = toWorld(px, py), best = null, bd = 1e9;
      N.forEach(function (o) { var dd = Math.hypot(o.x - w[0], o.y - w[1]); if (dd < o.r + 7 / view.k && dd < bd) { bd = dd; best = o; } }); return best; }
    cv.addEventListener('pointerdown', function (ev) {
      var p = local(ev); pointers[ev.pointerId] = p; cv.setPointerCapture(ev.pointerId);
      var ids = Object.keys(pointers);
      if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: goal.k }; drag = pan = null; return; }
      var o = hit(p[0], p[1]);
      if (o) { drag = o; var w = toWorld(p[0], p[1]); o.fx = w[0]; o.fy = w[1]; sim.alphaTarget(0.22).restart().stop(); show(o); }
      else { autoFit = false; pan = { x: p[0], y: p[1], tx: goal.tx, ty: goal.ty, moved: false }; cv.style.cursor = 'grabbing'; }
      wake();
    });
    cv.addEventListener('pointermove', function (ev) {
      var p = local(ev);
      if (pointers[ev.pointerId]) pointers[ev.pointerId] = p;
      if (pinch) { var ids = Object.keys(pointers); if (ids.length < 2) return; var a = pointers[ids[0]], b = pointers[ids[1]];
        var k = Math.max(0.6, Math.min(4, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, k / goal.k); return; }
      if (drag) { var w = toWorld(p[0], p[1]); drag.fx = w[0]; drag.fy = w[1]; if (reduce) { drag.x = w[0]; drag.y = w[1]; } wake(); return; }
      if (pan) { pan.moved = pan.moved || Math.hypot(p[0] - pan.x, p[1] - pan.y) > 4; goal.tx = pan.tx + p[0] - pan.x; goal.ty = pan.ty + p[1] - pan.y; view.tx = goal.tx; view.ty = goal.ty; wake(); return; }
      if (ev.pointerType === 'mouse') { var o = hit(p[0], p[1]); cv.style.cursor = o ? 'pointer' : 'grab'; show(o); }
    });
    function up(ev) {
      delete pointers[ev.pointerId]; if (Object.keys(pointers).length < 2) pinch = null;
      if (drag) { drag.fx = drag.fy = null; drag = null; sim.alphaTarget(0); }
      if (pan) { if (!pan.moved && ev.pointerType !== 'mouse') show(null); pan = null; cv.style.cursor = 'grab'; }
      wake();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && !drag) show(null); });
    // page scroll stays normal on phones; a touch that starts on a node, or two fingers, belongs to the graph
    cv.addEventListener('touchstart', function (ev) {
      var r = cv.getBoundingClientRect(), tt = ev.touches[0];
      if (ev.touches.length > 1 || hit(tt.clientX - r.left, tt.clientY - r.top)) ev.preventDefault();
    }, { passive: false });
    // trackpad pinch and Ctrl/Cmd + wheel zoom; a plain wheel still scrolls the page
    cv.addEventListener('wheel', function (ev) { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); var p = local(ev); zoomAt(p[0], p[1], Math.exp(-ev.deltaY * 0.004)); }, { passive: false });
    box.querySelector('[data-zoom="in"]').addEventListener('click', function () { zoomAt(W / 2, H / 2, 1.4); });
    box.querySelector('[data-zoom="out"]').addEventListener('click', function () { zoomAt(W / 2, H / 2, 1 / 1.4); });
    box.querySelector('[data-zoom="reset"]').addEventListener('click', function () { fit(); autoFit = true; wake(); });

    window.addEventListener('resize', function () { var ow = W; size(); if (Math.abs(ow - W) > 2) { shape(); sim.alpha(0.3); autoFit = true; } wake(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { last = performance.now(); if (!seen) { seen = true; t0 = last; } wake(); } }).observe(box);
    if (reduce) { for (var i = 0; i < 320; i++) sim.tick(); fit(); view.k = goal.k; view.tx = goal.tx; view.ty = goal.ty; }
    show(null); wake();
  }
})();
