/* Fuzzy Highway: a low-poly Three.js (r128) highway that acts out the fuzzy demo.
   Road condition -> cracks, puddles and surface; traffic density -> cars per lane;
   gap -> a glowing gap window beside the on-ramp; the fuzzy output -> the gantry sign
   and the speed of your car on the slip road. Listens for 'fz:update' from fuzzy-demo.js. */
(function () {
  var host = document.getElementById('fz-scene'), fz = document.getElementById('fz');
  if (!host || !fz || !window.THREE) return;
  var T = THREE, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { host.classList.add('no3d'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  host.insertBefore(renderer.domElement, host.firstChild);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  var scene = new T.Scene(), cam = new T.PerspectiveCamera(36, 16 / 9, 0.5, 420);
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
  var ground = new T.Mesh(new T.PlaneGeometry(600, 600), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -80); scene.add(ground);
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
  function drawSign(txt, sub, col, on) {
    sctx.fillStyle = '#06060c'; sctx.fillRect(0, 0, 512, 224);
    sctx.strokeStyle = '#2a2840'; sctx.lineWidth = 8; sctx.strokeRect(4, 4, 504, 216);
    if (on) {
      sctx.fillStyle = col; sctx.shadowColor = col; sctx.shadowBlur = 24; sctx.textAlign = 'center';
      sctx.font = '700 30px ui-monospace, Menlo, Consolas, monospace'; sctx.fillText(sub, 256, 52);
      sctx.font = '800 120px ui-monospace, Menlo, Consolas, monospace'; sctx.fillText(txt, 256, 182); sctx.shadowBlur = 0;
    }
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
  var MAXCARS = 3 * 26;
  var bodyGeo = new T.BoxGeometry(1.8, 0.7, 4.2), cabGeo = new T.BoxGeometry(1.5, 0.55, 2.1), tailGeo = new T.BoxGeometry(1.5, 0.16, 0.08);
  var bodies = new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), MAXCARS);
  var cabs = new T.InstancedMesh(cabGeo, new T.MeshStandardMaterial({ color: 0x0c0c16, roughness: 0.15, metalness: 0.8 }), MAXCARS);
  var tails = new T.InstancedMesh(tailGeo, new T.MeshBasicMaterial({ color: 0xff3b4e }), MAXCARS);
  [bodies, cabs, tails].forEach(function (m) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(m); });
  var CAR_COLS = [0x6b7280, 0x9aa3b5, 0x2d3a5c, 0xb9b6c8, 0x3b3550, 0x7c8aa5, 0x4a4f63, 0xd4d2de];
  for (var ci = 0; ci < MAXCARS; ci++) bodies.setColorAt(ci, new T.Color(CAR_COLS[ci % CAR_COLS.length]));
  bodies.instanceColor.needsUpdate = true;
  var cars = []; // {lane, z}
  var gapLen = 10, gapZ = -10, trafficSpeed = 10;
  var gapMat = new T.MeshBasicMaterial({ color: C.good, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending });
  var gapBox = box(3.3, 0.04, 1, gapMat, LANES[2], 0.05, 0);
  var gapEdges = [box(3.3, 0.08, 0.14, new T.MeshBasicMaterial({ color: C.good }), LANES[2], 0.06, 0), box(3.3, 0.08, 0.14, new T.MeshBasicMaterial({ color: C.good }), LANES[2], 0.06, 0)];
  function layoutTraffic(traffic, gap) {
    var per = Math.round(2 + traffic * 2.2), spacing = LEN / per;
    gapLen = 6 + gap * 3.2; trafficSpeed = 15 - traffic * 1.1;
    cars = [];
    LANES.forEach(function (x, li) { for (var n = 0; n < per; n++) cars.push({ lane: li, off: n * spacing + (li * spacing / 3) }); });
  }
  function wrap(z) { var span = LEN; return Z1 + ((((z - Z1) % span) + span) % span); }

  // ---------- your car ----------
  var ego = new T.Group(), egoMat = new T.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5 });
  ego.add(new T.Mesh(bodyGeo, egoMat)); var ec = new T.Mesh(cabGeo, cabs.material); ec.position.set(0, 0.6, -0.2); ego.add(ec);
  var egoTail = new T.Mesh(tailGeo, new T.MeshBasicMaterial({ color: 0xff3b4e })); egoTail.position.set(0, 0.1, 2.12); ego.add(egoTail);
  var glow = new T.Mesh(new T.PlaneGeometry(3.2, 6), new T.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.3; ego.add(glow);
  ego.position.set(RAMP_X, 0.4, Z0 - 48); scene.add(ego);
  var egoZ = Z0 - 48, egoSpeed = 8, egoTarget = 8, stopped = false;

  // ---------- state from the fuzzy demo ----------
  var S = null, blink = 0;
  function apply(d) {
    S = d; layoutDamage(d.road); layoutTraffic(d.traffic, d.gap);
    if (d.ok) {
      var col = d.value < 35 ? C.red : d.value < 65 ? C.warm : C.good, hex = '#' + col.getHexString();
      drawSign(String(Math.round(d.value)), 'SPEED LIMIT', hex, true);
      egoTarget = 2.5 + d.value * 0.2; stopped = false; egoMat.emissive.copy(C.accent);
    } else { egoTarget = 0; stopped = true; }
    host.setAttribute('data-state', d.ok ? 'ok' : 'err');
    if (reduce) frame(0);
  }

  // ---------- render loop ----------
  var W = 0, H = 0;
  function resize() { var r = host.getBoundingClientRect(); W = Math.max(1, r.width | 0); H = Math.max(1, r.height | 0); renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); if (reduce) frame(0); }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  var px = 0, py = 0, tpx = 0, tpy = 0;
  host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); tpx = (e.clientX - r.left) / r.width - 0.5; tpy = (e.clientY - r.top) / r.height - 0.5; });
  host.addEventListener('pointerleave', function () { tpx = tpy = 0; });

  var t0 = performance.now(), last = t0, scroll = 0, running = false, visible = true;
  function frame(dt) {
    if (!S) return;
    var t = (performance.now() - t0) / 1000;
    // traffic flows away from the camera; the gap window moves with lane 3
    scroll += trafficSpeed * dt * (stopped ? 0.35 : 1);
    gapZ = -10 + Math.sin(t * 0.25) * 6;
    var n = 0;
    for (var i = 0; i < cars.length && n < MAXCARS; i++) {
      var car = cars[i], z = wrap(Z0 - car.off - scroll);
      if (car.lane === 2 && Math.abs(z - gapZ) < gapLen / 2 + 2.2) continue;  // keep the gap clear
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(LANES[car.lane], 0.4, z); dummy.updateMatrix(); bodies.setMatrixAt(n, dummy.matrix);
      dummy.position.set(LANES[car.lane], 1.0, z - 0.2); dummy.updateMatrix(); cabs.setMatrixAt(n, dummy.matrix);
      dummy.position.set(LANES[car.lane], 0.5, z + 2.12); dummy.updateMatrix(); tails.setMatrixAt(n, dummy.matrix);
      n++;
    }
    bodies.count = cabs.count = tails.count = n;
    bodies.instanceMatrix.needsUpdate = cabs.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
    gapBox.position.z = gapZ; gapBox.scale.z = gapLen;
    gapEdges[0].position.z = gapZ - gapLen / 2; gapEdges[1].position.z = gapZ + gapLen / 2;

    // your car: drive the slip road at the fuzzy speed, merge, loop
    egoSpeed += (egoTarget - egoSpeed) * Math.min(1, dt * 2);
    var stopAt = Z0 - 70;
    if (!(stopped && egoZ <= stopAt + 0.5)) egoZ -= egoSpeed * dt;
    if (stopped && egoZ < stopAt) egoZ = stopAt;
    if (egoZ < Z1 + 40) egoZ = Z0 - 48;
    var mz = Z0 - 78, mt = Math.min(1, Math.max(0, (mz - egoZ) / 22));
    ego.position.set(RAMP_X + (LANES[2] - RAMP_X) * (mt * mt * (3 - 2 * mt)), 0.4, egoZ);
    ego.rotation.y = mt > 0 && mt < 1 ? 0.12 : 0;
    blink += dt;
    if (stopped) {
      var on = Math.floor(blink * 2.4) % 2 === 0;
      egoTail.material.color.set(on ? 0xffb020 : 0x3a2a10);
      drawSign('NO RULE', 'FUZZY SYSTEM', '#' + C.red.getHexString(), on);
    } else egoTail.material.color.set(0xff3b4e);

    // camera: three-quarter view behind the merge, gentle drift and pointer parallax
    px += (tpx - px) * 0.06; py += (tpy - py) * 0.06;
    var drift = reduce ? 0 : Math.sin(t * 0.12) * 2.5;
    cam.position.set(18 + drift + px * 6, 10.5 - py * 3, Z0 - 40 + px * 3);
    cam.lookAt(1.5 + px * 3, 0.5, Z0 - 110);
    renderer.render(scene, cam);
  }
  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt);
    requestAnimationFrame(loop);
  }
  function setRun(on) { if (on === running || reduce) return; running = on; if (on) { last = performance.now(); requestAnimationFrame(loop); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; setRun(visible && !document.hidden); }).observe(host);
  document.addEventListener('visibilitychange', function () { setRun(visible && !document.hidden); });

  window.addEventListener('themechange', function () {
    palette(); scene.fog.color.copy(C.bg); groundMat.color.copy(C.ground); edgeMat.color.copy(C.accent); rampMat.color.copy(C.blue);
    egoMat.color.copy(C.accent); egoMat.emissive.copy(C.accent); glow.material.color.copy(C.accent); puddleMat.color.copy(C.blue);
    hemi.intensity = C.light ? 1.0 : 0.75; crackMat.color.set(C.light ? 0x2b2830 : 0x6a6474); poolMat.opacity = C.light ? 0.06 : 0.12;
    if (S) apply(S);
  });

  fz.addEventListener('fz:update', function (e) { apply(e.detail); });
  resize();
  if (fz.__fz) apply(fz.__fz);
  if (reduce) frame(0); else setRun(true);
})();
