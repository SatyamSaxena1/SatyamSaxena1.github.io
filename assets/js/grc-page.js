/* /grc/ product page: numbers, document coverage, tamper demo, screenshot tour. No dependencies. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

  /* ---- numbers and coverage come from the packs, with the page's own text as fallback ---- */
  fetch('../assets/data/grc-packs.json').then(function (r) { return r.json(); }).then(function (d) {
    var t = d.totals;
    document.querySelectorAll('[data-k]').forEach(function (n) { if (t[n.getAttribute('data-k')] != null) n.textContent = t[n.getAttribute('data-k')]; });
    $('#splitR').style.flex = t.rule; $('#splitR').textContent = t.rule;
    $('#splitA').style.flex = t.attested; $('#splitA').textContent = t.attested;
    coverage(d);
  }).catch(function () { /* the static numbers in the HTML stay */ });

  function coverage(d) {
    var docs = $('#docs'), fws = $('#fws'), cov = $('#cov');
    d.frameworks.forEach(function (f) { var c = el('div', { class: 'gp-fw', 'data-code': f.code }, f.name); fws.appendChild(c); });
    function pick(i) {
      var doc = d.documents[i], hit = {};
      doc.maps.forEach(function (m) { hit[m.fw] = 1; });
      docs.querySelectorAll('button').forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
      fws.querySelectorAll('.gp-fw').forEach(function (c) { c.classList.toggle('hit', !!hit[c.getAttribute('data-code')]); });
      cov.textContent = 'One “' + doc.name.toLowerCase() + '” counts towards ' + Object.keys(hit).length + ' of ' + d.frameworks.length + ' frameworks.';
    }
    d.documents.forEach(function (doc, i) { var b = el('button', { type: 'button', 'aria-pressed': 'false' }, doc.name); b.addEventListener('click', function () { pick(i); }); docs.appendChild(b); });
    pick(0);
  }

  /* ---- tamper demo: each event carries a fingerprint of the one before it ---- */
  function fp(s) { var h = 5381, g = 52711; for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) ^ s.charCodeAt(i); g = ((g << 5) + g + s.charCodeAt(i)) | 0; } return ((h >>> 0).toString(16) + (g >>> 0).toString(16)).slice(0, 8); }
  var EVENTS = ['Evidence uploaded', 'Facts read from policy', 'Verdict: not met', 'Auditor signs', 'Control locked'];
  var texts, stored;
  function build() {
    texts = EVENTS.slice(); stored = []; var prev = '00000000';
    texts.forEach(function (t) { prev = fp(prev + t); stored.push(prev); });
  }
  function draw() {
    var box = $('#chain'), prev = '00000000', broken = -1; box.textContent = '';
    texts.forEach(function (t, i) {
      var now = fp(prev + t), bad = now !== stored[i];
      if (bad && broken < 0) broken = i;
      var b = el('div', { class: 'gp-blk' + (broken >= 0 ? ' bad' : '') });
      b.appendChild(el('b', {}, 'Event ' + (i + 1)));
      b.appendChild(document.createTextNode(t));
      b.appendChild(el('br', {}));
      b.appendChild(document.createTextNode('#' + stored[i]));
      box.appendChild(b);
      if (i < texts.length - 1) box.appendChild(el('span', { class: 'ar', 'aria-hidden': 'true' }, '→'));
      prev = stored[i];
    });
    $('#chainNote').textContent = broken < 0
      ? 'Every event matches its fingerprint. The chain is intact.'
      : 'Event ' + (broken + 1) + ' no longer matches its fingerprint, so the chain is broken there and everything after it is in doubt.';
  }
  build(); draw();
  $('#tamper').addEventListener('click', function () { texts[1] = 'Nothing to see here'; draw(); });
  $('#reset').addEventListener('click', function () { build(); draw(); });

  /* ---- real screenshots with pins ---- */
  var SHOTS = [
    { tab: 'Roles', img: '../assets/projects/grc-roles.webp', w: 1600, h: 639, alt: 'The sign-in screen: three role cards and a map of the screens a role can open',
      pins: [[16, 38, 'Three ways in: the audited company’s admin, an auditor, and the audit firm’s admin. Each lands on a different screen.'],
             [66, 48, 'A map of every screen. The lit ones are what this role may open: the company admin can open 22 of 23. The server enforces it, not just the menu.'],
             [68, 5, '“Try the demo, no account” opens a sample company, read-only, so anyone can look around.']] },
    { tab: 'Frameworks', img: '../assets/projects/grc-frameworks.webp', w: 1600, h: 867, alt: 'The frameworks page with nine framework cards and ISO 27001 selected',
      pins: [[27, 47, 'ISO 27001 is subscribed. Its 4% comes from four controls a named person has attested.'],
             [18, 66, 'SOC 2 sits at 9%, from three attested controls. Nothing here is a model’s opinion.'],
             [60, 90, 'The summary counts “met by the rules” and “attested” separately. Attested is never shown as passed by the rules.']] },
    { tab: 'Risks', img: '../assets/projects/grc-risks.webp', w: 1600, h: 833, alt: 'The risk register with a five-by-five heat map',
      pins: [[40, 31, 'Open risks by band: critical, high, medium, low, and how many reviews are overdue.'],
             [29, 62, 'The heat map. Each square counts open risks at that likelihood and impact. A fixed five-by-five scale scores them; a person signs what is saved.'],
             [73, 46, 'Reviews follow the band: critical every 30 days, high 90, medium 180, low 365.']] },
    { tab: 'Vendors', img: '../assets/projects/grc-vendors.webp', w: 1600, h: 694, alt: 'The vendor register with risk tiers',
      pins: [[50, 27, 'A vendor’s tier is points from fixed rules: the data they touch, how much you depend on them, and whether a SOC 2 or ISO report is on file.'],
             [60, 73, 'PayRail Gateway handles sensitive data and is critical, so it lands in the HIGH tier.'],
             [48, 56, '“Ticked by hand” means nobody has uploaded a report. A current SOC 2 or ISO report lowers the tier only while its valid-until date has not passed.']] }
  ];
  var tabs = $('#tabs'), img = $('#shotImg'), pins = $('#pins'), note = $('#pinNote');
  function show(i) {
    var s = SHOTS[i];
    tabs.querySelectorAll('button').forEach(function (b, j) { b.setAttribute('aria-selected', String(i === j)); b.classList.toggle('on', i === j); b.tabIndex = i === j ? 0 : -1; });
    img.src = s.img; img.alt = s.alt; img.width = s.w; img.height = s.h;
    pins.textContent = ''; note.textContent = 'Tap a pin to see what it shows.';
    s.pins.forEach(function (p, k) {
      var b = el('button', { type: 'button', class: 'gp-pin', style: 'left:' + p[0] + '%;top:' + p[1] + '%', 'aria-label': 'Pin ' + (k + 1) + ' of ' + s.pins.length + ' on the ' + s.tab + ' screen' }, String(k + 1));
      b.addEventListener('click', function () { pins.querySelectorAll('.gp-pin').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); note.textContent = p[2]; });
      pins.appendChild(b);
    });
  }
  SHOTS.forEach(function (s, i) {
    var b = el('button', { type: 'button', role: 'tab', 'aria-selected': 'false' }, s.tab);
    b.addEventListener('click', function () { show(i); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = (i + (e.key === 'ArrowRight' ? 1 : SHOTS.length - 1)) % SHOTS.length; show(n); tabs.querySelectorAll('button')[n].focus(); }
    });
    tabs.appendChild(b);
  });
  show(0);
})();
