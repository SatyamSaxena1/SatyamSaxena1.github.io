/* Gallery: reads the manifest, builds filter chips and a masonry grid, and opens a lightbox with previous/next, keyboard and swipe. */
(function () {
  var grid = document.getElementById('grid'), chips = document.getElementById('chips'), count = document.getElementById('count');
  var dlg = document.getElementById('viewer'); if (!grid || !dlg) return;
  var BASE = grid.getAttribute('data-base'), items = [], view = [], cur = 0, active = 'All';
  var img = dlg.querySelector('img'), cap = dlg.querySelector('.cap'), pos = dlg.querySelector('.pos');

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    view = items.filter(function (m) { return active === 'All' || m.group === active; });
    grid.innerHTML = '';
    view.forEach(function (m, i) {
      var f = el('figure', 'g-item'); f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', m.title);
      f.innerHTML = '<img loading="lazy" decoding="async" src="' + BASE + m.file + '" alt="' + esc(m.title + '. ' + m.caption) + '"><figcaption><b>' + esc(m.title) + '</b><span>' + esc(m.group) + '</span></figcaption>';
      f.addEventListener('click', function () { open(i); });
      f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
      grid.appendChild(f);
    });
    count.textContent = view.length + ' of ' + items.length + ' images';
  }
  function open(i) { cur = (i + view.length) % view.length; show(); if (!dlg.open) dlg.showModal(); }
  function show() {
    var m = view[cur]; img.src = BASE + m.file; img.alt = m.title;
    cap.innerHTML = '<b>' + esc(m.title) + '</b><span>' + esc(m.caption) + '</span>'; pos.textContent = (cur + 1) + ' / ' + view.length + '  ·  ' + m.group;
    var nx = view[(cur + 1) % view.length], pv = view[(cur - 1 + view.length) % view.length]; [nx, pv].forEach(function (n) { var p = new Image(); p.src = BASE + n.file; });
  }
  dlg.querySelector('.prev').addEventListener('click', function (e) { e.stopPropagation(); open(cur - 1); });
  dlg.querySelector('.next').addEventListener('click', function (e) { e.stopPropagation(); open(cur + 1); });
  dlg.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') open(cur + 1); else if (e.key === 'ArrowLeft') open(cur - 1); });
  var x0 = null; dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) { if (x0 == null) return; var d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) open(cur + (d < 0 ? 1 : -1)); x0 = null; }, { passive: true });

  fetch(grid.getAttribute('data-manifest')).then(function (r) { return r.json(); }).then(function (d) {
    items = d.items; var groups = ['All']; items.forEach(function (m) { if (groups.indexOf(m.group) < 0) groups.push(m.group); });
    groups.forEach(function (g) {
      var n = g === 'All' ? items.length : items.filter(function (m) { return m.group === g; }).length;
      var b = el('button', 'chip', esc(g) + ' <i>' + n + '</i>'); b.type = 'button'; b.setAttribute('aria-pressed', g === 'All' ? 'true' : 'false');
      b.addEventListener('click', function () { active = g; chips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); render(); window.scrollTo({ top: grid.offsetTop - 180, behavior: 'smooth' }); });
      chips.appendChild(b);
    });
    render();
  }).catch(function () { grid.textContent = 'The gallery could not load.'; });
})();
