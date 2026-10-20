/* Shared behaviour: theme toggle, reveal-on-scroll, counters, bars, timeline progress, card spotlight, lightbox. */
(function () {
  var root = document.documentElement;

  // theme: saved choice > system preference > dark
  var saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));
  var meta = document.querySelector('meta[name="theme-color"]');
  function syncMeta() { if (meta) meta.content = root.getAttribute('data-theme') === 'light' ? '#f4f3fc' : '#05050b'; }
  syncMeta();
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncMeta(); window.dispatchEvent(new Event('themechange'));
    });
  });

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal + bars
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); if (e.target.hasAttribute('data-count')) count(e.target); } });
  }, { threshold: .15, rootMargin: '0px 0px -6% 0px' }) : null;
  document.querySelectorAll('.reveal,.bar,[data-count]').forEach(function (el) {
    if (io) io.observe(el); else { el.classList.add('in'); if (el.hasAttribute('data-count')) count(el); }
  });
  document.querySelectorAll('.reveal').forEach(function (el, i) { if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', (i % 4) * 0.08 + 's'); });

  // counters
  function count(el) {
    var end = parseFloat(el.getAttribute('data-count')), dec = +(el.getAttribute('data-dec') || 0), suf = el.getAttribute('data-suffix') || '';
    var fmt = function (v) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    if (reduce) { el.textContent = fmt(end); return; }
    var t0 = performance.now(), dur = 1700;
    (function tick(now) {
      var p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(end * e); if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // timeline progress line
  var tl = document.querySelector('.tl');
  if (tl) {
    var upd = function () {
      var r = tl.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(Math.max((vh * .6 - r.top) / r.height, 0), 1);
      tl.style.setProperty('--p', p.toFixed(4));
    };
    window.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
  }

  // card spotlight
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // lightbox
  var dlg = document.getElementById('lb');
  if (dlg && dlg.showModal) {
    var img = dlg.querySelector('img'), cap = dlg.querySelector('p');
    document.querySelectorAll('figure[data-zoom]').forEach(function (f) {
      f.tabIndex = 0; f.setAttribute('role', 'button');
      var open = function () { var i = f.querySelector('img'); img.src = i.currentSrc || i.src; img.alt = i.alt; cap.textContent = (f.querySelector('figcaption') || {}).textContent || ''; dlg.showModal(); };
      f.addEventListener('click', open); f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    dlg.addEventListener('click', function () { dlg.close(); });
  }
  var y = document.getElementById('yr'); if (y) y.textContent = new Date().getFullYear();
})();
