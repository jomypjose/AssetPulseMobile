/**
 * buildMapHtml — generates the Leaflet inline HTML for the branch network map.
 *
 * @param {Array}  branches   raw branch objects (need latitude, longitude, etc.)
 * @param {boolean} isDark    current colour scheme
 * @param {object}  opts
 *   postMessage {boolean}  when true, bubbles/pins send postMessage to React Native
 *   hideTopBar  {boolean}  when true, hides the Leaflet in-map back bar
 *                           (MapScreen uses its own RN header for navigation)
 */
export const buildMapHtml = (branches, isDark, opts = {}) => {
  const { postMessage: pm = false, hideTopBar = false } = opts;

  const branchesJson = JSON.stringify(
    branches
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        lat:   b.latitude,
        lng:   b.longitude,
        name:  b.branch_name || b.branch_code || '—',
        code:  b.branch_code || '',
        state: (b.state || 'Unknown').trim(),
        net:   b.network_count || 0,
      }))
  );

  const bgColor   = isDark ? '#080c14' : '#f8f4f3';
  const popupBg   = isDark ? '#111927' : '#ffffff';
  const popupText = isDark ? '#e8edf5' : '#0f1924';
  const popupSub  = isDark ? '#556a84' : '#6b88a8';
  const barBg     = isDark ? 'rgba(8,12,20,0.93)' : 'rgba(248,244,243,0.95)';
  const barText   = isDark ? '#e8edf5' : '#0f1924';
  const barBorder = isDark ? 'rgba(239,68,68,0.22)' : 'rgba(220,38,38,0.18)';
  const accentRed = isDark ? '#ef4444' : '#dc2626';
  const btnBg     = isDark ? 'rgba(239,68,68,0.14)' : 'rgba(220,38,38,0.08)';
  const tileUrl   = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  // JS snippet injected when postMessage is enabled
  const pmState  = pm
    ? `if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'state',name:s,count:n}));`
    : '';
  const pmOverview = pm
    ? `if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'overview'}));`
    : '';
  // Branch tap: postMessage only (no popup); fallback to popup when disabled
  const pmBranch = pm
    ? `m.on('click',(function(bb,ss){return function(){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'branch',name:bb.name,code:bb.code,state:ss,net:bb.net}));};})(b,state));`
    : `m.bindPopup(popup,{closeButton:false,maxWidth:180});`;

  const topBarDisplay = hideTopBar ? 'none !important' : '';

  return `<!DOCTYPE html><html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { width:100%; height:100%; overflow:hidden; background:${bgColor}; }
  #map { position:absolute; inset:0; }

  /* ── Top bar (drill-down) ── */
  #topbar {
    display:${hideTopBar ? 'none' : 'none'};
    position:absolute; top:0; left:0; right:0;
    height:40px; z-index:1000;
    background:${barBg};
    border-bottom:1px solid ${barBorder};
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
    align-items:center; padding:0 10px; gap:8px;
    ${topBarDisplay ? 'display:none!important;' : ''}
  }
  #topbar.visible { display:${hideTopBar ? 'none' : 'flex'}; }
  #backBtn {
    display:flex; align-items:center; gap:5px;
    background:${btnBg}; border:1px solid ${barBorder}; border-radius:8px;
    padding:5px 10px; cursor:pointer; flex-shrink:0;
    font-size:12px; font-weight:700; color:${accentRed};
  }
  #backBtn svg { flex-shrink:0; }
  #stateTitle {
    font-size:13px; font-weight:700; color:${barText};
    flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  #branchCount { font-size:11px; color:${popupSub}; flex-shrink:0; }

  /* ── Leaflet overrides ── */
  .leaflet-control-zoom { right:8px !important; bottom:8px !important; }
  .leaflet-control-zoom a {
    background:${popupBg} !important; color:${popupText} !important;
    border:1px solid ${barBorder} !important;
    width:28px !important; height:28px !important; line-height:28px !important;
    font-size:16px !important;
  }
  .leaflet-popup-content-wrapper {
    background:${popupBg}; color:${popupText};
    border-radius:12px;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
    padding:0;
  }
  .leaflet-popup-content { margin:0; }
  .leaflet-popup-tip-container { display:none; }
  .leaflet-popup-close-button { display:none; }

  /* ── State bubble ── */
  .state-bubble {
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    border-radius:50%; cursor:pointer;
    border:2.5px solid rgba(255,255,255,0.3);
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
    transition:transform 0.15s;
  }
  .state-bubble:active { transform:scale(0.92); }
  .bubble-count { font-size:12px; font-weight:800; color:#fff; line-height:1; }
  .bubble-label {
    font-size:6.5px; font-weight:600; color:rgba(255,255,255,0.85);
    max-width:88%; overflow:hidden; text-overflow:ellipsis;
    white-space:nowrap; text-align:center; margin-top:1px; letter-spacing:0.2px;
  }

  /* ── Branch pin ── */
  .branch-pin {
    display:flex; align-items:center; justify-content:center;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 3px 8px rgba(0,0,0,0.5);
    cursor:pointer;
    transition:transform 0.15s;
  }
  .branch-pin-inner {
    width:7px; height:7px; border-radius:50%;
    background:rgba(255,255,255,0.95);
    transform:rotate(45deg);
  }

  /* ── Popup card ── */
  .popup-card { padding:12px 14px; min-width:155px; }
  .popup-title { font-size:13px; font-weight:800; color:${popupText}; margin-bottom:6px; }
  .popup-row { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
  .popup-key { font-size:10.5px; color:${popupSub}; }
  .popup-val { font-size:11px; font-weight:700; color:${popupText}; }
  .popup-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:5px; vertical-align:middle; }
  .popup-hint { text-align:center; margin-top:9px; font-size:10px; color:${popupSub}; }
</style>
</head>
<body>

<div id="topbar">
  <button id="backBtn" onclick="showOverview()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentRed}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    All States
  </button>
  <span id="stateTitle"></span>
  <span id="branchCount"></span>
</div>

<div id="map"></div>

<script>
var allBranches = ${branchesJson};

// Branch/state fields come from server data and are rendered via innerHTML
// (Leaflet divIcon/popup) below — escape before splicing into any markup
// string so a branch name like "St. Mary's <img onerror=...>" can't execute.
function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

var map = L.map('map', {
  zoomControl:        true,
  dragging:           true,
  touchZoom:          true,
  scrollWheelZoom:    false,
  doubleClickZoom:    true,
  tap:                false,
  attributionControl: false,
});
L.tileLayer('${tileUrl}', { attribution:'', subdomains:'abcd', maxZoom:18 }).addTo(map);
map.zoomControl.setPosition('bottomright');

function bubbleColor(avg) {
  if (avg === 0) return '#ff5c6e';
  if (avg <  3)  return '#ffb224';
  return '#20d9a0';
}
function pinColor(net) {
  if (net === 0) return '#ff5c6e';
  if (net <  3)  return '#ffb224';
  return '#20d9a0';
}

var overviewLayer = L.layerGroup().addTo(map);
var detailLayer   = L.layerGroup();

var stateMap = {};
allBranches.forEach(function(b) {
  if (!stateMap[b.state]) stateMap[b.state] = [];
  stateMap[b.state].push(b);
});

var overviewMarkers = [];
Object.keys(stateMap).forEach(function(state) {
  var list  = stateMap[state];
  var lat   = list.reduce(function(a,b){ return a+b.lat; }, 0) / list.length;
  var lng   = list.reduce(function(a,b){ return a+b.lng; }, 0) / list.length;
  var total = list.reduce(function(a,b){ return a+b.net; }, 0);
  var avg   = total / list.length;
  var color = bubbleColor(avg);
  var n     = list.length;
  // Bubble size scales gently with branch count, capped well below typical
  // viewport size so a single state never fills the screen at high zoom.
  var size  = Math.min(48, 26 + Math.sqrt(Math.max(0, n - 1)) * 4);
  var half  = size / 2;

  var icon = L.divIcon({
    className: '',
    html: '<div class="state-bubble" style="width:'+size+'px;height:'+size+'px;background:'+color+';">'
        + '<span class="bubble-count">'+n+'</span>'
        + '<span class="bubble-label">'+esc(state)+'</span>'
        + '</div>',
    iconSize:    [size, size],
    iconAnchor:  [half, half],
    popupAnchor: [0, -(half + 4)],
  });

  var dot   = '<span class="popup-dot" style="background:'+color+'"></span>';
  var popup = '<div class="popup-card">'
    + '<div class="popup-title">'+dot+esc(state)+'</div>'
    + '<div class="popup-row"><span class="popup-key">Branches</span><span class="popup-val">'+n+'</span></div>'
    + '<div class="popup-row"><span class="popup-key">Network devices</span><span class="popup-val">'+total+'</span></div>'
    + '<div class="popup-row"><span class="popup-key">Avg / branch</span><span class="popup-val">'+avg.toFixed(1)+'</span></div>'
    + '<div class="popup-hint">Tap to explore branches →</div>'
    + '</div>';

  var s = state;
  var m = L.marker([lat, lng], { icon: icon });
  m.bindPopup(popup, { closeButton:false, maxWidth:210 });
  m.on('click', (function(s, n){ return function() {
    ${pmState}
    showState(s);
  }; })(state, n));
  overviewLayer.addLayer(m);
  overviewMarkers.push(m);
});

if (overviewMarkers.length > 0) {
  // Cap maxZoom so a single bubble (or a tight cluster) doesn't get blown up
  // to where the marker covers most of the visible map.
  map.fitBounds(L.featureGroup(overviewMarkers).getBounds().pad(0.25), { maxZoom: 6 });
} else {
  map.setView([20.5937, 78.9629], 5);
}

function showState(state) {
  map.closePopup();
  overviewLayer.remove();
  detailLayer.clearLayers();
  detailLayer.addTo(map);

  var list = stateMap[state] || [];
  document.getElementById('topbar').classList.add('visible');
  document.getElementById('stateTitle').textContent = state;
  document.getElementById('branchCount').textContent = list.length + ' branch' + (list.length !== 1 ? 'es' : '');

  var detailMarkers = [];
  list.forEach(function(b) {
    var color = pinColor(b.net);
    var size  = 30;
    var icon  = L.divIcon({
      className: '',
      html: '<div class="branch-pin" style="width:'+size+'px;height:'+size+'px;background:'+color+';">'
          + '<div class="branch-pin-inner"></div>'
          + '</div>',
      iconSize:    [size, size],
      iconAnchor:  [size/2, size],
      popupAnchor: [0, -(size + 5)],
    });

    var dot   = '<span class="popup-dot" style="background:'+color+'"></span>';
    var popup = '<div class="popup-card">'
      + '<div class="popup-title">'+dot+esc(b.name)+'</div>'
      + (b.code ? '<div class="popup-row"><span class="popup-key">Code</span><span class="popup-val">'+esc(b.code)+'</span></div>' : '')
      + '<div class="popup-row"><span class="popup-key">Network devices</span><span class="popup-val">'+b.net+'</span></div>'
      + '</div>';

    var m = L.marker([b.lat, b.lng], { icon: icon });
    ${pmBranch}
    detailLayer.addLayer(m);
    detailMarkers.push(m);
  });

  if (detailMarkers.length > 0) {
    map.fitBounds(L.featureGroup(detailMarkers).getBounds().pad(0.3), { maxZoom: 11 });
  }
}

function showOverview() {
  map.closePopup();
  document.getElementById('topbar').classList.remove('visible');
  detailLayer.remove();
  overviewLayer.addTo(map);
  ${pmOverview}
  if (overviewMarkers.length > 0) {
    map.fitBounds(L.featureGroup(overviewMarkers).getBounds().pad(0.25), { maxZoom: 6 });
  }
}
</script>
</body></html>`;
};
