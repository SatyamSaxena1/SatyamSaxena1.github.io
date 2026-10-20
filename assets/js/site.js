/* Shared behaviour: theme toggle, reveal-on-scroll, counters, bars, timeline progress, card spotlight, lightbox. */
(function () {
  var root = document.documentElement;

  // <dialog> shim for iOS before 15.4: just enough of showModal/close/open for the viewer and the heat lab
  if (!('showModal' in document.createElement('dialog'))) {
    root.classList.add('no-dialog');
    var P = HTMLElement.prototype;
    Object.defineProperty(P, 'open', { configurable: true, get: function () { return this.hasAttribute('open'); }, set: function (v) { if (v) this.setAttribute('open', ''); else this.removeAttribute('open'); } });
    P.showModal = P.show = function () { this.setAttribute('open', ''); };
    P.close = function () { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; var d = document.querySelectorAll('dialog[open]'); if (d.length) d[d.length - 1].close(); });
  }

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
      function apply() {
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        syncMeta(); window.dispatchEvent(new Event('themechange'));
      }
      // WebKit/Chromium View Transition: the new theme grows as a circle from the toggle
      if (!document.startViewTransition || reduce || document.hidden) return apply();
      var r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      root.style.setProperty('--vx', x + 'px'); root.style.setProperty('--vy', y + 'px');
      root.style.setProperty('--vr', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      root.classList.add('vt-theme');
      var vt = document.startViewTransition(apply);
      vt.ready.catch(function () {}); // an aborted transition still applies the theme; nothing to report
      vt.finished.finally(function () { root.classList.remove('vt-theme'); });
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
    var open = function (f) { var i = f.querySelector('img'); img.src = i.currentSrc || i.src; img.alt = i.alt; cap.textContent = (f.querySelector('figcaption') || {}).textContent || ''; dlg.showModal(); };
    document.querySelectorAll('figure[data-zoom]').forEach(function (f) { f.tabIndex = 0; f.setAttribute('role', 'button'); });
    document.addEventListener('click', function (e) { var f = e.target.closest && e.target.closest('figure[data-zoom]'); if (f) open(f); });
    document.addEventListener('keydown', function (e) { var f = e.target.closest && e.target.closest('figure[data-zoom]'); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(f); } });
    dlg.addEventListener('click', function () { dlg.close(); });
  }
  document.querySelectorAll('button.yt').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + b.getAttribute('data-yt') + '?autoplay=1&rel=0'; f.title = b.getAttribute('aria-label').replace('Play video: ', '');
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.className = 'yt-frame'; b.replaceWith(f); f.focus();
    });
  });
  var hk = document.getElementById('hw-hook');
  document.querySelectorAll('.hook video, video[data-auto]').forEach(function (v) {
    v.muted = true; var go = function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    go(); v.addEventListener('loadeddata', go); document.addEventListener('pointerdown', go, { once: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) go(); else v.pause(); }); }).observe(v);
  });
  if (hk) hk.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hk.click(); } });
  if (hk) hk.addEventListener('click', function () {
    var on = hk.getAttribute('aria-expanded') !== 'true', c = document.getElementById('hw-chapters');
    hk.setAttribute('aria-expanded', on); c.classList.toggle('open', on); hk.querySelector('.hook-label').textContent = on ? 'Hide the story' : 'See how it was made';
    if (on) setTimeout(function () { c.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }, 120);
  });
  var y = document.getElementById('yr'); if (y) y.textContent = new Date().getFullYear();
})();
