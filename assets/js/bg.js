/* Lava-lamp background.
   A handful of soft metaballs is simulated on the CPU (springs, buoyancy, orbits around the cursor) and drawn by one
   Three.js fragment shader. Each blob drifts between crisp-and-glossy and feathery-and-fuzzy, while faint contour rings
   keep its shape readable. Falls back to CSS gradients without WebGL and holds still for reduced-motion users. */
(function () {
  var canvas = document.getElementById('bg');
  if (!canvas || !window.THREE) { document.documentElement.classList.add('no-webgl'); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (e) { document.documentElement.classList.add('no-webgl'); return; }
  var small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1 : 1.25));

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isDark = function () { return document.documentElement.getAttribute('data-theme') !== 'light'; };

  /* ---------- blobs ---------- */
  var N = 9;
  var PAL = [[.54, .42, 1], [.24, .48, 1], [.62, .30, .98], [.38, .68, 1], [.36, .22, .88],
             [1, .66, .36], [.22, .16, .70], [.30, .28, .95], [1, .74, .48]];
  // kind: orbit (circles the cursor) | drift (rises and sinks like wax) | amb (big slow mass) | cur (the cursor's heat source)
  var DEF = [
    { k: 'orbit', R: .40, w:  .55, r: .125, sp: .50, ph: 0.0 },
    { k: 'orbit', R: .58, w: -.42, r: .150, sp: .37, ph: 1.7 },
    { k: 'orbit', R: .78, w:  .33, r: .115, sp: .43, ph: 3.1 },
    { k: 'orbit', R: .50, w: -.68, r: .095, sp: .58, ph: 4.4 },
    { k: 'drift', ax: -.55, r: .17, per: 19, ph: .6,  sp: .31 },
    { k: 'drift', ax:  .62, r: .145, per: 25, ph: 2.4, sp: .27 },
    { k: 'amb', r: .30, fx: .071, fy: .053, px: .4,  py: 2.1, sp: .19, ph: 5.0 },
    { k: 'amb', r: .34, fx: .049, fy: .067, px: 3.7, py: .9,  sp: .23, ph: 2.0 },
    { k: 'cur', r: .040, sp: 0, ph: 0 }
  ];
  var B = DEF.map(function (d, i) {
    return { x: Math.cos(i * 2.4) * .55, y: Math.sin(i * 1.9) * .4, vx: 0, vy: 0, ux: 1, uy: 0, st: 0, r: d.r, s: .5, th: i * 1.3 };
  });

  var U = {
    uTime: { value: 0 }, uDark: { value: isDark() ? 1 : 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uBlob: { value: DEF.map(function () { return new THREE.Vector4(); }) },
    uShape: { value: DEF.map(function () { return new THREE.Vector4(1, 0, 0, 0); }) },
    uCol: { value: PAL.map(function (c) { return new THREE.Vector3(c[0], c[1], c[2]); }) }
  };

  var frag = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime, uDark;',
    'uniform vec4 uBlob[9]; uniform vec4 uShape[9]; uniform vec3 uCol[9];',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float bump(float x,float c,float w){float u=(x-c)/w;return exp(-u*u);}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;',
    '  vec2 p=(uv-.5)*vec2(asp,1.)*2.; float t=uTime; float D=uDark;',
    '  // a gentle domain warp keeps shapes organic instead of perfectly round',
    '  vec2 wv=vec2(vnoise(p*1.3+vec2(t*.07,0.)),vnoise(p*1.3+vec2(5.2,t*.06)))-.5;',
    '  vec2 q=p+wv*.10;',
    '  // metaball field: sum of r^2/d^2, with each blob stretched along its direction of travel',
    '  float F=0.; vec3 Cs=vec3(0.); float Ss=0.; vec2 G=vec2(0.);',
    '  for(int i=0;i<9;i++){',
    '    vec4 b=uBlob[i]; vec4 sh=uShape[i];',
    '    vec2 d=q-b.xy; vec2 u=sh.xy; vec2 v=vec2(-u.y,u.x);',
    '    float a=1.+sh.z; float bb=1./sqrt(a);',
    '    float pu=dot(d,u), pv=dot(d,v);',
    '    float d2=(pu*pu)/(a*a)+(pv*pv)/(bb*bb);',
    '    float den=d2+.0025; float r2=b.z*b.z; float k=r2/den;',
    '    F+=k; Cs+=uCol[i]*k; Ss+=b.w*k;',
    '    vec2 Md=u*(pu/(a*a))+v*(pv/(bb*bb));',
    '    G+=-2.*r2*Md/(den*den);',
    '  }',
    '  float L=log(F+1e-4)-.405;                 // the blob edge sits at L=0, inside is positive',
    '  vec3 C=Cs/F; float s=Ss/F;                // blended colour and softness',
    '  C=mix(mix(C,vec3(.80,.76,1.),.42),C,D);   // pastel version for the light theme',
    '  // fuzz: noisy, ragged edges that grow as a blob gets softer',
    '  float n1=vnoise(p*2.6+vec2(t*.10,-t*.07)), n2=vnoise(p*13.+vec2(-t*.25,t*.18));',
    '  float fuzz=((n1-.5)*.55+(n2-.5)*.45)*(.08+.95*s*s);',
    '  float e=L+fuzz;',
    '  float wd=.03+.85*s;',
    '  float body=smoothstep(-wd,wd,e);',
    '  float halo=exp(min(e,0.)*mix(3.0,1.15,s))*mix(.14,.34,s);',
    '  float A=clamp(body+halo*(1.-body),0.,1.);',
    '  float td=clamp(e/1.9,0.,1.);              // 0 at the edge, 1 deep inside',
    '  float rim=pow(1.-td,2.0)*body*(1.-.6*s);',
    '  // glossy highlight from the slope of the field, strongest while a blob is crisp',
    '  vec2 gh=G/(F+1e-4);',
    '  float xx=clamp((e+.6)/2.2,0.,1.); float dh=6.*xx*(1.-xx)/2.2;',
    '  vec3 N=normalize(vec3(-gh*dh*.9,1.));',
    '  vec3 H=normalize(normalize(vec3(-.5,.65,.6))+vec3(0.,0.,1.));',
    '  float spec=pow(max(dot(N,H),0.),38.)*body*(1.-s)*(1.-td*.4);',
    '  // contour rings: the implied structure that stays readable while the edge blurs away',
    '  float eL=L+fuzz*.35;',
    '  float ln=bump(eL,-1.15,.04)*.6+bump(eL,-.65,.04)*.8+bump(eL,-.28,.04)+bump(eL,.45,.045)*.9+bump(eL,.95,.05)*.7+bump(eL,1.55,.055)*.5;',
    '  float lines=ln*(.05+.17*s)*smoothstep(-1.4,-.7,L);',
    '  vec3 coreD=mix(C,C*mix(.24,.62,s),smoothstep(.10,.85,td));',
    '  vec3 colD=coreD+C*1.5*rim+vec3(.85,.80,1.)*spec*.9+C*1.3*lines;',
    '  vec3 coreL=mix(C,mix(C,vec3(1.),.5),td);',
    '  vec3 colL=mix(coreL,C*.72,rim*.7)+vec3(1.)*spec*.5;',
    '  colL=mix(colL,C*.5,clamp(lines*1.4,0.,1.));',
    '  vec3 col=mix(colL,colD,D);',
    '  vec3 bg=mix(vec3(.958,.953,.99),vec3(.012,.012,.034),D);',
    '  bg+=(vnoise(p*.8+vec2(t*.02,0.))-.5)*mix(.012,.02,D)*vec3(.6,.5,1.);',
    '  col=mix(bg,col,A*mix(.80,.90,D));',
    '  col+=(hash(gl_FragCoord.xy+fract(t)*91.)-.5)*mix(.018,.04,D);',
    '  col*=1.-dot(uv-.5,uv-.5)*mix(.12,.42,D);',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  var material = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: frag, depthTest: false, depthWrite: false
  });
  var scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  /* ---------- simulation ---------- */
  var asp = 1, S = 1;                       // aspect ratio; size scale so blobs fit portrait screens
  var t = 0, cx = 0, cy = 0, tx = 0, ty = 0, pcx = 0, pcy = 0, heat = 0, act = 0, lastMove = -99, lastScroll = window.scrollY;

  function step(dt) {
    t += dt;
    var idle = (t - lastMove) > 3.2;
    act += ((idle ? 0 : 1) - act) * (1 - Math.exp(-dt * 1.4));
    // goal: the real cursor, or a lazy wander when nobody is pointing
    var wx = asp * .5 * Math.sin(t * .23), wy = .42 * Math.sin(t * .31 + 1.3);
    var gx = wx + (tx - wx) * act, gy = wy + (ty - wy) * act;
    var k = 1 - Math.exp(-dt * 5.5);
    cx += (gx - cx) * k; cy += (gy - cy) * k;
    var speed = Math.hypot(cx - pcx, cy - pcy) / Math.max(dt, 1e-3); pcx = cx; pcy = cy;
    var hz = Math.min(speed / 1.6, 1);
    heat += (Math.max(hz, idle ? .12 + .1 * Math.sin(t * .4) : 0) - heat) * (1 - Math.exp(-dt * 2.4));

    var i, j, d, b, gx2, gy2, kk, cc;
    for (i = 0; i < N; i++) {
      d = DEF[i]; b = B[i];
      if (d.k === 'orbit') {
        b.th += d.w * (1 + .35 * Math.sin(t * .3 + d.ph)) * dt;
        var R = d.R * S * (1 + .18 * Math.sin(t * .5 + d.ph)) * (1 + .55 * heat);
        gx2 = cx + Math.cos(b.th) * R * 1.15; gy2 = cy + Math.sin(b.th) * R * .85; kk = 4.0; cc = 2.3;
      } else if (d.k === 'drift') {
        gx2 = d.ax * asp + Math.sin(t * .13 + d.ph) * .25; gy2 = Math.sin(t * 6.2832 / d.per + d.ph) * .72;
        var dx = cx - b.x, dy = cy - b.y, pull = 1.1 * Math.exp(-(dx * dx + dy * dy) * 1.1);
        b.vx += dx * pull * dt; b.vy += dy * pull * dt;
        kk = 1.15; cc = 1.5;
      } else if (d.k === 'amb') {
        gx2 = asp * .82 * Math.sin(t * d.fx + d.px); gy2 = .62 * Math.sin(t * d.fy + d.py);
        var ex = b.x - cx, ey = b.y - cy, ed = Math.hypot(ex, ey) + 1e-3;
        if (ed < .9) { var push = 1.5 * (1 - ed / .9); b.vx += ex / ed * push * dt; b.vy += ey / ed * push * dt; }
        kk = .9; cc = 1.3;
      } else { b.vx = b.vy = 0; b.x = cx; b.y = cy; continue; }
      b.vx += ((gx2 - b.x) * kk - b.vx * cc) * dt;
      b.vy += ((gy2 - b.y) * kk - b.vy * cc) * dt;
    }
    // blobs push apart when they overlap and cling a little at mid range, so they pinch, neck and merge
    for (i = 0; i < N - 1; i++) for (j = i + 1; j < N - 1; j++) {
      var a1 = B[i], a2 = B[j], ddx = a2.x - a1.x, ddy = a2.y - a1.y, dist = Math.hypot(ddx, ddy) + 1e-4;
      var rs = (a1.r + a2.r), nx = ddx / dist, ny = ddy / dist, f = 0;
      if (dist < rs * .62) f = -(rs * .62 - dist) * 3.4;
      else if (dist < rs * 2.2) f = .18 * (1 - dist / (rs * 2.2));
      a1.vx -= nx * f * dt; a1.vy -= ny * f * dt; a2.vx += nx * f * dt; a2.vy += ny * f * dt;
    }
    for (i = 0; i < N; i++) {
      d = DEF[i]; b = B[i];
      if (d.k === 'cur') {
        b.r = (.040 + .045 * heat) * S; b.s = 1.05; b.st = 0; continue;
      }
      var lx = asp * 1.05, ly = 1.1;                      // soft walls keep everything on screen
      if (b.x > lx) b.vx -= (b.x - lx) * 2 * dt; else if (b.x < -lx) b.vx -= (b.x + lx) * 2 * dt;
      if (b.y > ly) b.vy -= (b.y - ly) * 2 * dt; else if (b.y < -ly) b.vy -= (b.y + ly) * 2 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      var sp = Math.hypot(b.vx, b.vy);
      if (sp > .02) { var m = Math.min(1, sp * 2.5) * (1 - Math.exp(-dt * 6)); b.ux += (b.vx / sp - b.ux) * m; b.uy += (b.vy / sp - b.uy) * m; var ul = Math.hypot(b.ux, b.uy) || 1; b.ux /= ul; b.uy /= ul; }
      b.st += (Math.min(sp * .55, .9) - b.st) * (1 - Math.exp(-dt * 4));       // stretch along the direction of travel
      b.r = d.r * S * (1 + .10 * Math.sin(t * .55 + d.ph * 1.7)) + (d.k === 'orbit' ? .035 * heat : 0);
      // each blob blurs in and out on its own rhythm; moving the cursor fast makes the orbiters fuzzier
      var raw = .5 + .5 * Math.sin(t * d.sp * 1.2 + d.ph * 1.3), sm = raw * raw * (3 - 2 * raw);
      b.s = Math.min(1.1, .07 + 1.0 * sm + (d.k === 'orbit' ? .28 * heat : 0));
    }
  }

  function upload() {
    U.uTime.value = t;
    for (var i = 0; i < N; i++) { var b = B[i]; U.uBlob.value[i].set(b.x, b.y, b.r, b.s); U.uShape.value[i].set(b.ux, b.uy, b.st, 0); }
  }
  var broken = false;
  function draw() {
    if (broken) return;
    try { upload(); renderer.render(scene, cam); }
    catch (err) { broken = true; running = false; document.documentElement.classList.add('no-webgl'); canvas.style.display = 'none'; if (window.__fzDebug) window.__fzDebug('background render error: ' + (err && err.message)); }
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    var pr = renderer.getPixelRatio();
    U.uRes.value.set(w * pr, h * pr);
    asp = w / h; S = Math.min(1, .55 + .45 * asp);
    draw();
  }

  /* ---------- input ---------- */
  function point(x, y) {
    tx = (x / window.innerWidth - .5) * asp * 2; ty = -(y / window.innerHeight - .5) * 2; lastMove = t;
  }
  var targetDark = U.uDark.value, running = true, last = 0;
  if (!reduce) {
    window.addEventListener('pointermove', function (e) { point(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (e.touches[0]) point(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    window.addEventListener('scroll', function () {
      var dlt = Math.max(-.5, Math.min(.5, (window.scrollY - lastScroll) / window.innerHeight)); lastScroll = window.scrollY;
      for (var i = 0; i < N; i++) B[i].vy += dlt * 1.6;      // blobs get dragged along as the page moves
    }, { passive: true });
  }
  window.addEventListener('themechange', function () { targetDark = isDark() ? 1 : 0; if (reduce) { U.uDark.value = targetDark; draw(); } });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { running = !document.hidden; last = performance.now(); if (running && !reduce) requestAnimationFrame(frame); });
  // another WebGL scene on the page can ask for the GPU: phones struggle with two animating at once,
  // so drop to a few frames a second instead of stopping (a stopped canvas can be left blank)
  var throttled = false, lastDraw = 0;
  window.addEventListener('lava:pause', function (e) { throttled = !!e.detail; });

  function frame(now) {
    if (!running || reduce) return;
    if (throttled && now - lastDraw < 160) { requestAnimationFrame(frame); return; }
    lastDraw = now;
    var dt = Math.min((now - last) / 1000, .05); last = now;
    try { step(dt); U.uDark.value += (targetDark - U.uDark.value) * (1 - Math.exp(-dt * 4)); draw(); }
    catch (err) { broken = true; running = false; canvas.style.display = 'none'; document.documentElement.classList.add('no-webgl'); if (window.__fzDebug) window.__fzDebug('background error: ' + (err && err.message) + (err && err.stack ? ' | ' + String(err.stack).split('\n').slice(0, 2).join(' / ') : '')); return; }
    requestAnimationFrame(frame);
  }

  resize();
  for (var w = 0; w < (reduce ? 420 : 160); w++) step(1 / 40);   // warm-up so the first frame is already in motion
  if (reduce) { draw(); } else { last = performance.now(); requestAnimationFrame(frame); }
  canvas.__lava = { blobs: B, get cursor() { return [cx, cy, heat, act]; } };   // handy for debugging in the console
})();
