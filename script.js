const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const loading = document.querySelector('#loading');
const intro = document.querySelector('#intro');
const enter = document.querySelector('#enter');
const markers = [...document.querySelectorAll('.marker')];
const markerWrap = document.querySelector('#project-markers');
const dock = document.querySelector('.dock');
const dragHint = document.querySelector('#drag-hint');
const zoneTitle = document.querySelector('#zone-title');
const panel = document.querySelector('#panel');
const panelClose = document.querySelector('#panel-close');
const railwayMapCard = document.querySelector('#railway-map-card');
const railwayMapLoading = document.querySelector('#railway-map-loading');
const railwayMapControls = [...document.querySelectorAll('[data-map-layer], [data-map-action]')];

const projects = {
  railway: {
    kicker: 'PROJECT 01 / FLAGSHIP', title: 'Railway Vision',
    copy: 'A real-time pantograph inspection system combining YOLO detection, ZED depth, GPS route context, calibrated measurements, alerts, maps, and generated reports.',
    tags: ['Computer vision', 'YOLO', 'ZED depth', 'GPS', 'FFmpeg'],
    links: [['View code', 'https://github.com/SatyamSaxena1/lucknow_running_railway'], ['Report', 'https://satyamsaxena1.github.io/lucknow_running_railway/PROJECT_TECHNICAL_REPORT.pdf']],
    map: true,
    note: 'Built for the difficult middle between a promising model and a dependable field system.'
  },
  captions: {
    kicker: 'PROJECT 02 / ACCESSIBILITY', title: 'Live Captions',
    copy: 'An accessibility-first live captioning workflow designed to make spoken information easier to follow and act on.',
    tags: ['Speech', 'Accessibility', 'Python'],
    links: [['View code', 'https://github.com/SatyamSaxena1/Subtitles-for-Visual-Impairment-Assistance-']],
    note: 'Software is most useful when more people can use it.'
  },
  highway: {
    kicker: 'PROJECT 03 / TRANSPORT', title: 'Fuzzy Highway',
    copy: 'Decision support for safer highway merging using fuzzy logic and intelligent traffic behaviour.',
    tags: ['Fuzzy logic', 'Transport', 'Decision systems'],
    links: [['View code', 'https://github.com/SatyamSaxena1/fuzzy-logic-highway-proj']],
    note: 'A small experiment in making uncertain road decisions legible.'
  },
  mindmap: {
    kicker: 'PROJECT 04 / KNOWLEDGE', title: 'Mind Map',
    copy: 'A Reddit scraper that turns saved posts into a connected, navigable personal knowledge base.',
    tags: ['Automation', 'Scraping', 'Knowledge tools'],
    links: [['View code', 'https://github.com/SatyamSaxena1/reddit-scraper-for-mind-map-project']],
    note: 'Saved information becomes useful when its relationships are visible.'
  },
  about: {
    kicker: 'ABOUT / SATYAM SAXENA', title: 'The Engineer',
    copy: 'I build applied AI systems around computer vision, geospatial context, and hardware-aware software. I care about the full path from camera feed and calibration to reporting and deployment.',
    tags: ['Applied AI', 'Computer vision', 'Systems'], links: [['GitHub profile', 'https://github.com/SatyamSaxena1']],
    note: 'Based in Lucknow, India. Curious about hard real-world systems.'
  },
  stack: {
    kicker: 'TOOLBOX / FREQUENTLY USED', title: 'Open Tabs',
    copy: 'The planet runs on practical tools selected for the job, from model inference and depth streams to interfaces, data handling, and deployment.',
    tags: ['Python', 'OpenCV', 'YOLO', 'ZED Camera', 'TensorRT', 'PyQt6', 'FFmpeg', 'Pandas', 'GPS Data'], links: [],
    note: 'Heavy model binaries stay out of GitHub; the source, docs, maps, and utilities stay visible.'
  }
};

let width = 0, height = 0, dpr = 1, radius = 0, cx = 0, cy = 0;
let rotation = .4, targetRotation = .4, exploring = false, dragging = false, lastX = 0;
const objects = [];
const colors = ['#a9b99f', '#7ca079', '#d7ba91', '#c98b72', '#98aaa0', '#e0d5ad'];
let maplibrePromise = null, railwayDataPromise = null, railwayMap = null, railwayBounds = null;
let routeVisible = true, pointsVisible = true;
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';

function random(seed) { const x = Math.sin(seed * 999.31) * 43758.5453; return x - Math.floor(x); }
for (let i = 0; i < 72; i += 1) {
  const angle = random(i + 2) * Math.PI * 2;
  const distance = Math.sqrt(random(i + 90)) * .83;
  objects.push({ angle, distance, size: .025 + random(i + 20) * .05, type: i % 6, color: colors[i % colors.length] });
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth; height = window.innerHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  radius = Math.min(width, height) * (exploring ? (width < 700 ? .32 : .38) : .31);
  cx = width * .5; cy = height * (exploring ? .49 : .43);
}

function roughCircle(x, y, r, fill, stroke = '#3f4850', line = 2) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i += 1) {
    const a = i / 32 * Math.PI * 2;
    const rr = r * (1 + Math.sin(i * 4.73) * .012);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke();
}

function tree(x, y, s) {
  ctx.fillStyle = '#745f4d'; ctx.fillRect(x - s * .08, y, s * .16, s * .52);
  roughCircle(x, y - s * .1, s * .43, '#568163', '#3f4850', 1.5);
  roughCircle(x - s * .2, y + s * .04, s * .3, '#6f996d', '#3f4850', 1.3);
}

function house(x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin((x + y) * .01) * .1);
  ctx.fillStyle = color; ctx.strokeStyle = '#3f4850'; ctx.lineWidth = 1.5;
  ctx.fillRect(-s * .42, -s * .18, s * .84, s * .58); ctx.strokeRect(-s * .42, -s * .18, s * .84, s * .58);
  ctx.beginPath(); ctx.moveTo(-s * .53, -s * .18); ctx.lineTo(0, -s * .55); ctx.lineTo(s * .53, -s * .18); ctx.closePath(); ctx.fillStyle = '#d8755d'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#edf1df'; ctx.fillRect(-s * .11, s * .08, s * .22, s * .32); ctx.strokeRect(-s * .11, s * .08, s * .22, s * .32); ctx.restore();
}

function drawWorld() {
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#8ac8c5'; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 25; i += 1) {
    const x = random(i + 300) * width, y = random(i + 500) * height;
    ctx.fillStyle = i % 3 ? 'rgba(245,245,221,.45)' : 'rgba(76,117,117,.15)';
    roughCircle(x, y, 1 + random(i) * 3, ctx.fillStyle, 'transparent', 0);
  }
  ctx.save(); ctx.translate(cx, cy + radius * .12); ctx.scale(1, .3); roughCircle(0, radius * .9, radius * .72, 'rgba(55,79,82,.2)', 'transparent', 0); ctx.restore();
  roughCircle(cx, cy, radius, '#90a982', '#3f4850', 3);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.clip();
  const sections = ['#b8b59b','#83a37a','#d4b48c','#7d9c8c','#c9856c','#a3ad8d'];
  sections.forEach((color, i) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius * 1.03, rotation + i * Math.PI / 3, rotation + (i + 1) * Math.PI / 3); ctx.fillStyle = color; ctx.fill(); });
  ctx.strokeStyle = '#57605b'; ctx.lineWidth = Math.max(5, radius * .027); ctx.setLineDash([radius * .08, radius * .025]);
  ctx.beginPath(); ctx.arc(cx, cy, radius * .58, rotation, rotation + Math.PI * 1.65); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#d9ded0'; ctx.lineWidth = Math.max(2, radius * .01); ctx.beginPath(); ctx.arc(cx, cy, radius * .58, rotation, rotation + Math.PI * 1.65); ctx.stroke();
  const sorted = objects.map((o) => {
    const a = o.angle + rotation, px = Math.cos(a) * o.distance, py = Math.sin(a) * o.distance;
    return { ...o, x: cx + px * radius, y: cy + py * radius * .82, depth: py };
  }).sort((a, b) => a.depth - b.depth);
  sorted.forEach((o) => {
    const edge = Math.sqrt(((o.x-cx)/radius) ** 2 + ((o.y-cy)/(radius*.82)) ** 2);
    const s = radius * o.size * (.75 + (o.depth + 1) * .22) * Math.max(.5, 1 - edge * .2);
    if (o.type < 3) tree(o.x, o.y, s * 1.3); else house(o.x, o.y, s * 1.8, o.color);
  });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx - radius*.18, cy - radius*.2, radius*.73, Math.PI*1.04, Math.PI*1.62); ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation * .18 - .2);
  ctx.strokeStyle = '#3f4850'; ctx.lineWidth = Math.max(3, radius * .014); ctx.fillStyle = '#e9e2c7';
  ctx.fillRect(-radius*.32,-radius*.08,radius*.64,radius*.16); ctx.strokeRect(-radius*.32,-radius*.08,radius*.64,radius*.16);
  for (let i=-2;i<=2;i+=1){ctx.fillStyle=i%2?'#e8785f':'#f3db64';ctx.fillRect(i*radius*.11-radius*.045,-radius*.055,radius*.09,radius*.11);ctx.strokeRect(i*radius*.11-radius*.045,-radius*.055,radius*.09,radius*.11)}
  ctx.restore();
}

function updateMarkers() {
  const angles = [-1.2, .25, 1.55, 2.85];
  markers.forEach((marker, i) => {
    const a = angles[i] + rotation;
    const x = cx + Math.cos(a) * radius * .88;
    const y = cy + Math.sin(a) * radius * .68;
    const back = Math.sin(a) < -.35;
    marker.style.left = `${x}px`; marker.style.top = `${y}px`;
    marker.style.transform = `translate(-50%,-50%) scale(${back ? .82 : 1})`;
    marker.style.opacity = back ? '.45' : '1'; marker.style.zIndex = back ? '1' : '3';
  });
  const zones = ['VISION DISTRICT','SYSTEMS QUARTER','DATA GARDENS','DEPLOYMENT YARD'];
  zoneTitle.textContent = zones[Math.floor((((rotation % (Math.PI*2)) + Math.PI*2) % (Math.PI*2)) / (Math.PI/2)) % 4];
}

function animate() {
  if (!dragging) targetRotation += exploring ? .0009 : .00035;
  rotation += (targetRotation - rotation) * .08;
  drawWorld(); if (exploring) updateMarkers(); requestAnimationFrame(animate);
}

function explore() {
  if (exploring) return; exploring = true; intro.classList.add('exploring');
  markerWrap.classList.add('visible'); dock.classList.add('visible'); dragHint.classList.add('visible'); zoneTitle.classList.add('visible');
  setTimeout(() => { intro.hidden = true; }, 800); resize();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      if (window.maplibregl && src === MAPLIBRE_JS) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}

function loadMapLibre() {
  if (!maplibrePromise) {
    loadStylesheet(MAPLIBRE_CSS);
    maplibrePromise = loadScript(MAPLIBRE_JS).then(() => window.maplibregl);
  }
  return maplibrePromise;
}

function loadRailwayData() {
  if (!railwayDataPromise) {
    railwayDataPromise = loadScript('assets/railway-map-data.js').then(() => window.RAILWAY_ROUTE_COORDINATES || []);
  }
  return railwayDataPromise;
}

function railwayMapStyle() {
  const arcgisKey = window.ARCGIS_API_KEY;
  if (arcgisKey) {
    return `https://basemaps-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation?token=${encodeURIComponent(arcgisKey)}`;
  }
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  };
}

function railwayFeatures(coords) {
  return {
    route: { type: 'Feature', properties: { name: 'Lucknow-Gonda inspection route' }, geometry: { type: 'LineString', coordinates: coords } },
    points: {
      type: 'FeatureCollection',
      features: coords.map((coordinate, index) => ({
        type: 'Feature',
        properties: { point: index + 1, lon: coordinate[0], lat: coordinate[1] },
        geometry: { type: 'Point', coordinates: coordinate }
      }))
    }
  };
}

function resetRailwayMap() {
  if (!railwayMap || !railwayBounds) return;
  railwayMap.fitBounds(railwayBounds, { padding: 34, duration: 700, maxZoom: 12 });
}

function setLayerVisibility(ids, visible) {
  if (!railwayMap) return;
  ids.forEach((id) => {
    if (railwayMap.getLayer(id)) railwayMap.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  });
}

function updateRailwayLayerControls() {
  railwayMapControls.forEach((button) => {
    if (button.dataset.mapLayer === 'route') button.setAttribute('aria-pressed', routeVisible ? 'true' : 'false');
    if (button.dataset.mapLayer === 'points') button.setAttribute('aria-pressed', pointsVisible ? 'true' : 'false');
  });
}

async function initRailwayMap() {
  if (railwayMap) {
    setTimeout(() => { railwayMap.resize(); resetRailwayMap(); }, 80);
    return;
  }
  try {
    const [maplibregl, coords] = await Promise.all([loadMapLibre(), loadRailwayData()]);
    if (!coords.length) throw new Error('No railway route coordinates found');
    const features = railwayFeatures(coords);
    railwayMap = new maplibregl.Map({ container: 'railway-map', style: railwayMapStyle(), center: [81.79, 27.38], zoom: 9, attributionControl: true });
    railwayMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const setupRailwayLayers = () => {
      if (!railwayMap || railwayMap.getSource('railway-route')) return;
      railwayMap.addSource('railway-route', { type: 'geojson', data: features.route });
      railwayMap.addSource('inspection-points', { type: 'geojson', data: features.points, cluster: true, clusterMaxZoom: 13, clusterRadius: 34 });
      railwayMap.addLayer({ id: 'railway-route-casing', type: 'line', source: 'railway-route', paint: { 'line-color': '#3f4850', 'line-width': 8, 'line-opacity': .95 } });
      railwayMap.addLayer({ id: 'railway-route-line', type: 'line', source: 'railway-route', paint: { 'line-color': '#f3db64', 'line-width': 4 } });
      railwayMap.addLayer({ id: 'inspection-clusters', type: 'circle', source: 'inspection-points', filter: ['has', 'point_count'], paint: { 'circle-color': '#e8785f', 'circle-radius': ['step', ['get', 'point_count'], 15, 50, 20, 200, 25], 'circle-stroke-color': '#3f4850', 'circle-stroke-width': 2 } });
      railwayMap.addLayer({ id: 'inspection-cluster-count', type: 'symbol', source: 'inspection-points', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': '#3f4850' } });
      railwayMap.addLayer({ id: 'inspection-point', type: 'circle', source: 'inspection-points', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#f8f7f1', 'circle-radius': 5, 'circle-stroke-color': '#3f4850', 'circle-stroke-width': 2 } });
      railwayBounds = coords.reduce((bounds, coordinate) => bounds.extend(coordinate), new maplibregl.LngLatBounds(coords[0], coords[0]));
      resetRailwayMap();
      railwayMapLoading.classList.add('hidden');
    };
    const setupWhenStyleReady = (tries = 40) => {
      try {
        setupRailwayLayers();
      } catch (error) {
        if (tries && /style/i.test(error.message)) {
          setTimeout(() => setupWhenStyleReady(tries - 1), 250);
          return;
        }
        railwayMapLoading.textContent = 'MAP LAYERS COULD NOT LOAD';
        console.error('Railway map layers failed to initialize', error);
      }
    };
    setTimeout(setupWhenStyleReady, 250);
    railwayMap.on('style.load', setupWhenStyleReady);
    railwayMap.on('load', setupRailwayLayers);
    railwayMap.on('styledata', () => { if (railwayMap.isStyleLoaded()) setupWhenStyleReady(); });
    railwayMap.on('click', 'inspection-clusters', (event) => {
      const featuresAtPoint = railwayMap.queryRenderedFeatures(event.point, { layers: ['inspection-clusters'] });
      const clusterId = featuresAtPoint[0].properties.cluster_id;
      railwayMap.getSource('inspection-points').getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (!error) railwayMap.easeTo({ center: featuresAtPoint[0].geometry.coordinates, zoom });
      });
    });
    railwayMap.on('click', 'inspection-point', (event) => {
      const props = event.features[0].properties;
      new maplibregl.Popup({ closeButton: false, offset: 10 }).setLngLat(event.features[0].geometry.coordinates).setHTML(`<strong>Inspection Point ${props.point}</strong><br>${Number(props.lat).toFixed(6)}, ${Number(props.lon).toFixed(6)}`).addTo(railwayMap);
    });
    ['inspection-clusters', 'inspection-point'].forEach((layer) => {
      railwayMap.on('mouseenter', layer, () => { railwayMap.getCanvas().style.cursor = 'pointer'; });
      railwayMap.on('mouseleave', layer, () => { railwayMap.getCanvas().style.cursor = ''; });
    });
  } catch (error) {
    railwayMapLoading.textContent = 'MAP COULD NOT LOAD';
    console.error('Railway map failed to initialize', error);
  }
}

function openPanel(key) {
  const data = projects[key]; if (!data) return;
  document.querySelector('#panel-kicker').textContent = data.kicker;
  document.querySelector('#panel-title').textContent = data.title;
  document.querySelector('#panel-copy').textContent = data.copy;
  document.querySelector('#panel-tags').innerHTML = data.tags.map(tag => `<span>${tag}</span>`).join('');
  document.querySelector('#panel-links').innerHTML = data.links.map(([label, url]) => `<a href="${url}">${label} &nearr;</a>`).join('');
  document.querySelector('#panel-note').textContent = data.note;
  railwayMapCard.hidden = !data.map;
  panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  if (data.map) initRailwayMap();
}

enter.addEventListener('click', explore);
document.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.project)));
document.querySelectorAll('[data-panel]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.panel)));
railwayMapControls.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.mapLayer === 'route') {
    routeVisible = !routeVisible;
    setLayerVisibility(['railway-route-casing', 'railway-route-line'], routeVisible);
  }
  if (button.dataset.mapLayer === 'points') {
    pointsVisible = !pointsVisible;
    setLayerVisibility(['inspection-clusters', 'inspection-cluster-count', 'inspection-point'], pointsVisible);
  }
  if (button.dataset.mapAction === 'reset') resetRailwayMap();
  updateRailwayLayerControls();
}));
panelClose.addEventListener('click', () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') panelClose.click(); if (e.key === 'Enter' && !exploring) explore(); });
canvas.addEventListener('pointerdown', e => { if (!exploring) return; dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!dragging) return; targetRotation += (e.clientX - lastX) * .007; lastX = e.clientX; });
canvas.addEventListener('pointerup', () => { dragging = false; dragHint.style.opacity = '0'; });
canvas.addEventListener('wheel', e => { if (exploring) targetRotation += e.deltaY * .0007; }, { passive: true });
window.addEventListener('resize', resize);

resize(); animate();
window.addEventListener('load', () => setTimeout(() => loading.classList.add('hidden'), 500));
