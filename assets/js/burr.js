/* Burrs: right-click anywhere on blinkedit.me to stick a comment to that spot.
   Everyone sees every burr, live. Text is always rendered as text (never HTML). */
(function () {
  'use strict';
  var CFG = { url: 'SUPABASE_URL', key: 'SUPABASE_PUBLISHABLE_KEY' };
  var host = location.hostname;
  var preview = /[?&]burr=1\b/.test(location.search);
  // Only the memorable site gets the playful layer; the professional one stays plain.
  if (host !== 'blinkedit.me' && !preview) return;
  if (/^SUPABASE_/.test(CFG.url)) return;

  var page = location.pathname.replace(/index\.html$/, '');
  var REST = CFG.url + '/rest/v1/burrs';
  var H = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' };
  var layer = document.createElement('div');
  layer.className = 'burr-layer';
  document.body.appendChild(layer);
  var seen = {};
  var open = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function docW() { return document.documentElement.scrollWidth; }

  function burrSvg() {
    var s = 'http://www.w3.org/2000/svg', svg = document.createElementNS(s, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40'); svg.setAttribute('aria-hidden', 'true');
    var g = document.createElementNS(s, 'g'), i, a, l;
    for (i = 0; i < 16; i++) {
      a = i * Math.PI / 8; l = document.createElementNS(s, 'line');
      l.setAttribute('x1', (Math.cos(a) * 9).toFixed(1)); l.setAttribute('y1', (Math.sin(a) * 9).toFixed(1));
      l.setAttribute('x2', (Math.cos(a) * 18).toFixed(1)); l.setAttribute('y2', (Math.sin(a) * 18).toFixed(1));
      g.appendChild(l);
    }
    var c = document.createElementNS(s, 'circle'); c.setAttribute('r', '10');
    svg.appendChild(g); svg.appendChild(c);
    return svg;
  }

  function closeCard() { if (open) { open.remove(); open = null; } }
  function place(card, px, py) {
    document.body.appendChild(card);
    var w = card.offsetWidth, x = Math.min(Math.max(8, px - w / 2), docW() - w - 8);
    card.style.left = x + 'px'; card.style.top = (py + 22) + 'px';
  }

  function showBurr(b) {
    closeCard();
    var card = el('div', 'burr-card' + (b.plucked_at ? ' is-plucked' : ''));
    card.setAttribute('role', 'dialog');
    if (b.plucked_at) card.appendChild(el('p', 'burr-ghost-note', 'Plucked. This is what it said:'));
    card.appendChild(el('p', 'burr-body', b.body));
    if (b.reply) card.appendChild(el('p', 'burr-reply', b.reply));
    var x = el('button', 'burr-x', 'close'); x.type = 'button'; x.onclick = closeCard;
    card.appendChild(x);
    place(card, b.x * docW(), b.y); open = card;
  }

  function renderBurr(b) {
    var n = seen[b.id];
    if (!n) {
      n = el('button', 'burr'); n.type = 'button'; n.appendChild(burrSvg());
      layer.appendChild(n); seen[b.id] = n;
    }
    n.className = 'burr' + (b.plucked_at ? ' is-plucked' : '') + (b.reply ? ' has-reply' : '');
    n.setAttribute('aria-label', b.plucked_at ? 'Plucked burr' : 'Burr comment');
    n.style.left = (b.x * docW()) + 'px'; n.style.top = b.y + 'px';
    n.onclick = function (e) { e.stopPropagation(); showBurr(b); };
    n._b = b;
  }

  function newForm(px, py) {
    closeCard();
    var card = el('form', 'burr-card burr-new');
    card.appendChild(el('p', 'burr-hint', 'Stick a burr here. Anyone can read it, nobody has to know it’s you.'));
    var ta = el('textarea'); ta.maxLength = 500; ta.rows = 4; ta.required = true;
    ta.placeholder = 'Ask something, suggest a project, say what you think…';
    var row = el('div', 'burr-row'), go = el('button', null, 'Stick it'), cancel = el('button', 'ghost', 'Cancel');
    go.type = 'submit'; cancel.type = 'button'; cancel.onclick = closeCard;
    var msg = el('p', 'burr-msg'); msg.setAttribute('role', 'status');
    row.appendChild(go); row.appendChild(cancel);
    card.appendChild(ta); card.appendChild(row); card.appendChild(msg);
    card.onsubmit = function (e) {
      e.preventDefault();
      var body = ta.value.trim(); if (!body) return;
      go.disabled = true; msg.textContent = '';
      var row = { page: page, x: Math.round(px / docW() * 10000) / 10000, y: Math.round(py), body: body };
      fetch(REST, { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify(row) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (a) { renderBurr(a[0]); closeCard(); })
        .catch(function () { go.disabled = false; msg.textContent = 'Could not stick that one. Try again in a bit.'; });
    };
    place(card, px, py); open = card; ta.focus();
  }

  function load() {
    fetch(REST + '?select=*&page=eq.' + encodeURIComponent(page) + '&order=created_at.asc&limit=500', { headers: H })
      .then(function (r) { return r.json(); })
      .then(function (a) { if (Array.isArray(a)) a.forEach(renderBurr); })
      .catch(function () {});
  }

  function live() {
    // Realtime over a plain websocket (Supabase Realtime protocol), so no library is needed.
    var ws, beat, ref = 0;
    function send(t, p) { ws.send(JSON.stringify({ topic: t, event: p.event, payload: p.payload || {}, ref: String(++ref) })); }
    function connect() {
      ws = new WebSocket(CFG.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(CFG.key) + '&vsn=1.0.0');
      ws.onopen = function () {
        send('realtime:burrs', { event: 'phx_join', payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'burrs', filter: 'page=eq.' + page }] } } });
        beat = setInterval(function () { send('phoenix', { event: 'heartbeat' }); }, 25000);
      };
      ws.onmessage = function (m) {
        try {
          var d = JSON.parse(m.data), c = d.payload && d.payload.data;
          if (d.event === 'postgres_changes' && c && c.record && c.record.id) renderBurr(c.record);
        } catch (e) {}
      };
      ws.onclose = function () { clearInterval(beat); setTimeout(connect, 5000); };
    }
    connect();
  }

  document.addEventListener('contextmenu', function (e) {
    if (e.shiftKey || e.target.closest('a,input,textarea,.burr-card')) return; // Shift+right-click keeps the normal menu
    e.preventDefault(); newForm(e.pageX, e.pageY);
  });
  document.addEventListener('click', function (e) { if (open && !e.target.closest('.burr-card,.burr')) closeCard(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });
  window.addEventListener('resize', function () { Object.keys(seen).forEach(function (id) { renderBurr(seen[id]._b); }); });

  // Touch screens have no right-click: a small corner button does the same job.
  if (matchMedia('(pointer: coarse)').matches) {
    var fab = el('button', 'burr-fab', 'leave a burr'); fab.type = 'button';
    fab.onclick = function () { newForm(window.scrollX + innerWidth / 2, window.scrollY + innerHeight / 2); };
    document.body.appendChild(fab);
  }

  load(); live();
})();
