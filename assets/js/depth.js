/* Depth viewer: an iPhone portrait photo re-projected with its own depth map (WebGL1), plus Apple's segmentation mattes.
   Markup: <div class="dv" data-base="../assets/lora/depth/" data-ids="5757,5769"></div>
   Files per id: <id>.jpg (colour), <id>_d.png (depth, white = near), <id>_m.png (R portrait matte, G hair, B skin). */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;varying vec2 v;uniform sampler2D C,Dp,M;uniform vec2 o;uniform float mode;',
    'vec3 pal(float t){return clamp(vec3(1.6*t-.2,1.3*sin(3.14*t),1.2-1.6*t),0.,1.);}',
    'void main(){',
    // parallax with a few refinement steps so edges don't smear as much
    '  vec2 uv=v;for(int i=0;i<4;i++){float d=texture2D(Dp,uv).r;uv=v-o*(d-.42)*.035;}',
    '  vec3 c=texture2D(C,uv).rgb;float d=texture2D(Dp,uv).r;vec3 m=texture2D(M,uv).rgb;',
    '  if(mode<.5)gl_FragColor=vec4(c,1.);',
    '  else if(mode<1.5)gl_FragColor=vec4(pal(d),1.);',
    '  else{float k=mode<2.5?m.r:mode<3.5?m.g:m.b;vec3 tint=mode<2.5?vec3(.54,.42,1.):mode<3.5?vec3(1.,.72,.44):vec3(.35,.88,.65);',
    '    gl_FragColor=vec4(mix(c*.18,mix(c,tint,.45),k),1.);}',
    '}'].join('\n');
  var MODES = [['Photo', 'The portrait as shot, moved by its own depth map.'], ['Depth', 'The depth map the iPhone saved with the photo: warm is near, cool is far.'], ['Subject', "Apple's portrait matte: what the phone decided was the person."], ['Hair', 'The hair matte, separated strand by strand.'], ['Skin', 'The skin matte: face, neck and hands.']];

  function load(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }

  function mount(el) {
    var base = el.getAttribute('data-base'), ids = el.getAttribute('data-ids').split(','), cur = 0, mode = 0;
    el.innerHTML = '<div class="dv-stage"><canvas aria-label="Portrait photo re-projected with its depth map"></canvas><img class="dv-fallback" alt="" hidden></div>' +
      '<div class="dv-bar"><div class="dv-modes" role="group" aria-label="Layer"></div><button class="dv-tilt" type="button" hidden>Tilt to look around</button></div>' +
      '<p class="dv-cap"></p><div class="dv-thumbs" role="group" aria-label="Photo"></div>';
    var cv = el.querySelector('canvas'), fb = el.querySelector('.dv-fallback'), cap = el.querySelector('.dv-cap'), mb = el.querySelector('.dv-modes'), tb = el.querySelector('.dv-thumbs'), tilt = el.querySelector('.dv-tilt');
    MODES.forEach(function (m, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = m[0]; b.setAttribute('aria-pressed', i === 0); b.onclick = function () { mode = i; [].forEach.call(mb.children, function (x, j) { x.setAttribute('aria-pressed', j === i); }); cap.textContent = m[1]; draw(); }; mb.appendChild(b); });
    cap.textContent = MODES[0][1];
    ids.forEach(function (id, i) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Photo ' + (i + 1)); b.setAttribute('aria-pressed', i === 0); b.innerHTML = '<img src="' + base + id + '.jpg" alt="" loading="lazy">'; b.onclick = function () { cur = i; [].forEach.call(tb.children, function (x, j) { x.setAttribute('aria-pressed', j === i); }); show(); }; tb.appendChild(b); });

    var gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) { fb.hidden = false; cv.hidden = true; mb.hidden = true; fb.src = base + ids[0] + '.jpg'; return; }
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var pl = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
    var U = { o: gl.getUniformLocation(pr, 'o'), mode: gl.getUniformLocation(pr, 'mode') };
    ['C', 'Dp', 'M'].forEach(function (n, i) { gl.uniform1i(gl.getUniformLocation(pr, n), i); });
    var tex = [0, 1, 2].map(function () { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (w) { gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE); }); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; });
    var ready = false, ox = 0, oy = 0, tx = 0, ty = 0, active = false, raf = 0, t0 = performance.now();

    function show() {
      ready = false; var id = ids[cur];
      Promise.all([load(base + id + '.jpg'), load(base + id + '_d.png'), load(base + id + '_m.png')]).then(function (im) {
        im.forEach(function (x, i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, x); });
        ready = true; size(); draw(); loop();
      }).catch(function () { fb.hidden = false; cv.hidden = true; fb.src = base + id + '.jpg'; });
    }
    function size() { var r = cv.getBoundingClientRect(), s = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(r.width * s); cv.height = Math.round(r.height * s); gl.viewport(0, 0, cv.width, cv.height); }
    function draw() { if (!ready) return; gl.uniform2f(U.o, ox, oy); gl.uniform1f(U.mode, mode); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    function loop() {
      cancelAnimationFrame(raf);
      (function f(now) {
        if (!active && !reduce) { var t = (now - t0) / 1000; tx = Math.sin(t * .7) * .55; ty = Math.sin(t * .45) * .25; } // gentle idle sway
        ox += (tx - ox) * .12; oy += (ty - oy) * .12; draw();
        if (visible) raf = requestAnimationFrame(f);
      })(performance.now());
    }
    var visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible && ready) loop(); }).observe(cv);
    function aim(x, y) { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); }
    cv.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); active = true; aim((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1); });
    cv.addEventListener('pointerleave', function () { active = false; t0 = performance.now(); });
    window.addEventListener('resize', function () { if (ready) { size(); draw(); } });

    // phones: tilt to move. iOS 13+ needs a tap to grant motion access.
    function onTilt(e) { if (e.gamma == null) return; active = true; aim(e.gamma / 25, (e.beta - 45) / 25); }
    if (window.DeviceOrientationEvent && matchMedia('(hover: none)').matches) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        tilt.hidden = false;
        tilt.onclick = function () { DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') { window.addEventListener('deviceorientation', onTilt); tilt.hidden = true; } }).catch(function () {}); };
      } else window.addEventListener('deviceorientation', onTilt);
    }
    show();
  }
  document.querySelectorAll('.dv').forEach(mount);
})();
