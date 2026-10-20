/* Route map: a logged GPS run on the Gonda-Bahraich line, drawn on a theme-aware basemap.
   MapLibre loads only when the section nears the viewport. The route draws itself in, then a marker travels along it.
   Falls back to a plain SVG trace if WebGL or the CDN is unavailable, and holds still for reduced-motion users. */
(function () {
  var host = document.getElementById('route-map');
  if (!host) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  var JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  var DATA = host.getAttribute('data-src');
  var ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var theme = function () { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; };
  var PAINT = {
    dark:  { glow: '#8a6bff', line: '#d6ccff', runner: '#ffb870', halo: '#ffb870',
             veil: '#0d0830', veilOpacity: .72,
             base: { 'raster-brightness-max': .8, 'raster-brightness-min': 0, 'raster-saturation': -.3, 'raster-contrast': .6, 'raster-hue-rotate': 0 } },
    light: { glow: '#5b3df5', line: '#3b2bd9', runner: '#e8761e', halo: '#e8761e',
             veil: '#efeefb', veilOpacity: .30,
             base: { 'raster-brightness-max': 1, 'raster-brightness-min': .06, 'raster-saturation': -.35, 'raster-contrast': -.05, 'raster-hue-rotate': 0 } }
  };

  var map = null, coords = null, visible = false, drawn = 0, t0 = 0, state = 'idle';

  function loadCss(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  function loadJs(src) {
    return new Promise(function (ok, bad) {
      if (window.maplibregl) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });
  }
  function line(n) { return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.slice(0, Math.max(2, n)) } }; }
  function pointAt(f) {                                   // position along the route for f in [0,1)
    var x = f * (coords.length - 1), i = Math.floor(x), k = x - i, a = coords[i], b = coords[Math.min(i + 1, coords.length - 1)];
    return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] } };
  }

  /* ---- plain SVG trace, used when the map can't run ---- */
  function fallback() {
    if (!coords) return;
    var lo = Infinity, hi = -Infinity, la0 = Infinity, la1 = -Infinity, i;
    for (i = 0; i < coords.length; i++) { lo = Math.min(lo, coords[i][0]); hi = Math.max(hi, coords[i][0]); la0 = Math.min(la0, coords[i][1]); la1 = Math.max(la1, coords[i][1]); }
    var k = Math.cos(((la0 + la1) / 2) * Math.PI / 180), W = (hi - lo) * k, H = la1 - la0, s = 100 / Math.max(W, H);
    var d = coords.map(function (c, j) { return (j ? 'L' : 'M') + (((c[0] - lo) * k * s) + 6).toFixed(2) + ' ' + (((la1 - c[1]) * s) + 6).toFixed(2); }).join('');
    host.innerHTML = '<svg viewBox="0 0 ' + (W * s + 12) + ' ' + (H * s + 12) + '" role="img" aria-label="Route trace between Gonda and Bahraich" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;padding:18px">' +
      '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function applyTheme() {
    if (!map || !map.getLayer('base')) return;
    var p = PAINT[theme()];
    Object.keys(p.base).forEach(function (k) { map.setPaintProperty('base', k, p.base[k]); });
    if (map.getLayer('veil')) { map.setPaintProperty('veil', 'fill-color', p.veil); map.setPaintProperty('veil', 'fill-opacity', p.veilOpacity); }
    map.setPaintProperty('route-glow', 'line-color', p.glow);
    map.setPaintProperty('route-line', 'line-color', p.line);
    map.setPaintProperty('runner-halo', 'circle-color', p.halo);
    map.setPaintProperty('runner-dot', 'circle-color', p.runner);
  }

  function pin(lngLat, text) {
    var el = document.createElement('div'); el.className = 'pin'; el.innerHTML = '<i></i><span>' + text + '</span>';
    new maplibregl.Marker({ element: el, anchor: 'left', offset: [-6, 0] }).setLngLat(lngLat).addTo(map);
  }

  function frame(now) {
    if (!map) return;
    if (visible) {
      if (state === 'drawing') {
        var p = Math.min((now - t0) / 4200, 1), e = 1 - Math.pow(1 - p, 3);
        drawn = Math.max(2, Math.round(e * (coords.length - 1)) + 1);
        map.getSource('route').setData(line(drawn));
        if (p >= 1) { state = 'running'; t0 = now; map.setLayoutProperty('runner-halo', 'visibility', 'visible'); map.setLayoutProperty('runner-dot', 'visibility', 'visible'); }
      } else if (state === 'running') {
        var f = ((now - t0) / 19000) % 1, ease = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;   // gentle ease so it lingers at both ends
        map.getSource('runner').setData(pointAt(Math.min(ease, .9999)));
        map.setPaintProperty('runner-halo', 'circle-radius', 11 + 5 * Math.sin(now / 420));
      }
    }
    requestAnimationFrame(frame);
  }

  function init() {
    var b = coords.reduce(function (bb, c) { return bb.extend(c); }, new maplibregl.LngLatBounds(coords[0], coords[0]));
    map = new maplibregl.Map({
      container: host, bounds: b, fitBoundsOptions: { padding: 56 }, cooperativeGestures: true, attributionControl: { compact: true },
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: ATTR } },
               layers: [{ id: 'base', type: 'raster', source: 'osm', paint: PAINT[theme()].base }] }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', function () {
      var p = PAINT[theme()];
      map.addSource('veil', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } });
      map.addLayer({ id: 'veil', type: 'fill', source: 'veil', paint: { 'fill-color': p.veil, 'fill-opacity': p.veilOpacity } });
      map.addSource('route', { type: 'geojson', data: line(reduce ? coords.length : 2) });
      map.addSource('runner', { type: 'geojson', data: pointAt(reduce ? .9999 : 0) });
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.glow, 'line-width': 12, 'line-blur': 9, 'line-opacity': .75 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': p.line, 'line-width': 3 } });
      map.addLayer({ id: 'runner-halo', type: 'circle', source: 'runner', layout: { visibility: 'none' }, paint: { 'circle-color': p.halo, 'circle-radius': 12, 'circle-opacity': .28, 'circle-blur': .8 } });
      map.addLayer({ id: 'runner-dot', type: 'circle', source: 'runner', layout: { visibility: 'none' }, paint: { 'circle-color': p.runner, 'circle-radius': 5.5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      pin(coords[0], 'Gonda end'); pin(coords[coords.length - 1], 'Bahraich end');
      applyTheme();
      document.getElementById('route-loading') && document.getElementById('route-loading').remove();
      state = reduce ? 'done' : 'drawing'; t0 = performance.now();
      if (!reduce) requestAnimationFrame(frame);
    });
    window.addEventListener('themechange', applyTheme);
  }

  function start() {
    if (state !== 'idle') return; state = 'loading';
    loadCss(CSS);
    Promise.all([loadJs(JS), fetch(DATA).then(function (r) { return r.json(); })]).then(function (res) {
      coords = res[1];
      var ok = false; try { var c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) {}
      if (!ok) { fallback(); return; }
      try { init(); } catch (e) { fallback(); }
    }).catch(function () {
      fetch(DATA).then(function (r) { return r.json(); }).then(function (d) { coords = d; fallback(); }).catch(function () { host.textContent = 'The map could not load.'; });
    });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (e.isIntersecting) { if (state === 'idle') start(); if (map && state === 'drawing' && !drawn) t0 = performance.now(); }
      });
    }, { rootMargin: '200px 0px', threshold: 0 }).observe(host);
  } else { start(); visible = true; }
})();
