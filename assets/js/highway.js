/* Fuzzy Highway: a low-poly Three.js (r128) highway that acts out the fuzzy demo.
   Road condition -> cracks, puddles and surface; traffic density -> cars per lane;
   gap -> a glowing gap window beside the on-ramp; the fuzzy output -> the gantry sign
   and the speed of your car on the slip road. Listens for 'fz:update' from fuzzy-demo.js. */
(function () {
  var host = document.getElementById('fz-scene'), fz = document.getElementById('fz');
  if (!host || !fz || !window.THREE) return;
  var T = THREE, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // iOS 15 moved WebGL onto a new Metal backend and its WebGL2 path had rendering bugs; older iPhones are
  // also the slowest GPUs here. On iOS <= 15 use the mature WebGL1 path, no antialiasing and 1x pixels.
  // Safari's Version/NN tracks the iOS release (iOS 26+ freezes the "OS 18_6" field), so prefer it; Chrome/Firefox on iOS only give OS NN_
  var ua = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iosVer = isIOS ? +((/Version\/(\d+)/.exec(ua) || / OS (\d+)_/.exec(ua) || [0, 99])[1]) : 0;
  var iosMatch = isIOS ? [0, iosVer] : null;
  var glq = /[?&]gl=([12])/.exec(location.search), oldIOS = glq ? glq[1] === '1' : (isIOS && iosVer < 16), phone = window.matchMedia('(hover: none)').matches;
  // Rule: iPhones/iPads below iOS 16 don't open the live 3D at all (their WebGL is unreliable); they get a still
  // and the AR Quick Look models instead. ?gl=1 or ?gl=2 still forces 3D for testing.
  if (isIOS && iosVer < 16 && !glq) {
    var still0 = new Image(); still0.src = host.getAttribute('data-still'); still0.alt = 'The highway scene (a still; live 3D needs iOS 16 or later)';
    still0.className = 'fz-still'; host.insertBefore(still0, host.firstChild); host.classList.add('still', 'ar-only');
    var ar = document.getElementById('fz-ar'), note = document.createElement('a');
    note.className = 'fz-ar-note'; note.href = '#fz-ar'; note.textContent = 'Live 3D needs iOS 16 or later. View it in AR instead ↓';
    host.appendChild(note);
    if (window.__fzDebug) window.__fzDebug('iOS ' + iosVer + ': live 3D skipped, showing still + AR');
    return;
  }
  var renderer;
  try {
    var opts = { antialias: !oldIOS, alpha: true, powerPreference: 'low-power' };
    if (oldIOS) { var cnv = document.createElement('canvas'), ctx1 = cnv.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'low-power' }); if (!ctx1) throw new Error('no webgl'); opts.canvas = cnv; opts.context = ctx1; }
    renderer = new T.WebGLRenderer(opts);
  } catch (e) {
    if (window.__fzDebug) window.__fzDebug('3D off: ' + e.message);
    var still = new Image(); still.src = host.getAttribute('data-still'); still.alt = 'The highway scene (a still, because 3D is not available here)';
    still.className = 'fz-still'; host.insertBefore(still, host.firstChild); host.classList.add('still'); return;
  }
  renderer.setPixelRatio(oldIOS ? 1 : Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.25 : 1.5));
  if (window.__fzDebug) {
    var gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    window.__fzDebug('WebGL' + (renderer.capabilities.isWebGL2 ? '2' : '1') + ' | ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + ' | iOS ' + (iosMatch ? iosMatch[1] : '-') + (oldIOS ? ' (compat mode)' : '') + ' | dpr ' + renderer.getPixelRatio());
  }
  host.insertBefore(renderer.domElement, host.firstChild);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  var scene = new T.Scene(), cam = new T.PerspectiveCamera(36, 16 / 9, 1, 300);   // tight depth range: better precision on phone GPUs
  var dummy = new T.Object3D(), css = getComputedStyle(document.documentElement);
  function cv(n) { return new T.Color((css.getPropertyValue(n) || '#888').trim()); }

  // ---------- palette (re-read on theme change) ----------
  var C = {};
  function palette() {
    css = getComputedStyle(document.documentElement);
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    C.light = light; C.bg = cv('--bg'); C.accent = cv('--accent'); C.blue = cv('--accent-2'); C.red = cv('--c-cp'); C.warm = cv('--warm'); C.good = cv('--good');
    C.road = new T.Color(light ? 0x6b6d7a : 0x16161f); C.ground = new T.Color(light ? 0xc9c7dc : 0x07070d);
  }
  palette();

  scene.fog = new T.Fog(C.bg, 50, 230);
  var hemi = new T.HemisphereLight(0xb8b0ff, 0x101018, 0.75); scene.add(hemi);
  var moon = new T.DirectionalLight(0xffffff, 0.55); moon.position.set(-30, 40, 20); scene.add(moon);

  // ---------- static world ----------
  var LANES = [-3.6, 0, 3.6], RAMP_X = 7.6, LEN = 260, Z0 = 60, Z1 = Z0 - LEN;
  function box(w, h, d, mat, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); scene.add(m); return m; }
  var groundMat = new T.MeshLambertMaterial({ color: C.ground });
  var ground = new T.Mesh(new T.PlaneGeometry(320, 320), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -80); scene.add(ground);
  var roadMat = new T.MeshStandardMaterial({ color: C.road, roughness: 0.85, metalness: 0.05 });
  box(10.8, 0.05, LEN, roadMat, 0, 0, (Z0 + Z1) / 2);
  box(4, 0.05, 90, roadMat, RAMP_X, 0, Z0 - 45);                       // slip road
  var taper = new T.Shape(); taper.moveTo(5.4, 0); taper.lineTo(9.6, 0); taper.lineTo(5.4, 26); taper.lineTo(5.4, 0);
  var tm = new T.Mesh(new T.ShapeGeometry(taper), roadMat); tm.rotation.x = -Math.PI / 2; tm.position.set(0, 0.026, Z0 - 90); scene.add(tm);

  var lineMat = new T.MeshBasicMaterial({ color: 0xe8e6ff }), edgeMat = new T.MeshBasicMaterial({ color: C.accent }), rampMat = new T.MeshBasicMaterial({ color: C.blue });
  box(0.16, 0.06, LEN, edgeMat, -5.35, 0.02, (Z0 + Z1) / 2);
  box(0.16, 0.06, LEN - 116, edgeMat, 5.35, 0.02, Z1 + (LEN - 116) / 2);
  box(0.16, 0.06, 90, rampMat, 9.55, 0.02, Z0 - 45);
  var dashes = []; [-1.8, 1.8].forEach(function (x) { for (var z = Z0; z > Z1; z -= 10) dashes.push([x, z]); });
  for (var z2 = Z0; z2 > Z0 - 90; z2 -= 5) dashes.push([5.4, z2]);
  var dashMesh = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.06, 3), lineMat, dashes.length);
  dashes.forEach(function (d, i) { dummy.position.set(d[0], 0.02, d[1]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, d[0] === 5.4 ? 0.5 : 1); dummy.updateMatrix(); dashMesh.setMatrixAt(i, dummy.matrix); });
  scene.add(dashMesh);

  // guardrails and street lights, with soft light pools on the road
  var railMat = new T.MeshStandardMaterial({ color: 0x8a88a8, roughness: 0.4, metalness: 0.6 });
  box(0.12, 0.35, LEN, railMat, -6.4, 0.55, (Z0 + Z1) / 2); box(0.12, 0.35, LEN, railMat, 11, 0.55, (Z0 + Z1) / 2);
  var poleMat = new T.MeshStandardMaterial({ color: 0x55546a, roughness: 0.6 }), lampMat = new T.MeshBasicMaterial({ color: 0xfff1d6 });
  var poolMat = new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending });
  var poolGeo = new T.CircleGeometry(5.5, 28);
  for (var zp = Z0 - 10; zp > Z1; zp -= 32) [[-7.4, 1], [12, -1]].forEach(function (s) {
    box(0.18, 7, 0.18, poleMat, s[0], 3.5, zp); box(2.6, 0.12, 0.12, poleMat, s[0] + s[1] * 1.3, 7, zp);
    box(0.9, 0.12, 0.4, lampMat, s[0] + s[1] * 2.4, 6.9, zp);
    var pool = new T.Mesh(poolGeo, poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(s[0] + s[1] * 4, 0.04, zp); scene.add(pool);
  });

  // distant skyline
  var cityMat = new T.MeshBasicMaterial({ color: 0x1b1930, fog: true });
  var city = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), cityMat, 46);
  for (var i = 0; i < 46; i++) { var h = 8 + Math.random() * 34, w = 6 + Math.random() * 10; dummy.position.set(-130 + i * 6 + Math.random() * 3, h / 2, -205 - Math.random() * 25); dummy.scale.set(w, h, 6); dummy.updateMatrix(); city.setMatrixAt(i, dummy.matrix); }
  scene.add(city);

  // ---------- gantry with a live LED sign ----------
  var signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 224;
  var sctx = signCanvas.getContext('2d'), signTex = new T.CanvasTexture(signCanvas);
  var GZ = -38;
  box(0.4, 9, 0.4, poleMat, -6.9, 4.5, GZ); box(0.4, 9, 0.4, poleMat, 10.5, 4.5, GZ); box(17.8, 0.5, 0.5, poleMat, 1.8, 9, GZ);
  var sign = new T.Mesh(new T.PlaneGeometry(7.2, 3.15), new T.MeshBasicMaterial({ map: signTex })); sign.position.set(1.8, 7.3, GZ + 0.3); scene.add(sign);
  function drawSign(txt, sub, col, on, cut) {
    sctx.fillStyle = '#06060c'; sctx.fillRect(0, 0, 512, 224);
    sctx.strokeStyle = '#2a2840'; sctx.lineWidth = 8; sctx.strokeRect(4, 4, 504, 216);
    if (on) {
      sctx.fillStyle = col; sctx.shadowColor = col; sctx.shadowBlur = 24; sctx.textAlign = 'center';
      sctx.font = '700 28px ui-monospace, Menlo, Consolas, monospace'; sctx.fillText(sub, 196, 50);
      sctx.font = '800 ' + (txt.length > 3 ? 84 : 120) + 'px ui-monospace, Menlo, Consolas, monospace'; sctx.fillText(txt, 196, 178); sctx.shadowBlur = 0;
    }
    // aggregation: how strongly each output set was cut
    var keys = ['low', 'medium', 'high'], cols = ['#' + C.red.getHexString(), '#' + C.warm.getHexString(), '#' + C.good.getHexString()];
    keys.forEach(function (k, i) {
      var x = 392 + i * 36, v = cut ? cut[k] : 0, h = 130 * v;
      sctx.fillStyle = '#16152a'; sctx.fillRect(x, 50, 24, 130);
      sctx.fillStyle = cols[i]; sctx.shadowColor = cols[i]; sctx.shadowBlur = v > 0 ? 14 : 0; sctx.fillRect(x, 180 - h, 24, h); sctx.shadowBlur = 0;
      sctx.fillStyle = '#8f8bb3'; sctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace'; sctx.textAlign = 'center'; sctx.fillText(k[0].toUpperCase(), x + 12, 206);
    });
    signTex.needsUpdate = true;
  }

  // ---------- road damage (driven by road condition) ----------
  var MAXP = 40, MAXC = 70, crackMat = new T.MeshBasicMaterial({ color: C.light ? 0x2b2830 : 0x6a6474 });
  var puddleMat = new T.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending });
  var puddles = new T.InstancedMesh(new T.CircleGeometry(1, 20), puddleMat, MAXP);
  var cracks = new T.InstancedMesh(new T.BoxGeometry(0.1, 0.02, 1), crackMat, MAXC);
  var seed = 1; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var PUD = [], CRK = [];
  for (var p = 0; p < MAXP; p++) PUD.push([-4.8 + rnd() * 9.6, Z0 - rnd() * (LEN - 20), 0.9 + rnd() * 2, 0.4 + rnd() * 0.5]);
  for (var c = 0; c < MAXC; c++) CRK.push([-5 + rnd() * 10, Z0 - rnd() * (LEN - 20), rnd() * Math.PI, 1 + rnd() * 3.5]);
  scene.add(puddles); scene.add(cracks);
  function layoutDamage(road) {
    var bad = 1 - road / 10, np = Math.round(bad * MAXP), nc = Math.round(bad * MAXC);
    puddles.count = np; cracks.count = nc;
    for (var i = 0; i < np; i++) { var q = PUD[i]; dummy.position.set(q[0], 0.045, q[1]); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(q[2], q[2] * q[3], 1); dummy.updateMatrix(); puddles.setMatrixAt(i, dummy.matrix); }
    for (var j = 0; j < nc; j++) { var k = CRK[j]; dummy.position.set(k[0], 0.04, k[1]); dummy.rotation.set(0, k[2], 0); dummy.scale.set(1, 1, k[3]); dummy.updateMatrix(); cracks.setMatrixAt(j, dummy.matrix); }
    puddles.instanceMatrix.needsUpdate = cracks.instanceMatrix.needsUpdate = true;
    roadMat.color.copy(C.road).lerp(new T.Color(C.light ? 0x8d8a80 : 0x2a2620), bad * 0.6);
    roadMat.roughness = 0.55 + road * 0.04;
  }

  // ---------- traffic ----------
  // Each lane has fixed slots that all move together, so cars in a lane never touch. The density slider picks
  // which slots hold a car, and cars fade in and out rather than jumping. Lane 3 carries the gap: a moving slot
  // in that lane's traffic, so the gap travels with the cars and nothing pops in or out at its edges.
  var SLOTS = 26, MAXCARS = 3 * SLOTS, LANE_SPEED = [1.12, 1.05, 1];
  var bodyGeo = new T.BoxGeometry(1.8, 0.7, 4.2), cabGeo = new T.BoxGeometry(1.5, 0.55, 2.1), tailGeo = new T.BoxGeometry(1.5, 0.16, 0.08);
  var bodies = new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), MAXCARS);
  var cabs = new T.InstancedMesh(cabGeo, new T.MeshStandardMaterial({ color: 0x0c0c16, roughness: 0.15, metalness: 0.8 }), MAXCARS);
  var tails = new T.InstancedMesh(tailGeo, new T.MeshBasicMaterial({ color: 0xff3b4e }), MAXCARS);
  [bodies, cabs, tails].forEach(function (m) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(m); });
  var CAR_COLS = [0x6b7280, 0x9aa3b5, 0x2d3a5c, 0xb9b6c8, 0x3b3550, 0x7c8aa5, 0x4a4f63, 0xd4d2de], carCol = new T.Color();
  var slots = [];
  LANES.forEach(function (x, li) { for (var n = 0; n < SLOTS; n++) slots.push({ lane: li, i: n, off: (n + li / 3) * LEN / SLOTS, on: false, vis: 0, col: CAR_COLS[(n * 3 + li) % CAR_COLS.length] }); });
  var scrolls = [0, 0, 0], vt = 6, vtTarget = 6, gapLen = 10, gapOff = 0, gapZ = 0, CAR_HALF = 2.1;
  function wrapOff(o) { return ((o % LEN) + LEN) % LEN; }
  function inGap(s) { var d = wrapOff(s.off - gapOff), cd = Math.min(d, LEN - d); return s.lane === 2 && cd < gapLen / 2 + CAR_HALF; }
  function layoutTraffic(traffic, gap) {
    var per = Math.min(SLOTS, Math.round(2 + traffic * (oldIOS ? 1.4 : 2.2)));   // fewer cars on older iPhones
    slots.forEach(function (s) { s.on = Math.floor((s.i + 1) * per / SLOTS) > Math.floor(s.i * per / SLOTS); });
    gapLen = 6 + gap * 3.2;
  }
  var gapMat = new T.MeshBasicMaterial({ color: C.good, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending });
  var gapBox = box(3.3, 0.04, 1, gapMat, LANES[2], 0.05, 0);
  var gapEdges = [box(3.3, 0.08, 0.14, new T.MeshBasicMaterial({ color: C.good }), LANES[2], 0.06, 0), box(3.3, 0.08, 0.14, new T.MeshBasicMaterial({ color: C.good }), LANES[2], 0.06, 0)];

  // ---------- your car ----------
  // One cycle: a gap comes up lane 3 from behind the camera; your car runs alongside it on the slip road,
  // closes in until it is level with the gap at the merge point, slides into the middle of the gap, and rides
  // in it. When the gap is deep in the fog a new one starts behind the camera. No rule firing = wait at the
  // end of the slip road with hazards on, and let the gap go by.
  var ego = new T.Group(), egoMat = new T.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 });
  ego.add(new T.Mesh(bodyGeo, egoMat)); var ec = new T.Mesh(cabGeo, cabs.material); ec.position.set(0, 0.6, -0.2); ego.add(ec);
  var egoTail = new T.Mesh(tailGeo, new T.MeshBasicMaterial({ color: 0xff3b4e })); egoTail.position.set(0, 0.1, 2.12); ego.add(egoTail);
  var glow = new T.Mesh(new T.PlaneGeometry(3.2, 6), new T.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.3; ego.add(glow);
  scene.add(ego);
  var MERGE_Z = -18, WAIT_Z = -14, GAP_START = 34, GAP_END = -165, SPAWN_EGO_Z = 52;
  var phase = 'approach', egoZ = SPAWN_EGO_Z, mergeT = 0, stopped = false;
  function newGap() { gapOff = Z0 - GAP_START - scrolls[2]; }
  function startCycle(keepEgo) { newGap(); if (!keepEgo) egoZ = SPAWN_EGO_Z; phase = 'approach'; mergeT = 0; }
  startCycle(false);
  // ?test: expose positions so an automated check can confirm nothing overlaps
  if (/[?&]test/.test(location.search)) host.__hw = function () {
    return { phase: phase, ego: [ego.position.x, ego.position.z], gapZ: gapZ, gapLen: gapLen,
      cars: slots.filter(function (s) { return s.vis > 0.5; }).map(function (s) { return [LANES[s.lane], Z0 - wrapOff(s.off + scrolls[s.lane]), s.lane]; }) };
  };

  // ---------- rule hologram: the active rule base, firing live ----------
  // A 3x3x3 lattice (x = gap, y = road, z = traffic). Each AND rule lights the cell of its combination;
  // the 2023 OR rule is a shell around the whole lattice. Firing rules send beams with pulses to the sign.
  var holo = new T.Group(); holo.position.set(-6, 14.5, -34); holo.rotation.set(-0.15, 0.5, 0); scene.add(holo);
  var SP = 2.1, cubeGeo = new T.BoxGeometry(1, 1, 1), edgeGeo = new T.EdgesGeometry(cubeGeo), GREY = new T.Color(0x6d6a8c);
  var TERMS = ['poor', 'average', 'good'], cubes = [], cubeIdx = {};
  TERMS.forEach(function (r, ri) { TERMS.forEach(function (tr, ti) { TERMS.forEach(function (g, gi) {
    var grp = new T.Group();
    var m = new T.Mesh(cubeGeo, new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: 0.02, depthWrite: false, blending: T.AdditiveBlending }));
    var e = new T.LineSegments(edgeGeo, new T.LineBasicMaterial({ color: GREY, transparent: true, opacity: 0.1 }));
    grp.add(m); grp.add(e); grp.position.set((gi - 1) * SP, (ri - 1) * SP, (1 - ti) * SP); holo.add(grp);
    cubeIdx[r + '|' + tr + '|' + g] = cubes.length;
    cubes.push({ g: grp, m: m, e: e, a: 0, ta: 0, col: new T.Color(), used: false });
  }); }); });
  var shellGeo = new T.BoxGeometry(SP * 3 + 1, SP * 3 + 1, SP * 3 + 1);
  var shell = new T.Mesh(shellGeo, new T.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide }));
  var shellEdge = new T.LineSegments(new T.EdgesGeometry(shellGeo), new T.LineBasicMaterial({ color: C.red, transparent: true, opacity: 0 }));
  holo.add(shell); holo.add(shellEdge);
  var shellA = 0, shellTa = 0;

  function makeLabel(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var tex = new T.CanvasTexture(c), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.userData = { c: c, x: c.getContext('2d'), tex: tex };
    sp.draw = function (lines, col) {
      var x = sp.userData.x; x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.fillStyle = col || '#d9d6f5';
      lines.forEach(function (l, i) { x.font = (i ? '600 ' + (h * 0.22 | 0) : '800 ' + (h * 0.34 | 0)) + 'px ui-monospace, Menlo, Consolas, monospace'; x.fillText(l, w / 2, h * (0.38 + i * 0.38)); });
      sp.userData.tex.needsUpdate = true;
    };
    return sp;
  }
  var title = makeLabel(512, 128); title.scale.set(8, 2, 1); title.position.set(0, SP * 1.5 + 2.4, 0); holo.add(title);
  var axes = [['road \u2191', -SP * 1.5 - 1.6, 0, 0], ['gap \u2192', 0, -SP * 1.5 - 1.2, SP * 1.5], ['traffic', SP * 1.5 + 1.4, -SP * 1.5 - 0.6, 0]].map(function (a) {
    var l = makeLabel(256, 64); l.scale.set(3, 0.75, 1); l.position.set(a[1], a[2], a[3]); l.draw([a[0]], '#9c98c8'); holo.add(l); return l;
  });

  var beamGeo = new T.CylinderGeometry(1, 1, 1, 6, 1, true), pulseGeo = new T.SphereGeometry(1, 10, 8), beams = [];
  for (var bi = 0; bi < 28; bi++) {
    var bm = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    var pu = new T.Mesh(pulseGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    bm.visible = pu.visible = false; scene.add(bm); scene.add(pu);
    beams.push({ m: bm, p: pu, src: null, a: 0, ta: 0, ph: bi / 28 });
  }
  var SIGN_TOP = new T.Vector3(1.8, 8.95, GZ + 0.3), UP = new T.Vector3(0, 1, 0), vA = new T.Vector3(), vD = new T.Vector3(), sceneInv = new T.Matrix4();

  function applyRules(d) {
    var OUTC = { low: C.red, medium: C.warm, high: C.good }, rs = d.rules || [], acts = d.acts || [], b = 0;
    cubes.forEach(function (c) { c.ta = 0; c.used = false; });
    shellTa = 0;
    rs.forEach(function (r, i) {
      var a = acts[i] || 0, col = OUTC[r[2]];
      if (r[0] === 'or') { shellTa = a; shell.material.color.copy(col); shellEdge.material.color.copy(col); beams[b].src = 'shell'; }
      else { var c = cubes[cubeIdx[r[1].join('|')]]; c.used = true; c.ta = Math.max(c.ta, a); c.col.copy(col); beams[b].src = c; }
      beams[b].ta = a; beams[b].m.material.color.copy(col); beams[b].p.material.color.copy(col); b++;
    });
    for (; b < beams.length; b++) { beams[b].ta = 0; }
    var firing = acts.filter(function (a) { return a > 0; }).length;
    title.draw(['RULE BASE \u00b7 ' + rs.length + ' RULES', d.ok ? firing + ' firing now' : 'none firing'], d.ok ? '#d9d6f5' : '#' + C.red.getHexString());
  }

  function animateRules(dt, t) {
    var k = reduce ? 1 : Math.min(1, dt * 6);
    if (!reduce) holo.rotation.y = 0.5 + Math.sin(t * 0.18) * 0.45;
    scene.updateMatrixWorld(); sceneInv.copy(scene.matrixWorld).invert();   // in AR the scene itself is moved and shrunk
    cubes.forEach(function (c) {
      c.a += (c.ta - c.a) * k;
      var col = c.used ? c.col : GREY;
      c.m.material.color.copy(col); c.e.material.color.copy(col);
      c.m.material.opacity = (c.used ? 0.06 : 0.015) + c.a * 0.7;
      c.e.material.opacity = c.used ? 0.3 + c.a * 0.7 : 0.09;
      c.g.scale.setScalar(0.55 + c.a * 0.5 + (reduce ? 0 : c.a * 0.04 * Math.sin(t * 6 + c.g.position.x)));
    });
    shellA += (shellTa - shellA) * k;
    shell.material.opacity = shellA * 0.16; shellEdge.material.opacity = shellA * 0.9;
    beams.forEach(function (bm) {
      bm.a += (bm.ta - bm.a) * k;
      var show = bm.a > 0.01 && bm.src;
      bm.m.visible = bm.p.visible = !!show; if (!show) return;
      if (bm.src === 'shell') holo.getWorldPosition(vA); else bm.src.g.getWorldPosition(vA);
      vA.applyMatrix4(sceneInv);
      vD.subVectors(SIGN_TOP, vA); var len = vD.length();
      bm.m.position.copy(vA).addScaledVector(vD, 0.5);
      bm.m.quaternion.setFromUnitVectors(UP, vD.clone().normalize());
      var r = 0.03 + bm.a * 0.09; bm.m.scale.set(r, len, r);
      bm.m.material.opacity = 0.18 + bm.a * 0.55;
      bm.ph = (bm.ph + dt * (0.35 + bm.a * 0.5)) % 1;
      bm.p.position.copy(vA).addScaledVector(vD, reduce ? 0.5 : bm.ph);
      bm.p.scale.setScalar(0.12 + bm.a * 0.2); bm.p.material.opacity = 0.4 + bm.a * 0.6;
    });
  }

  // ---------- state from the fuzzy demo ----------
  var S = null, blink = 0;
  function apply(d) {
    S = d; layoutDamage(d.road); layoutTraffic(d.traffic, d.gap);
    if (d.ok) {
      var col = d.value < 35 ? C.red : d.value < 65 ? C.warm : C.good, hex = '#' + col.getHexString();
      drawSign(String(Math.round(d.value)), 'SPEED LIMIT', hex, true, d.cut);
      vtTarget = 2.5 + d.value * 0.17; stopped = false; egoMat.emissive.copy(C.accent);   // everyone drives at the limit on the sign
    } else { vtTarget = 1.2; stopped = true; }                                              // no answer: traffic crawls
    host.setAttribute('data-state', d.ok ? 'ok' : 'err');
    applyRules(d);
    if (reduce) frame(0);
  }

  // ---------- render loop ----------
  var W = 0, H = 0;
  function resize() {
    var r = host.getBoundingClientRect(); W = Math.max(1, r.width | 0); H = Math.max(1, r.height | 0);
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    // narrow screens crop the sides: bring the rule lattice inward and enlarge it
    var narrow = cam.aspect < 1.5;
    holo.position.set(narrow ? -2.5 : -6, narrow ? 15.5 : 14.5, narrow ? -40 : -34); holo.scale.setScalar(narrow ? 1.3 : 1);
    if (reduce) frame(0);
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  var px = 0, py = 0, tpx = 0, tpy = 0;
  host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); tpx = (e.clientX - r.left) / r.width - 0.5; tpy = (e.clientY - r.top) / r.height - 0.5; });
  host.addEventListener('pointerleave', function () { tpx = tpy = 0; });

  var t0 = performance.now(), last = t0, scroll = 0, running = false, visible = true;
  var frames = 0;
  function frame(dt) {
    try { frameBody(dt); frames++; } catch (err) { fail(err); }
  }
  function frameBody(dt) {
    if (!S) return;
    var t = (performance.now() - t0) / 1000;
    // traffic flows away from the camera at the limit on the sign; lanes differ slightly so the road looks alive
    vt += (vtTarget - vt) * Math.min(1, dt * 1.5);
    for (var li = 0; li < 3; li++) scrolls[li] += vt * LANE_SPEED[li] * dt;
    gapZ = Z0 - gapOff - scrolls[2];
    var n = 0, k = Math.min(1, dt * 3);
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      s.vis += ((s.on && !inGap(s) ? 1 : 0) - s.vis) * (reduce ? 1 : k);
      if (s.vis < 0.02) continue;
      var z = Z0 - wrapOff(s.off + scrolls[s.lane]), x = LANES[s.lane];
      dummy.rotation.set(0, 0, 0); dummy.scale.set(s.vis, s.vis, s.vis);
      dummy.position.set(x, 0.4 * s.vis, z); dummy.updateMatrix(); bodies.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, 1.0 * s.vis, z - 0.2 * s.vis); dummy.updateMatrix(); cabs.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, 0.5 * s.vis, z + 2.12 * s.vis); dummy.updateMatrix(); tails.setMatrixAt(n, dummy.matrix);
      bodies.setColorAt(n, carCol.set(s.col));
      n++;
    }
    bodies.count = cabs.count = tails.count = n;
    bodies.instanceMatrix.needsUpdate = cabs.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    gapBox.position.z = gapZ; gapBox.scale.z = gapLen;
    gapEdges[0].position.z = gapZ - gapLen / 2; gapEdges[1].position.z = gapZ + gapLen / 2;

    // your car
    var v3 = vt * LANE_SPEED[2], ex = RAMP_X, ez;
    if (phase === 'approach' || phase === 'wait') {
      if (stopped) {
        // no rule fires: roll to the end of the slip road and wait there
        phase = 'wait'; egoZ = Math.max(WAIT_Z, egoZ - Math.max(2, Math.min(12, (egoZ - WAIT_Z) * 0.9)) * dt);   // drive up and ease to a stop
      } else {
        if (phase === 'wait') { phase = 'approach'; if (gapZ < MERGE_Z + 2) startCycle(true); }     // missed this gap: wait for the next
        var d = egoZ - gapZ, remain = Math.max(0.35, (gapZ - MERGE_Z) / Math.max(v3, 0.5));
        d -= d / remain * dt;                                   // close the gap so you are level with it at the merge point
        egoZ = gapZ + d;
        if (gapZ <= MERGE_Z) { phase = 'merge'; mergeT = 0; egoZ = gapZ; }
      }
      ez = egoZ;
    } else if (phase === 'merge') {
      mergeT = Math.min(1, mergeT + dt / 1.6); var m = mergeT * mergeT * (3 - 2 * mergeT);
      ex = RAMP_X + (LANES[2] - RAMP_X) * m; ez = egoZ = gapZ;
      if (mergeT >= 1) phase = 'ride';
    } else {   // ride in the middle of the gap, then start over once it is deep in the fog
      ex = LANES[2]; ez = egoZ = gapZ;
      if (gapZ < GAP_END) startCycle(false);
    }
    ego.position.set(ex, 0.4, ez);
    ego.rotation.y = phase === 'merge' ? 0.14 * Math.sin(mergeT * Math.PI) : 0;
    blink += dt;
    if (stopped) {
      var on = Math.floor(blink * 2.4) % 2 === 0;
      egoTail.material.color.set(on ? 0xffb020 : 0x3a2a10);
      drawSign('NO RULE', 'FUZZY SYSTEM', '#' + C.red.getHexString(), on, null);
    } else egoTail.material.color.set(0xff3b4e);

    animateRules(dt, t);
    if (inXR) return;   // the AR loop renders with the phone's camera

    // camera: three-quarter view behind the merge, gentle drift and pointer parallax
    px += (tpx - px) * 0.06; py += (tpy - py) * 0.06;
    var drift = reduce ? 0 : Math.sin(t * 0.12) * 2.5;
    cam.position.set(18 + drift + px * 6, 10.5 - py * 3, Z0 - 40 + px * 3);
    cam.lookAt(1.5 + px * 3, 0.5, Z0 - 110);
    renderer.render(scene, cam);
  }
  if (window.__fzDebug) setInterval(function () { window.__fzDebug('3D frames drawn: ' + frames + (failed ? ' (stopped after an error)' : ''), '3d'); }, 2000);
  var failed = false;
  function fail(err) {
    if (failed) return; failed = true; running = false;
    if (window.__fzDebug) window.__fzDebug('3D error: ' + (err && err.message) + (err && err.stack ? ' | ' + String(err.stack).split('\n').slice(0, 3).join(' / ') : ''));
    if (phone) window.dispatchEvent(new CustomEvent('lava:pause', { detail: false }));
    renderer.domElement.style.display = 'none';
    var img = new Image(); img.src = host.getAttribute('data-still'); img.alt = 'The highway scene (a still, because 3D could not run on this device)';
    img.className = 'fz-still'; host.insertBefore(img, host.firstChild); host.classList.add('still');
  }
  function loop(now) {
    if (!running || failed) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt);
    requestAnimationFrame(loop);
  }
  function setRun(on) {
    if (inXR) return;
    if (phone) window.dispatchEvent(new CustomEvent('lava:pause', { detail: on }));   // one animated WebGL scene at a time on phones
    if (on === running || reduce || failed) return; running = on; if (on) { last = performance.now(); requestAnimationFrame(loop); }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; setRun(visible && !document.hidden); }).observe(host);
  document.addEventListener('visibilitychange', function () { setRun(visible && !document.hidden); });

  // ---------- live AR (WebXR: Chrome on Android phones with ARCore) ----------
  // The same scene, shrunk onto a table through the camera. The page's own rule-base chips, presets and sliders
  // move into the AR overlay for the session, so they keep driving the fuzzy engine and the scene as usual.
  var inXR = false;
  if (navigator.xr && navigator.xr.isSessionSupported && window.isSecureContext)
    navigator.xr.isSessionSupported('immersive-ar').then(function (ok) { if (ok) addXR(); }).catch(function () {});
  function addXR() {
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fz-xr'; btn.textContent = 'Live AR'; host.appendChild(btn);
    var ui = document.createElement('div'); ui.className = 'fz-xr-ui';
    ui.innerHTML = '<div class="fz-xr-top"><span class="fz-xr-hint"></span><button type="button" class="chip fz-xr-x">Exit AR</button></div><div class="fz-xr-panel"></div>';
    document.body.appendChild(ui);
    var top = ui.firstChild, panel = ui.lastChild, hint = top.firstChild, moved = [];
    // touching the controls must not count as "tap the table"
    [top, panel].forEach(function (el) { el.addEventListener('beforexrselect', function (e) { e.preventDefault(); }); });
    var session = null, hitSrc = null, ref = null, placed = false, hasHit = false;
    var hit = new T.Matrix4(), eye = new T.Vector3(), spot = new T.Vector3(), SCALE = 0.006, PIVOT = new T.Vector3(3, 0, -24);   // ~1.6 m of road
    var reticle = new T.Mesh(new T.RingGeometry(0.05, 0.065, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: C.accent }));
    reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
    function show(on) { scene.children.forEach(function (c) { if (c !== reticle && c !== hemi && c !== moon) c.visible = on && c !== ground && c !== city; }); }

    btn.addEventListener('click', function () {
      if (session) return;
      ui.classList.add('on');
      navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ui } })
        .then(start, function (e) { ui.classList.remove('on'); btn.textContent = 'AR could not start'; if (window.__fzDebug) window.__fzDebug('AR: ' + e.message); });
    });
    function start(s) {
      session = s; inXR = true; placed = false; running = false;
      window.dispatchEvent(new CustomEvent('lava:pause', { detail: true }));
      ['.fz-sets', '.fz-presets', '.fz-inputs'].forEach(function (q) {
        var el = fz.querySelector(q); if (!el) return;
        var mark = document.createComment('xr'); el.parentNode.insertBefore(mark, el); panel.appendChild(el); moved.push([el, mark]);
      });
      hint.textContent = 'Point at a table, then tap to place the highway';
      cam.near = 0.02; cam.far = 20; cam.updateProjectionMatrix();   // three passes these on as the AR depth range
      scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.setScalar(1); show(false);
      s.addEventListener('select', place); s.addEventListener('end', end);
      renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
      renderer.xr.setSession(s).then(function () {
        ref = renderer.xr.getReferenceSpace();
        s.requestReferenceSpace('viewer').then(function (vs) { return s.requestHitTestSource({ space: vs }); }).then(function (h) { hitSrc = h; });
        last = performance.now(); renderer.setAnimationLoop(xrFrame);
      });
    }
    function xrFrame(now, xf) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (xf && ref) {
        var vp = xf.getViewerPose(ref); if (vp) eye.copy(vp.transform.position);
        var r = hitSrc ? xf.getHitTestResults(hitSrc) : []; hasHit = r.length > 0;
        if (hasHit) hit.fromArray(r[0].getPose(ref).transform.matrix);
      }
      reticle.visible = hasHit && !placed;
      if (reticle.visible) { scene.updateMatrixWorld(); reticle.matrix.copy(scene.matrixWorld).invert().multiply(hit); }
      if (placed) frame(dt);
      renderer.render(scene, cam);
    }
    function place() {
      if (!hasHit) return;
      spot.setFromMatrixPosition(hit);
      // the road runs away from you, seen a little from the right like the page's own camera
      scene.scale.setScalar(SCALE); scene.rotation.set(0, Math.atan2(eye.x - spot.x, eye.z - spot.z) - 0.23, 0);
      scene.position.copy(PIVOT).multiplyScalar(-SCALE).applyEuler(scene.rotation).add(spot);
      if (!placed) { placed = true; show(true); hint.textContent = 'Drag the sliders. Tap the table to move it.'; }
    }
    function end() {
      renderer.setAnimationLoop(null); renderer.xr.enabled = false;
      if (hitSrc) hitSrc.cancel(); hitSrc = null; session = null; inXR = false; hasHit = false;
      moved.forEach(function (m) { m[1].parentNode.insertBefore(m[0], m[1]); m[1].parentNode.removeChild(m[1]); }); moved = [];
      ui.classList.remove('on');
      scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.setScalar(1);
      scene.children.forEach(function (c) { c.visible = c !== reticle; });
      cam.near = 1; cam.far = 300; resize(); setRun(visible && !document.hidden);
    }
    ui.querySelector('.fz-xr-x').addEventListener('click', function () { if (session) session.end(); });
  }

  window.addEventListener('themechange', function () {
    palette(); scene.fog.color.copy(C.bg); groundMat.color.copy(C.ground); edgeMat.color.copy(C.accent); rampMat.color.copy(C.blue);
    egoMat.color.copy(C.accent); egoMat.emissive.copy(C.accent); glow.material.color.copy(C.accent); puddleMat.color.copy(C.blue);
    hemi.intensity = C.light ? 1.0 : 0.75; crackMat.color.set(C.light ? 0x2b2830 : 0x6a6474); poolMat.opacity = C.light ? 0.06 : 0.12;
    if (S) apply(S);
  });

  // iOS can drop WebGL contexts under memory pressure; pause, then pick up again when it is restored
  renderer.domElement.addEventListener('webglcontextlost', function (e) { e.preventDefault(); setRun(false); });
  renderer.domElement.addEventListener('webglcontextrestored', function () { signTex.needsUpdate = true; if (S) apply(S); setRun(visible && !document.hidden); if (reduce) frame(0); });

  fz.addEventListener('fz:update', function (e) { apply(e.detail); });
  resize();
  if (fz.__fz) apply(fz.__fz);
  if (reduce) frame(0); else setRun(true);
})();
