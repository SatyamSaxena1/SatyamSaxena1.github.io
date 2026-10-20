/* Animated neo-futuristic background: one full-screen shader (Three.js). Falls back to CSS gradients without WebGL. */
(function () {
  var canvas = document.getElementById('bg');
  if (!canvas || !window.THREE) { document.documentElement.classList.add('no-webgl'); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (e) { document.documentElement.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isDark = function () { return document.documentElement.getAttribute('data-theme') !== 'light'; };

  var uniforms = {
    uTime: { value: 0 }, uDark: { value: isDark() ? 1 : 0 }, uScroll: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(.5, .5) }
  };

  var frag = [
    'precision highp float;',
    'uniform vec2 uRes, uMouse; uniform float uTime, uDark, uScroll;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float sdCap(vec2 p, vec2 a, vec2 b, float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}',
    'vec3 over(vec3 base, vec3 c, float a){return mix(base,c,clamp(a,0.,1.));}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.)*2.;',
    '  float asp=uRes.x/uRes.y;',
    '  float t=uTime*.16;',
    '  vec2 m=(uMouse-.5)*vec2(asp,1.);',
    '  p.y+=uScroll*.35;',
    '  float D=uDark;',
    '  vec3 col=mix(vec3(.958,.953,.99),vec3(.012,.012,.034),D);',

    '  // big ring (top centre): dark disc with an indigo rim',
    '  vec2 rc=vec2(.15*asp*.35+.05*sin(t*.9), 1.18+.05*cos(t*.8))+m*.05;',
    '  float rd=length(p-rc), rr=1.2;',
    '  float rim=exp(-abs(rd-rr)*16.);',
    '  col=over(col, mix(vec3(.62,.58,.98),vec3(.10,.07,.42),D), rim*mix(.35,.75,D));',
    '  col=over(col, mix(vec3(.9,.88,1.),vec3(.05,.035,.09),D), smoothstep(rr,rr-.9,rd)*mix(.28,.6,D));',

    '  // violet + amber haze (bottom left)',
    '  vec2 g1=vec2(-asp*.78+.16*sin(t*1.2),-.82+.12*cos(t*1.05))+m*.22;',
    '  float d1=length((p-g1)*vec2(.78,1.05));',
    '  col=over(col, mix(vec3(.74,.60,1.),vec3(.40,.24,.76),D), exp(-d1*d1*1.35)*mix(.62,.82,D));',
    '  vec2 g2=g1+vec2(-.12+.1*sin(t*1.6),-.34)+m*.1;',
    '  float d2=length(p-g2);',
    '  col=over(col, mix(vec3(1.,.78,.5),vec3(.62,.46,.2),D), exp(-d2*d2*4.2)*mix(.5,.5,D));',

    '  // glossy capsule (top right): electric blue rim, dark core',
    '  vec2 a=vec2(asp*.78+.08*sin(t*1.1), .78+.07*cos(t*1.3))+m*.15;',
    '  vec2 b=a+vec2(-.34+.06*sin(t*.7), -.42);',
    '  float s=sdCap(p,a,b,.33);',
    '  float body=smoothstep(.012,-.012,s);',
    '  float n=clamp(-s/.33,0.,1.);',
    '  vec3 blue=mix(vec3(.5,.6,1.),vec3(.16,.2,1.),D);',
    '  vec3 core=mix(vec3(.8,.7,1.),vec3(.03,.0,.1),D);',
    '  vec3 cap=mix(blue,core,smoothstep(.15,.95,n));',
    '  cap+=pow(1.-n,3.)*mix(vec3(.2,.2,.4),vec3(.28,.25,.8),D)*(.6+.4*sin(t*2.+p.x*3.));',
    '  col=over(col, mix(vec3(.55,.6,1.),vec3(.12,.16,.95),D), exp(-max(s,0.)*4.5)*mix(.28,.42,D));',
    '  col=mix(col,cap,body);',

    '  // small drifting orb (middle left) + faint orb (bottom right)',
    '  vec2 o=vec2(-asp*.42+.2*sin(t*.9),.18+.2*cos(t*.7))+m*.3;',
    '  col=over(col, mix(vec3(.6,.7,1.),vec3(.2,.3,1.),D), exp(-dot(p-o,p-o)*9.)*mix(.35,.28,D));',
    '  vec2 q=vec2(asp*.62+.1*cos(t),-.7+.1*sin(t*1.3))+m*.18;',
    '  col=over(col, mix(vec3(.85,.7,1.),vec3(.36,.18,.7),D), exp(-dot(p-q,p-q)*3.)*mix(.4,.36,D));',

    '  // grain + vignette',
    '  col+=(hash(gl_FragCoord.xy+fract(uTime)*91.)-.5)*mix(.018,.04,D);',
    '  col*=1.-dot(uv-.5,uv-.5)*mix(.12,.45,D);',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: frag, depthTest: false, depthWrite: false
  });
  var scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    var pr = renderer.getPixelRatio();
    uniforms.uRes.value.set(w * pr, h * pr);
    draw();
  }
  function draw() { renderer.render(scene, cam); }

  var target = { x: .5, y: .5 }, targetDark = uniforms.uDark.value, running = true, last = 0;
  window.addEventListener('pointermove', function (e) { target.x = e.clientX / window.innerWidth; target.y = 1 - e.clientY / window.innerHeight; }, { passive: true });
  window.addEventListener('scroll', function () { uniforms.uScroll.value = Math.min(window.scrollY / window.innerHeight, 3); if (reduce) draw(); }, { passive: true });
  window.addEventListener('themechange', function () { targetDark = isDark() ? 1 : 0; if (reduce) { uniforms.uDark.value = targetDark; draw(); } });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running && !reduce) requestAnimationFrame(frame); });

  function frame(now) {
    if (!running || reduce) return;
    var dt = Math.min((now - last) / 1000, .1); last = now;
    uniforms.uTime.value += dt;
    var k = 1 - Math.exp(-dt * 3);
    uniforms.uMouse.value.x += (target.x - uniforms.uMouse.value.x) * k;
    uniforms.uMouse.value.y += (target.y - uniforms.uMouse.value.y) * k;
    uniforms.uDark.value += (targetDark - uniforms.uDark.value) * (1 - Math.exp(-dt * 4));
    draw();
    requestAnimationFrame(frame);
  }
  resize();
  if (reduce) { uniforms.uTime.value = 8; draw(); } else requestAnimationFrame(frame);
})();
