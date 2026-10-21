/* Live Obsidian-style graph of the safe-for-work notes from my Reddit-to-Zettelkasten vault (Aug 2025 export).
   Posts are grey (size = the pipeline's neural weight), the most shared TF-IDF concepts are purple,
   and each post links to the concepts it mentions. Layout is d3-force, the same kind of physics
   Obsidian's graph view uses. Drag nodes; hover or tap one to read it. */
(function () {
  var box = document.getElementById('zk-live'); if (!box || !window.d3 || !d3.forceSimulation) { if (box) box.hidden = true; return; }
  var cv = box.querySelector('canvas'), info = box.querySelector('.zk-info'), x = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch(box.getAttribute('data-src')).then(function (r) { return r.json(); }).then(start).catch(function () { box.hidden = true; });

  function start(d) {
    var N = [], L = [], byId = {};
    d.notes.forEach(function (n) { var o = { id: n.id, n: n, r: 2.5 + n.w * 6, post: true, deg: 0 }; N.push(o); byId[n.id] = o; });
    d.concepts.forEach(function (c) { var o = { id: 'c:' + c, label: c, r: 7, post: false, deg: 0 }; N.push(o); byId[o.id] = o;
      d.notes.forEach(function (n) { if (n.kw.indexOf(c) >= 0) L.push({ source: o, target: byId[n.id] }); }); });
    L.forEach(function (l) { l.source.deg++; l.target.deg++; });
    var W, H, dpr = Math.min(2, window.devicePixelRatio || 1);
    function size() { W = box.clientWidth; H = Math.max(360, Math.min(560, W * 0.75)); cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    N.forEach(function (o, i) { var a = i * 2.4, r = 8 * Math.sqrt(i); o.x = W / 2 + Math.cos(a) * r; o.y = H / 2 + Math.sin(a) * r; });   // d3 seeds around (0,0) otherwise

    var sim = d3.forceSimulation(N)
      .force('link', d3.forceLink(L).distance(36).strength(function (l) { return 1 / Math.min(l.source.deg, l.target.deg); }))
      .force('charge', d3.forceManyBody().strength(function (o) { return o.post ? -14 : -160; }))
      .force('collide', d3.forceCollide(function (o) { return o.r + 1.5; }))
      .force('x', d3.forceX(W / 2).strength(0.05)).force('y', d3.forceY(H / 2).strength(0.07))
      .on('tick', draw);
    if (reduce) { sim.stop(); for (var i = 0; i < 300; i++) sim.tick(); draw(); }
    window.addEventListener('resize', function () { size(); sim.force('x').x(W / 2); sim.force('y').y(H / 2); sim.alpha(0.3).restart(); });

    var css = getComputedStyle(document.documentElement), hot = null, drag = null;
    function col(n) { return (css.getPropertyValue(n) || '#888').trim(); }
    function linked(o) { return L.some(function (l) { return (l.source === hot && l.target === o) || (l.target === hot && l.source === o); }); }
    function draw() {
      var acc = col('--accent');
      N.forEach(function (o) { o.x = Math.max(o.r, Math.min(W - o.r, o.x)); o.y = Math.max(o.r, Math.min(H - o.r, o.y)); });
      x.clearRect(0, 0, W, H);
      L.forEach(function (l) { var on = hot && (l.source === hot || l.target === hot);
        x.strokeStyle = on ? acc : 'rgba(138,107,255,.13)'; x.lineWidth = on ? 1.4 : 0.8;
        x.beginPath(); x.moveTo(l.source.x, l.source.y); x.lineTo(l.target.x, l.target.y); x.stroke(); });
      N.forEach(function (o) { var dim = hot && o !== hot && !linked(o);
        x.globalAlpha = dim ? 0.2 : 1; x.fillStyle = o.post ? (o === hot ? '#ffffff' : '#a9a7c4') : acc;
        x.beginPath(); x.arc(o.x, o.y, o.r, 0, 6.283); x.fill();
        if (!o.post || o === hot) { x.fillStyle = o.post ? '#8f8daa' : '#ecebff'; x.font = (o.post ? '500 10px' : '700 12px') + ' system-ui, sans-serif'; x.textAlign = 'center';
          x.fillText(o.post ? 'r/' + o.n.sub : o.label, o.x, o.y + o.r + 12); }
        x.globalAlpha = 1; });
    }

    function at(ev) { var r = cv.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top, best = null;
      N.forEach(function (o) { var dd = Math.hypot(o.x - px, o.y - py); if (dd < o.r + 8 && (!best || dd < best.d)) best = { o: o, d: dd }; });
      return { o: best && best.o, px: px, py: py }; }
    function show(o) { hot = o;
      if (!o) { info.innerHTML = info.getAttribute('data-hint'); }
      else if (o.post) { info.innerHTML = '<b></b><span></span>'; info.firstChild.textContent = o.n.title;
        info.lastChild.textContent = 'r/' + o.n.sub + ' · weight ' + o.n.w + ' · ' + o.n.kw.slice(0, 6).join(', '); }
      else { info.innerHTML = '<b></b><span></span>'; info.firstChild.textContent = 'Concept: ' + o.label; info.lastChild.textContent = 'in ' + o.deg + ' of these notes'; }
      draw(); }
    cv.addEventListener('pointerdown', function (ev) { var h = at(ev); if (h.o) { drag = h.o; drag.fx = h.px; drag.fy = h.py; cv.setPointerCapture(ev.pointerId); if (!reduce) sim.alphaTarget(0.25).restart(); } show(h.o); });
    cv.addEventListener('pointermove', function (ev) { var h = at(ev); if (drag) { drag.fx = h.px; drag.fy = h.py; if (reduce) { drag.x = h.px; drag.y = h.py; draw(); } } else if (ev.pointerType === 'mouse' && h.o !== hot) show(h.o); });
    cv.addEventListener('pointerup', function () { if (drag) { drag.fx = drag.fy = null; drag = null; sim.alphaTarget(0); } });
    show(null);
  }
})();
