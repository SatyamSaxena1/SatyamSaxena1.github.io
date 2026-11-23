/* "Play the audit": five small levels that re-create how the GRC platform works. Plain JavaScript, no build step.
   The data (frameworks, mappings, clauses, totals) is computed from the platform's content packs: assets/data/grc-packs.json.
   The levels are illustrations of the real engine, not the engine. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag), k;
    for (k in (attrs || {})) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var enc = new TextEncoder();
  function fallbackHash(s) {                       // only used where crypto.subtle is missing; same shape as a SHA-256 hex string
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, c, out = '';
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    out = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    while (out.length < 64) out += out;
    return out.slice(0, 64);
  }
  function H(s) {
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', enc.encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    return Promise.resolve(fallbackHash(s));
  }
  var short = function (h) { return h.slice(0, 10); };
  var ZERO = new Array(65).join('0');

  /* ---------- state, XP, badges ---------- */
  var KEY = 'grc-game-v1';
  var RANKS = [[170, 'Chief auditor'], [120, 'Senior auditor'], [70, 'Auditor'], [30, 'Analyst'], [0, 'Observer']];
  var BADGES = {
    once: ['Upload once', 'Level 1: one document, many frameworks'],
    replay: ['Same answer twice', 'Level 2: replay a decision'],
    sod: ['Hands off your own evidence', 'Level 2: try to judge what you uploaded'],
    caught: ['Caught red-handed', 'Level 3: edit the log and get noticed'],
    checkpoint: ['Checkpoint holds', 'Level 3: cover your tracks and still get caught'],
    sorter: ['Honest sorter', 'Level 4: sort at least 7 of 8 clauses'],
    tour: ['Seen the real thing', 'Level 5: visit all four screens'],
    bugs: ['Bug hunter', 'Open all three honest stories']
  };
  var S = load();
  function load() {
    try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.v === 1) return j; } catch (e) {}
    return { v: 1, xp: 0, done: {}, badges: {}, lv: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function rankOf(xp) { for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) return RANKS[i][1]; return RANKS[RANKS.length - 1][1]; }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function award(id, xp, msg, quiet) {
    if (S.done[id]) return false;
    S.done[id] = 1; S.xp += xp; save(); hud();
    if (!quiet) toast('+' + xp + ' XP · ' + msg);
    return true;
  }
  function badge(id) {
    if (S.badges[id]) return;
    S.badges[id] = 1; save(); hud(); toast('Badge unlocked: ' + BADGES[id][0]);
  }
  function levelDone(n) {
    if (!S.lv[n]) { S.lv[n] = 1; save(); }
    var d = $('#d' + n); if (d) d.hidden = false;
    hud();
  }

  function shelfInto(box) {
    box.innerHTML = '';
    Object.keys(BADGES).forEach(function (id) {
      var on = !!S.badges[id];
      box.appendChild(el('div', { class: 'bdg' + (on ? ' on' : '') }, [
        el('i', { 'aria-hidden': 'true', text: on ? '★' : '☆' }),
        el('div', {}, [el('b', { text: BADGES[id][0] }), el('small', { text: on ? 'Unlocked' : BADGES[id][1] })])
      ]));
    });
  }
  function hud() {
    $('#xp').textContent = S.xp;
    $('#rank').textContent = rankOf(S.xp);
    var n = Object.keys(S.badges).length;
    $('#badgeCount').textContent = n;
    $$('.hud-steps a').forEach(function (a) { a.classList.toggle('done', !!S.lv[a.getAttribute('data-step')]); });
    shelfInto($('#shelf'));
    var fx = $('#fxp'); if (fx) {
      fx.textContent = S.xp; $('#frank').textContent = rankOf(S.xp); shelfInto($('#fshelf'));
      var done = Object.keys(S.lv).length;
      $('#fmsg').textContent = done === 0 ? 'Play the levels above to earn XP and badges.'
        : done < 5 ? 'You have finished ' + done + ' of 5 levels. Keep going, or skip to the real screens.'
        : S.xp >= 170 ? 'Every level, nearly every badge. You audit like you mean it.'
        : 'All five levels done. The honest stories below hold the rest of the XP.';
    }
  }

  /* ---------- numbers strip ---------- */
  function numbers(D) {
    var T = D.totals, box = $('#numbers'), items = [
      [T.frameworks, 'frameworks'], [T.requirements, 'requirements listed'], [T.rule, 'judged by rules'],
      [T.attested, 'attested by a person'], [T.objectives, 'shared control objectives'], [T.mappings, 'mappings']
    ];
    box.appendChild(el('p', { class: 'num-note', text: 'Real numbers, computed from the repository.' }));
    var row = el('div', { class: 'num-row' });
    items.forEach(function (it) { row.appendChild(el('div', { class: 'num' }, [el('b', { 'data-to': it[0], text: reduce ? String(it[0]) : '0' }), el('span', { text: it[1] })])); });
    box.appendChild(row);
    if (reduce || !('IntersectionObserver' in window)) { $$('.num b', box).forEach(function (b) { b.textContent = b.getAttribute('data-to'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var to = +e.target.getAttribute('data-to'), t0 = performance.now();
        (function step(t) { var p = Math.min(1, (t - t0) / 900); e.target.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: .6 });
    $$('.num b', box).forEach(function (b) { io.observe(b); });
  }

  /* ---------- level 1: one document, many frameworks ---------- */
  function level1(D) {
    var cur = 0, docsBox = $('#a1docs'), grid = $('#a1grid'), res = $('#a1res');
    $('#l1how').textContent = D.totals.objectives + ' shared objectives and ' + D.totals.mappings + ' mappings, all written as data in the repository. Pick a document, upload it once, and watch which frameworks it counts toward.';
    function tiles() {
      grid.innerHTML = '';
      D.frameworks.forEach(function (f) {
        grid.appendChild(el('div', { class: 'fw', 'data-code': f.code }, [el('b', { text: f.name }), el('small', { text: f.requirements + ' requirements' }), el('div', { class: 'g-chips' })]));
      });
    }
    function select(i) {
      cur = i;
      $$('button', docsBox).forEach(function (b, j) { b.classList.toggle('on', i === j); b.setAttribute('aria-checked', String(i === j)); });
      $('#a1obj').textContent = 'Objective it satisfies: ' + D.documents[i].objective + '.';
      tiles(); res.textContent = '';
    }
    D.documents.forEach(function (doc, i) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', text: doc.name });
      b.addEventListener('click', function () { select(i); });
      docsBox.appendChild(b);
    });
    $('#a1up').addEventListener('click', function () {
      var doc = D.documents[cur], hits = 0, delay = 0;
      tiles();
      D.frameworks.forEach(function (f) {
        var maps = doc.maps.filter(function (m) { return m.fw === f.code; });
        if (maps.length) hits++;
        var t = $('.fw[data-code="' + f.code + '"]', grid);
        setTimeout(function () {
          var chips = $('.g-chips', t);
          if (maps.length) {
            t.classList.add('hit');
            maps.forEach(function (m) { chips.appendChild(el('span', { class: 'g-chip ' + m.coverage.toLowerCase(), title: m.title, text: m.clause + ' · ' + m.coverage.toLowerCase() })); });
          } else { t.classList.add('miss'); chips.appendChild(el('span', { class: 'g-chip none', text: 'no mapping' })); }
        }, reduce ? 0 : delay);
        delay += 130;
      });
      setTimeout(function () {
        res.textContent = '1 upload, ' + hits + ' frameworks counted, ' + (hits - 1) + ' uploads avoided.';
        $('#d1t').textContent = 'That is evidence reuse: one upload, ' + hits + ' frameworks, ' + (hits - 1) + ' uploads avoided. The frameworks left dark do not map to this objective, and the platform says so instead of pretending.';
        award('l1', 20, 'Upload once'); badge('once'); levelDone(1);
      }, reduce ? 0 : delay + 120);
    });
    select(0);
  }

  /* ---------- level 2: the decision ---------- */
  var RULES = {
    1: [{ id: 'CC6.2', title: 'Credential management', attr: 'password_min_length', op: '>=', value: 12 },
        { id: 'CC6.6', title: 'Multi-factor authentication', attr: 'mfa_required_for', op: 'contains_all', value: ['remote access', 'administrative access'] }],
    2: [{ id: 'CC6.2', title: 'Credential management', attr: 'password_min_length', op: '>=', value: 14 },
        { id: 'CC6.6', title: 'Multi-factor authentication', attr: 'mfa_required_for', op: 'contains_all', value: ['remote access', 'administrative access'] }]
  };
  function met(rule, v) {
    if (rule.op === '>=') return Number(v) >= rule.value;
    return rule.value.every(function (x) { return (v || []).indexOf(x) > -1; });
  }
  function gap(rule, v) {      // the same wording the real engine uses for a failed condition
    var shown = rule.op === '>=' ? String(v) : JSON.stringify(v).replace(/"/g, "'");
    return rule.attr + '=' + shown + ' fails ' + rule.attr + ' ' + rule.op + ' ' + JSON.stringify(rule.value).replace(/"/g, "'");
  }
  function verdictOf(results) {
    var n = results.filter(function (r) { return r.pass; }).length;
    return n === results.length ? 'PASS' : n === 0 ? 'FAIL' : 'PARTIAL';
  }
  var AUDITOR = { PASS: 'COMPLIANT', PARTIAL: 'PARTIALLY_COMPLIANT', FAIL: 'NON_COMPLIANT' };
  function decide(facts, rules) {
    var results = rules.map(function (r) { return { rule: r, pass: met(r, facts[r.attr]), gap: met(r, facts[r.attr]) ? '' : gap(r, facts[r.attr]) }; });
    return { results: results, verdict: verdictOf(results) };
  }
  function fingerprint(facts, rules, verdict) {
    return Promise.all([H(JSON.stringify(rules)), H(JSON.stringify(facts)), H(JSON.stringify({ facts: facts, rules: rules, verdict: verdict }))]);
  }

  var log = [];
  var onLogChange = function () {};
  function level2() {
    var rec = null, locked = false, who = 'uploader';
    var pw = $('#pw'), mfaR = $('#mfaR'), mfaA = $('#mfaA'), why = $('#why'), verdictSel = $('#verdict');
    function mfaList() { var l = []; if (mfaR.checked) l.push('remote access'); if (mfaA.checked) l.push('administrative access'); return l; }
    function doc() {
      $('#pwOut').textContent = pw.value;
      $('#docPw').textContent = '1. Passwords must be at least ' + pw.value + ' characters.';
      var l = mfaList();
      $('#docMfa').textContent = '2. Multi-factor authentication is required for ' + (l.length ? l.join(' and ') : 'nobody yet') + '.';
    }
    function addLog(actor, text) {
      log.push({ actor: actor, text: text });
      var ol = $('#a2log'); if (log.length === 1) ol.innerHTML = '';
      ol.appendChild(el('li', {}, [el('b', { text: actor }), ' ' + text]));
      ol.scrollTop = ol.scrollHeight;
    }
    function done(stage) { $('#s' + stage).classList.add('done'); }
    function out(id, node) { var o = $(id); o.innerHTML = ''; if (typeof node === 'string') o.textContent = node; else o.appendChild(node); }
    function setLocked(v) {
      locked = v;
      [pw, mfaR, mfaA, $('#model'), $('#rules'), $('#bRead')].forEach(function (c) { c.disabled = v; });
      $('#bReopen').hidden = !v; $('#bSign').disabled = v || !(rec && rec.verdict && !stale());
      $('#whyRow').hidden = !(v || (who === 'auditor' && rec && rec.verdict && AUDITOR[rec.verdict] !== verdictSel.value));
      $('#whyRow').firstChild.textContent = v ? 'Reason for reopening ' : 'Reason for overriding the rules ';
      $('#a2').classList.toggle('locked', v);
    }
    function stale() { return !!(rec && rec.verdict && rec.ver !== $('#rules').value); }
    function refreshSign() {
      var needWhy = who === 'auditor' && rec && rec.verdict && AUDITOR[rec.verdict] !== verdictSel.value;
      $('#whyRow').hidden = !(locked || needWhy);
      $('#bSign').disabled = locked || !(rec && rec.verdict && !stale());
    }

    pw.addEventListener('input', doc); mfaR.addEventListener('change', doc); mfaA.addEventListener('change', doc); doc();

    $('#bRead').addEventListener('click', function () {
      var facts = { password_min_length: +pw.value, mfa_required_for: mfaList() }, model = $('#model').value;
      if (!log.length) addLog('org admin', 'Evidence uploaded');
      addLog(model, 'Facts extracted from the policy');
      rec = { facts: facts, model: model };
      var l = facts.mfa_required_for;
      var t = el('table', { class: 'mini-table' }, [
        el('thead', {}, [el('tr', {}, ['fact', 'value', 'quote', 'page'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', {}, [
          el('tr', {}, [el('td', { text: 'password_min_length' }), el('td', { text: String(facts.password_min_length) }), el('td', { text: '“Passwords must be at least ' + pw.value + ' characters.”' }), el('td', { text: '1' })]),
          el('tr', {}, [el('td', { text: 'mfa_required_for' }), el('td', { text: l.length ? '[' + l.join(', ') + ']' : '[ ]' }), el('td', { text: l.length ? '“Multi-factor authentication is required for ' + l.join(' and ') + '.”' : '(no statement found)' }), el('td', { text: '1' })])
        ])]);
      var box = el('div', {}, [t, el('p', { class: 'g-note', text: model + ' reported these facts, each with its quote and page. It has not judged anything.' })]);
      out('#oRead', box); done(1);
      $('#bRules').disabled = false; $('#bReplay').disabled = true; $('#bSign').disabled = true; $('#oRules').textContent = ''; rec.verdict = null;
      award('a2read', 10, 'The model reads');
    });

    $('#bRules').addEventListener('click', function () {
      if (!rec) return;
      var ver = $('#rules').value, rules = RULES[ver], d = decide(rec.facts, rules);
      fingerprint(rec.facts, rules, d.verdict).then(function (fp) {
        rec.ver = ver; rec.rules = rules; rec.verdict = d.verdict; rec.results = d.results; rec.hash = fp[2];
        var rows = d.results.map(function (r) {
          return el('tr', {}, [el('td', { text: r.rule.id + ' ' + r.rule.title }), el('td', { class: r.pass ? 'ok' : 'bad', text: r.pass ? 'met' : 'not met' }), el('td', { text: r.pass ? '' : r.gap })]);
        });
        var box = el('div', {}, [
          el('table', { class: 'mini-table' }, [el('thead', {}, [el('tr', {}, ['rule', 'result', 'gap'].map(function (h) { return el('th', { text: h }); }))]), el('tbody', {}, rows)]),
          el('p', { class: 'verdict v-' + d.verdict.toLowerCase(), text: 'Engine verdict: ' + d.verdict }),
          el('p', { class: 'hashes' }, ['rule hash ', el('code', { text: short(fp[0]) }), ' · inputs ', el('code', { text: short(fp[1]) }), ' · decision ', el('code', { text: short(fp[2]) })])
        ]);
        out('#oRules', box); done(2); $('#bReplay').disabled = false;
        addLog('engine', 'Verdict ' + d.verdict + ' (rules v' + ver + ')');
        award('a2rules', 10, 'The rules decide');
        refreshSign();
      });
    });

    $('#rules').addEventListener('change', function () {
      if (stale() && !locked) {
        var p = el('p', { class: 'warn', text: 'Rules changed since this verdict (v' + rec.ver + ' → v' + $('#rules').value + '). Apply the rules again to refresh it.' });
        $('#oRules').appendChild(p);
      }
      refreshSign();
    });

    $('#bReplay').addEventListener('click', function () {
      if (!rec || !rec.verdict) return;
      var again = decide(rec.facts, rec.rules), model = $('#model').value;
      fingerprint(rec.facts, rec.rules, again.verdict).then(function (fp) {
        var same = fp[2] === rec.hash;
        var msg = 'Replayed from the saved facts and the saved rules, with ' + model + ': decision ' + short(fp[2]) + ' is ' + (same ? 'identical to' : 'different from') + ' the original (' + short(rec.hash) + ').' +
          (model !== rec.model ? ' You swapped the model; the answer did not change.' : ' Change the model and replay again: the answer still will not change.');
        $('#oRules').appendChild(el('p', { class: same ? 'ok-note' : 'warn', text: msg }));
        if (same) { award('a2replay', 15, 'Same answer twice'); badge('replay'); }
      });
    });

    $$('.seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        who = b.getAttribute('data-who');
        $$('.seg button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
        refreshSign();
      });
    });
    verdictSel.addEventListener('change', refreshSign);

    $('#bSign').addEventListener('click', function () {
      if (!rec || !rec.verdict) return;
      var v = verdictSel.value, agree = AUDITOR[rec.verdict] === v;
      if (who === 'uploader') {
        $('#oSign').textContent = 'Refused: the person who uploaded the evidence cannot judge it (segregation of duties). Switch to the auditor.';
        addLog('engine', 'Refused: the uploader tried to record a verdict');
        award('a2sod', 15, 'Hands off your own evidence'); badge('sod'); return;
      }
      var reason = why.value.trim();
      if (!agree && reason.length < 4) { $('#oSign').textContent = 'Overriding the rules’ own verdict needs a stated reason.'; return; }
      addLog('auditor', 'Verdict recorded: ' + v.replace(/_/g, ' ') + (agree ? '' : ' (overrides the rules: ' + reason + ')'));
      addLog('auditor', 'Control locked');
      $('#oSign').textContent = 'Locked. The control is closed; the policy above can no longer be changed without reopening it, with a reason.';
      why.value = ''; done(3); setLocked(true);
      award('a2sign', 15, 'A person signs'); levelDone(2); onLogChange();
    });

    $('#bReopen').addEventListener('click', function () {
      var reason = why.value.trim();
      if (reason.length < 4) { $('#oSign').textContent = 'Reopening needs a stated reason.'; return; }
      addLog('auditor', 'Control reopened: ' + reason);
      why.value = ''; $('#oSign').textContent = 'Reopened. The reason is in the log. Apply the rules again, then record a new verdict.';
      $('#s3').classList.remove('done'); setLocked(false); refreshSign(); onLogChange();
    });
  }

  /* ---------- level 3: rewrite history ---------- */
  function level3() {
    var ev = [], cpHead = '', editing = -1, state = { bad: -1, kind: '', cp: true };
    var DEFAULTS = [['org admin', 'Evidence uploaded'], ['model-A', 'Facts extracted from the policy'], ['engine', 'Verdict FAIL (rules v1)'], ['auditor', 'Verdict recorded: NON COMPLIANT'], ['auditor', 'Control locked']]
      .map(function (a) { return { actor: a[0], text: a[1] }; });
    var chain = $('#chain');
    function hashOf(e) { return H(e.prev + '|' + e.actor + '|' + e.text); }

    function build(events) {
      ev = []; editing = -1;
      var prev = ZERO, chainP = Promise.resolve();
      events.forEach(function (x) {
        chainP = chainP.then(function () {
          var e = { actor: x.actor, text: x.text, prev: prev };
          return hashOf(e).then(function (h) { e.hash = h; prev = h; ev.push(e); });
        });
      });
      return chainP.then(function () { cpHead = prev; $('#cp').textContent = short(cpHead) + '…'; return verify(); });
    }
    function verify() {
      var prev = ZERO, i = 0, bad = -1, kind = '';
      function next() {
        if (i >= ev.length) return Promise.resolve();
        var e = ev[i];
        if (e.prev !== prev) { bad = i; kind = 'link'; return Promise.resolve(); }
        return hashOf(e).then(function (h) {
          if (h !== e.hash) { bad = i; kind = 'hash'; return; }
          prev = e.hash; i++; return next();
        });
      }
      return next().then(function () {
        var head = ev.length ? ev[ev.length - 1].hash : ZERO;
        state = { bad: bad, kind: kind, cp: head === cpHead };
        render(); report();
      });
    }
    function report() {
      var c1 = $('#chk1'), c2 = $('#chk2');
      if (state.bad >= 0) {
        c1.className = 'bad'; c1.textContent = '✗ Chain check: event ' + (state.bad + 1) + (state.kind === 'hash' ? ' does not hash to its recorded value.' : ' does not link to the one before it.');
      } else { c1.className = 'ok'; c1.textContent = '✓ Chain check: every event matches its hash and links to the one before.'; }
      if (state.cp) { c2.className = 'ok'; c2.textContent = '✓ Checkpoint: the latest hash matches the one the auditor holds.'; }
      else { c2.className = 'bad'; c2.textContent = '✗ Checkpoint: the latest hash differs from the one the auditor holds. History was rewritten.'; }
      $('#bFix').disabled = !(state.bad >= 0 && state.kind === 'hash');
      $('#bRewrite').disabled = !(state.bad >= 0);
      if (state.bad >= 0) { $('#m1').classList.add('done'); award('a3m1', 20, 'Caught red-handed'); badge('caught'); }
      if (state.bad < 0 && !state.cp) {
        $('#m1').classList.add('done'); $('#m2').classList.add('done');
        award('a3m2', 20, 'Checkpoint holds'); badge('checkpoint'); levelDone(3);
      }
    }
    function render() {
      chain.innerHTML = '';
      ev.forEach(function (e, i) {
        var isBad = state.bad === i, after = state.bad >= 0 && i > state.bad;
        var body = editing === i
          ? el('div', { class: 'edit' }, [
              el('label', { 'for': 'ed' + i, class: 'sr', text: 'New text for event ' + (i + 1) }),
              el('input', { id: 'ed' + i, type: 'text', maxlength: '80', value: e.text }),
              el('div', { class: 'row' }, [el('button', { type: 'button', class: 'btn sm', 'data-act': 'save', text: 'Save change' }), el('button', { type: 'button', class: 'btn sm', 'data-act': 'cancel', text: 'Cancel' })])
            ])
          : el('div', {}, [el('p', { class: 'blk-text', text: e.text }), el('button', { type: 'button', class: 'btn sm', 'data-act': 'edit', text: 'Tamper with it' })]);
        var blk = el('article', { class: 'blk' + (isBad ? ' bad' : after ? ' after' : ' ok'), 'data-i': String(i) }, [
          el('header', {}, [el('b', { text: 'Event ' + (i + 1) }), el('span', { text: e.actor })]), body,
          el('p', { class: 'h' }, ['prev ', el('code', { text: short(e.prev) })]), el('p', { class: 'h' }, ['hash ', el('code', { text: short(e.hash) })])]);
        chain.appendChild(blk);
        if (i < ev.length - 1) chain.appendChild(el('i', { class: 'link' + (state.bad >= 0 && i >= state.bad ? ' cut' : ''), 'aria-hidden': 'true', text: '→' }));
      });
      var ed = $('input', chain); if (ed) { ed.focus(); ed.select(); }
    }
    chain.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-act]'); if (!b) return;
      var i = +b.closest('.blk').getAttribute('data-i'), act = b.getAttribute('data-act');
      if (act === 'edit') { editing = i; render(); }
      else if (act === 'cancel') { editing = -1; render(); }
      else if (act === 'save') { var v = $('input', b.closest('.blk')).value.trim(); if (v) ev[i].text = v; editing = -1; verify(); }
    });
    chain.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { var b = $('button[data-act=save]', e.target.closest('.blk')); if (b) b.click(); }
      if (e.key === 'Escape' && editing > -1) { editing = -1; render(); }
    });
    $('#bFix').addEventListener('click', function () {
      if (state.bad < 0 || state.kind !== 'hash') return;
      var e = ev[state.bad]; hashOf(e).then(function (h) { e.hash = h; verify(); });
    });
    $('#bRewrite').addEventListener('click', function () {
      if (state.bad < 0) return;
      var j = state.bad, p = Promise.resolve();
      for (; j < ev.length; j++) (function (k) {
        p = p.then(function () { ev[k].prev = k ? ev[k - 1].hash : ZERO; return hashOf(ev[k]).then(function (h) { ev[k].hash = h; }); });
      })(j);
      p.then(verify);
    });
    $('#bReset3').addEventListener('click', function () { build(log.length >= 3 ? log.slice(-6) : DEFAULTS); });
    onLogChange = function () { build(log.length >= 3 ? log.slice(-6) : DEFAULTS); };
    build(DEFAULTS);
  }

  /* ---------- level 4: judge it or attest it ---------- */
  function level4(D) {
    var quiz = $('#quiz'), answered = 0, correct = 0, total = D.quiz.length;
    var WHY = {
      rule: ['Right: its facts live in a document or a snapshot a machine can read, so fixed rules can judge it.', 'Not quite: its facts can be read from a document or a snapshot, so a rule judges it.'],
      attested: ['Right: it is about people or places, so a named person attests it and an auditor judges the statement.', 'Not quite: nothing a machine can read settles it, so a person attests it.']
    };
    D.quiz.forEach(function (c, i) {
      var fb = el('p', { class: 'qfb', 'aria-live': 'polite' });
      var row = el('article', { class: 'qrow' }, [
        el('div', {}, [el('b', { text: c.fw + ' · ' + c.id }), el('span', { text: c.title })]),
        el('div', { class: 'qbtn' }, [
          el('button', { type: 'button', class: 'btn sm', 'data-a': 'rule', text: 'A rule judges it from evidence' }),
          el('button', { type: 'button', class: 'btn sm', 'data-a': 'attested', text: 'A person attests it' })]), fb]);
      $$('button', row).forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-a'), ok = a === c.kind;
          $$('button', row).forEach(function (x) { x.disabled = true; x.classList.toggle('right', x.getAttribute('data-a') === c.kind); });
          if (!ok) b.classList.add('wrong');
          fb.className = 'qfb ' + (ok ? 'ok' : 'bad'); fb.textContent = WHY[c.kind][ok ? 0 : 1];
          answered++; if (ok) { correct++; award('q' + i, 4, 'Correct', true); }
          $('#a4score').textContent = answered + ' of ' + total + ' answered, ' + correct + ' right';
          if (answered === total) finish();
        });
      });
      quiz.appendChild(row);
    });
    function finish() {
      var T = D.totals, box = $('#split'); box.hidden = false; box.innerHTML = '';
      box.appendChild(el('h3', { text: 'The real split, framework by framework' }));
      D.frameworks.forEach(function (f) {
        var pr = f.requirements ? Math.round(100 * f.rule / f.requirements) : 0;
        box.appendChild(el('div', { class: 'bar-row' }, [el('b', { text: f.name }),
          el('div', { class: 'g-bar', role: 'img', 'aria-label': f.name + ': ' + f.rule + ' judged by rules, ' + f.attested + ' attested' }, [el('i', { class: 'r', style: 'width:' + pr + '%' }), el('i', { class: 'a', style: 'width:' + (100 - pr) + '%' })]),
          el('span', { text: f.rule + ' rule · ' + f.attested + ' attested' })]));
      });
      box.appendChild(el('p', { class: 'g-legend', text: 'Blue: judged by a rule. Amber: attested by a person.' }));
      $('#d4t').textContent = 'Attested is never shown as passed by the rules. That is why the platform reports ' + T.rule + ' judged and ' + T.attested + ' attested, out of ' + T.requirements + ' listed, instead of one flattering number.';
      if (correct >= 7) badge('sorter');
      award('a4done', 0, 'Level 4', true); levelDone(4);
      toast('Level 4 complete: ' + correct + ' of ' + total + ' right');
    }
  }

  /* ---------- level 5: the real screens ---------- */
  var SHOTS = [
    { tab: 'Roles', img: '../assets/projects/grc-roles.webp', w: 1600, h: 639, alt: 'The sign-in screen: three role cards and a map of the screens a role can open',
      pins: [[16, 38, 'Three ways to enter: the audited company’s admin, an auditor, and the audit firm’s admin. Each lands on a different screen.'],
             [66, 48, 'A map of every screen. The lit ones are what this role may open: the org admin can open 22 of 23. The server enforces it, not just the menu.'],
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
  function level5() {
    var tabs = $('#tabs'), img = $('#shotImg'), pins = $('#pins'), note = $('#pinNote'), seen = {}, cur = 0;
    function show(i) {
      cur = i; var s = SHOTS[i];
      $$('button', tabs).forEach(function (b, j) { b.setAttribute('aria-selected', String(i === j)); b.classList.toggle('on', i === j); b.tabIndex = i === j ? 0 : -1; });
      img.src = s.img; img.alt = s.alt; img.width = s.w; img.height = s.h;
      pins.innerHTML = ''; note.textContent = 'Tap a pin to see what it shows.';
      s.pins.forEach(function (p, k) {
        var b = el('button', { type: 'button', class: 'g-pin', style: 'left:' + p[0] + '%;top:' + p[1] + '%', 'aria-label': 'Pin ' + (k + 1) + ' of ' + s.pins.length + ' on the ' + s.tab + ' screen', text: String(k + 1) });
        b.addEventListener('click', function () { $$('.g-pin', pins).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); note.textContent = p[2]; });
        pins.appendChild(b);
      });
      seen[i] = 1;
      if (Object.keys(seen).length === SHOTS.length) { award('l5', 15, 'Seen the real thing'); badge('tour'); levelDone(5); }
    }
    SHOTS.forEach(function (s, i) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': 'false', text: s.tab });
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = (i + (e.key === 'ArrowRight' ? 1 : SHOTS.length - 1)) % SHOTS.length; show(n); $$('button', tabs)[n].focus(); }
      });
      tabs.appendChild(b);
    });
    show(0);
  }

  /* ---------- finale ---------- */
  function finale() {
    var STORIES = [
      ['The test that failed only after midnight', 'A vendor-report test failed only between midnight and 5:30 am. My laptop’s date was a day ahead of the server’s, and the test trusted the laptop. It now uses the server’s clock.'],
      ['The ID I made up', 'A database migration ID I invented by hand collided with an old one. A test that checks every ID is unique caught it before it reached the live site.'],
      ['The reviewer I parked', 'I built a small model reviewer that rated its own confidence, measured it on my own code, and parked it: when it claimed to be sure it was still wrong about one time in eight. It shipped nothing, and I learned the most from it.']
    ];
    var box = $('#secrets'), opened = {};
    STORIES.forEach(function (s, i) {
      var det = el('details', { class: 'secret' }, [el('summary', { text: s[0] }), el('p', { text: s[1] })]);
      det.addEventListener('toggle', function () {
        if (!det.open) return; opened[i] = 1; award('secret' + i, 5, 'An honest story');
        if (Object.keys(opened).length === STORIES.length) badge('bugs');
      });
      box.appendChild(det);
    });
    $('#again').addEventListener('click', function () { try { localStorage.removeItem(KEY); } catch (e) {} location.hash = ''; location.reload(); });
  }

  /* ---------- HUD behaviour and start ---------- */
  function hudBehaviour() {
    var btn = $('#badgeBtn'), shelf = $('#shelf');
    btn.addEventListener('click', function () { var open = shelf.hidden; shelf.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !shelf.hidden) { shelf.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var n = e.target.id.replace('l', '');
          $$('.hud-steps a').forEach(function (a) { a.classList.toggle('here', a.getAttribute('data-step') === n); });
        });
      }, { rootMargin: '-35% 0px -55% 0px' });
      ['l1', 'l2', 'l3', 'l4', 'l5'].forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  function start(D) {
    hudBehaviour(); numbers(D); level1(D); level2(); level3(); level4(D); level5(); finale(); hud();
    [1, 2, 3, 4].forEach(function (n) { if (S.lv[n]) { var d = $('#d' + n); if (d) d.hidden = false; } });
    if (S.lv[1]) $('#d1t').textContent = 'That is evidence reuse: one upload, several frameworks, the rest of the uploads avoided. The frameworks left dark do not map to this objective, and the platform says so instead of pretending.';
    if (S.lv[4]) $('#d4t').textContent = 'Attested is never shown as passed by the rules. That is why the platform reports ' + D.totals.rule + ' judged and ' + D.totals.attested + ' attested, out of ' + D.totals.requirements + ' listed, instead of one flattering number.';
  }

  fetch('../assets/data/grc-packs.json').then(function (r) { if (!r.ok) throw new Error('data'); return r.json(); }).then(start).catch(function () {
    var m = el('p', { class: 'gg-fine', text: 'The game data could not be loaded. The real screens, data sheet and source are linked at the top and bottom of this page.' });
    var h = $('.gg-hero'); if (h) h.appendChild(m);
  });
})();
