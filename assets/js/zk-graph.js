/* Live Obsidian-style graph of a few real notes from my Reddit-to-Zettelkasten vault.
   Posts are grey (size = the pipeline's neural weight), shared TF-IDF concepts are purple, and the
   similarity edges come from the pipeline's own review_graph.json. Drag nodes; hover or tap one to read it. */
(function () {
  var box = document.getElementById('zk-live'); if (!box) return;
  var cv = box.querySelector('canvas'), info = box.querySelector('.zk-info'), x = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch(box.getAttribute('data-src')).then(function (r) { return r.json(); }).then(start).catch(function () { box.hidden = true; });

  function start(d) {
    var N = [], E = [], byId = {};
    d.notes.forEach(function (n) { var o = { id: n.id, n: n, r: 5 + n.w * 14, post: true }; N.push(o); byId[n.id] = o; });
    d.concepts.forEach(function (c) { var o = { id: 'c:' + c, label: c, r: 6, post: false }; N.push(o); byId[o.id] = o;
      d.notes.forEach(function (n) { if (n.kw.indexOf(c) >= 0) E.push([o, byId[n.id], 0.6, true]); }); });
    d.edges.forEach(function (e) { E.push([byId[e[0]], byId[e[1]], e[2], false]); });
    var W, H, dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() { W = box.clientWidth; H = Math.max(280, Math.min(420, W * 0.62)); cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    N.forEach(function (o, i) { var a = i * 2.4; o.x = W / 2 + Math.cos(a) * W * 0.3; o.y = H / 2 + Math.sin(a) * H * 0.3; o.vx = o.vy = 0; });

    var css = getComputedStyle(document.documentElement), hot = null, drag = null, alpha = 1;
    function col(n) { return (css.getPropertyValue(n) || '#888').trim(); }
    function step() {   // ponytail: O(n^2) repulsion, fine for a few dozen nodes
      for (var i = 0; i < N.length; i++) for (var j = i + 1; j < N.length; j++) {
        var a = N[i], b = N[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.01, f = 900 / d2;
        a.vx -= dx * f / 30; a.vy -= dy * f / 30; b.vx += dx * f / 30; b.vy += dy * f / 30;
      }
      E.forEach(function (e) { var a = e[0], b = e[1], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = (d - (e[3] ? 70 : 90)) * 0.004 * (0.5 + e[2]);
        a.vx += dx / d * k * d * 0.1; a.vy += dy / d * k * d * 0.1; b.vx -= dx / d * k * d * 0.1; b.vy -= dy / d * k * d * 0.1; });
      N.forEach(function (o) { o.vx += (W / 2 - o.x) * 0.002; o.vy += (H / 2 - o.y) * 0.002;
        if (o !== drag) { o.x += o.vx * alpha; o.y += o.vy * alpha; } o.vx *= 0.82; o.vy *= 0.82;
        o.x = Math.max(o.r, Math.min(W - o.r, o.x)); o.y = Math.max(o.r, Math.min(H - o.r, o.y)); });
    }
    function linked(o) { return E.some(function (e) { return (e[0] === hot && e[1] === o) || (e[1] === hot && e[0] === o); }); }
    function draw() {
      var acc = col('--accent'), fg = col('--fg'), mut = col('--muted');
      x.clearRect(0, 0, W, H);
      E.forEach(function (e) { var on = hot && (e[0] === hot || e[1] === hot);
        x.strokeStyle = on ? acc : e[3] ? 'rgba(138,107,255,.22)' : 'rgba(160,160,190,.25)'; x.lineWidth = on ? 1.6 : 1;
        x.beginPath(); x.moveTo(e[0].x, e[0].y); x.lineTo(e[1].x, e[1].y); x.stroke(); });
      N.forEach(function (o) { var dim = hot && o !== hot && !linked(o);
        x.globalAlpha = dim ? 0.25 : 1; x.fillStyle = o.post ? (o === hot ? fg : '#a9a7c4') : acc;
        x.beginPath(); x.arc(o.x, o.y, o.r, 0, 6.283); x.fill();
        x.fillStyle = o.post ? '#8f8daa' : '#ecebff'; x.font = (o.post ? '500 10px' : '700 12px') + ' system-ui, sans-serif'; x.textAlign = 'center';
        x.fillText(o.post ? 'r/' + o.n.sub : o.label, o.x, o.y + o.r + 12); x.globalAlpha = 1; });
    }
    function loop() { if (alpha > 0.02 || drag) { step(); alpha *= 0.995; } draw(); if (!reduce) requestAnimationFrame(loop); }
    if (reduce) { for (var k = 0; k < 400; k++) step(); draw(); } else loop();

    function at(ev) { var r = cv.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top, best = null;
      N.forEach(function (o) { var d = Math.hypot(o.x - px, o.y - py); if (d < o.r + 8 && (!best || d < best.d)) best = { o: o, d: d }; });
      return { o: best && best.o, px: px, py: py }; }
    function show(o) { hot = o;
      if (!o) { info.innerHTML = info.getAttribute('data-hint'); }
      else if (o.post) { info.innerHTML = '<b></b><span></span>'; info.firstChild.textContent = o.n.title;
        info.lastChild.textContent = 'r/' + o.n.sub + ' · weight ' + o.n.w + ' · PageRank ' + o.n.pr + ' · ' + o.n.kw.slice(0, 6).join(', '); }
      else { var c = E.filter(function (e) { return e[0] === o; }).length; info.innerHTML = '<b></b><span></span>'; info.firstChild.textContent = 'Concept: ' + o.label; info.lastChild.textContent = 'shared by ' + c + ' notes'; }
      if (reduce) draw(); }
    cv.addEventListener('pointerdown', function (ev) { var h = at(ev); if (h.o) { drag = h.o; cv.setPointerCapture(ev.pointerId); alpha = 1; } show(h.o); });
    cv.addEventListener('pointermove', function (ev) { var h = at(ev); if (drag) { drag.x = h.px; drag.y = h.py; if (reduce) { step(); draw(); } } else if (ev.pointerType === 'mouse' && h.o !== hot) show(h.o); });
    cv.addEventListener('pointerup', function () { drag = null; });
    show(null);
  }
})();
