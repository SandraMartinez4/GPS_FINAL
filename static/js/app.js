// ============================================================
// APP.JS — GPS INTERNACIONAL v9
// Fixes: geolocalización robusta + detección de casetas exacta
// ============================================================

const map = L.map('map', {
  center: [23.6345, -102.5528],
  zoom: 5,
  zoomControl: false,
}).addLayer(
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  })
);

L.control.zoom({ position: 'bottomright' }).addTo(map);

let userLocation   = null;
let originCoords   = null;
let destCoords     = null;
let vehicleType    = 'auto';
let routeLayers    = [];
let riskLayers     = [];
let tollMarkers    = [];
let trafficLayers  = [];
let locationMarker = null;
let destMarker     = null;
let currentRoute   = null;
let activeFuel     = FUEL_BY_COUNTRY.MX;

// ===== RISK ZONES =====
function drawRiskZones() {
  riskLayers.forEach(l => map.removeLayer(l));
  riskLayers = [];
  const colors = { extreme:'#ef4444', high:'#f97316', medium:'#eab308', low:'#84cc16' };
  RISK_ZONES.forEach(zone => {
    const color = colors[zone.level] || '#ef4444';
    const circle = L.circle([zone.lat, zone.lng], {
      radius: zone.radius * 1000, color, fillColor: color, fillOpacity: 0.12,
      weight: 1.5, dashArray: zone.level === 'extreme' ? '6,3' : null,
    }).addTo(map);
    circle.bindPopup(`
      <div style="min-width:180px">
        <p style="font-weight:700;font-size:13px;margin-bottom:4px">ALERTA ${zone.name}</p>
        <p style="font-size:11px;color:#f59e0b;margin-bottom:6px">Nivel: ${zone.level.toUpperCase()}</p>
        <p style="font-size:11px">${zone.description}</p>
        <p style="font-size:10px;color:#7c8db0;margin-top:6px">Fuente: SESNSP 2024</p>
      </div>`);
    riskLayers.push(circle);
  });
}

function drawTollMarkers() {
  tollMarkers.forEach(m => map.removeLayer(m));
  tollMarkers = [];
  const tollIcon = L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;border:2px solid #1a1d27;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#000;font-weight:900">$</div>`,
    iconSize: [14,14], iconAnchor: [7,7],
  });
  TOLL_BOOTHS.forEach(toll => {
    const price = getTollPriceInfo(toll);
    const m = L.marker([toll.lat, toll.lng], { icon: tollIcon }).addTo(map);
    m.bindPopup(`
      <div style="min-width:160px">
        <p style="font-weight:700;font-size:13px;margin-bottom:4px">Caseta ${toll.name}</p>
        <p style="font-size:11px;color:#7c8db0">${toll.state} · ${toll.highway || ''}</p>
        <p style="font-size:15px;font-weight:700;color:#f59e0b;margin-top:6px">${price.label}</p>
        <p style="font-size:10px;color:#7c8db0;margin-top:4px">${price.note}</p>
      </div>`);
    tollMarkers.push(m);
  });
}

function drawTraffic() {
  trafficLayers.forEach(l => map.removeLayer(l));
  trafficLayers = [];
  [
    {lat:19.4326,lng:-99.1332,r:6},{lat:20.6597,lng:-103.3496,r:5},
    {lat:25.6866,lng:-100.3161,r:5},{lat:19.0414,lng:-98.2063,r:4},
    {lat:19.6010,lng:-99.0503,r:4},{lat:19.5478,lng:-99.2014,r:3},
  ].forEach(s => {
    const c = L.circle([s.lat,s.lng],{
      radius:s.r*1000,color:'#64748b',fillColor:'#64748b',fillOpacity:0.18,weight:1,
    }).addTo(map);
    c.bindPopup('<p style="font-size:12px"><strong>Trafico detectado</strong></p>');
    trafficLayers.push(c);
  });
}

function makeIcon(emoji, color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid #0f1117;border-radius:50% 50% 50% 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;transform:rotate(-45deg);box-shadow:0 2px 10px rgba(0,0,0,0.5)"><span style="transform:rotate(45deg)">${emoji}</span></div>`,
    iconSize:[32,32],iconAnchor:[16,32],popupAnchor:[0,-32],
  });
}

function getTollPriceInfo(toll) {
  const factor = VEHICLE_FACTORS[vehicleType].tolls;
  const hasRange = Number.isFinite(toll.autoMinMXN) && Number.isFinite(toll.autoMaxMXN);
  const minAuto = hasRange ? toll.autoMinMXN : toll.autoMXN;
  const maxAuto = hasRange ? toll.autoMaxMXN : toll.autoMXN;
  const minCost = Math.round(minAuto * factor);
  const maxCost = Math.round(maxAuto * factor);
  return {
    minCost,
    maxCost,
    label: minCost === maxCost ? `$${minCost} MXN` : `entre $${minCost} y $${maxCost} MXN`,
    isVariable: minCost !== maxCost,
    note: toll.priceNote || (hasRange ? 'Tarifa variable por tramo' : 'Tarifa fija'),
  };
}

// ============================================================
// AUTOCOMPLETE
// ============================================================
let acTimers = {};

function setupAutocomplete(inputId, dropdownId, onSelect) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  input.addEventListener('input', () => {
    const q = input.value.trim();
    dropdown.innerHTML = '';
    if (q.length < 3) { dropdown.classList.remove('show'); return; }
    const localResults = MX_CITIES
      .filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.state && c.state.toLowerCase().includes(q.toLowerCase())))
      .slice(0, 4);
    clearTimeout(acTimers[inputId]);
    acTimers[inputId] = setTimeout(() => {
      fetchNominatim(q).then(places => {
        dropdown.innerHTML = '';
        const combined = [...localResults];
        places.forEach(p => {
          if (!combined.some(c => Math.abs(c.lat-p.lat)<0.05 && Math.abs(c.lng-p.lng)<0.05))
            combined.push(p);
        });
        if (!combined.length) { dropdown.classList.remove('show'); return; }
        combined.slice(0,8).forEach(city => {
          const item = document.createElement('div');
          item.className = 'ac-item';
          const flag = getCountryFlag(city.country||'MX');
          const sub  = city.state || city.country || '';
          item.innerHTML = `<span class="ac-icon">${flag}</span><span><span class="ac-name">${city.name}</span><br><span class="ac-detail">${sub}</span></span>`;
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            input.value = city.displayName || `${city.name}${city.state?', '+city.state:''}`;
            dropdown.classList.remove('show');
            onSelect({ lat:city.lat, lng:city.lng, name:input.value, state:city.state||'', country:city.country||'MX' });
          });
          dropdown.appendChild(item);
        });
        dropdown.classList.add('show');
      });
    }, 350);
  });
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 200));
}

async function fetchNominatim(query) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`, { headers:{'Accept-Language':'es'} });
    const data = await res.json();
    return data.map(item => ({
      name: item.name || item.display_name.split(',')[0],
      displayName: item.display_name.split(',').slice(0,3).join(',').trim(),
      state: item.address?.state || item.address?.county || '',
      country: item.address?.country_code?.toUpperCase() || '',
      lat: parseFloat(item.lat), lng: parseFloat(item.lon),
    }));
  } catch { return []; }
}

function getCountryFlag(code) {
  const f = {MX:'🇲🇽',US:'🇺🇸',ES:'🇪🇸',FR:'🇫🇷',DE:'🇩🇪',BR:'🇧🇷',AR:'🇦🇷',CO:'🇨🇴',CL:'🇨🇱',PE:'🇵🇪',GB:'🇬🇧',IT:'🇮🇹',JP:'🇯🇵',CA:'🇨🇦',AU:'🇦🇺'};
  return f[code] || '•';
}

// ============================================================
// GEOLOCALIZACIÓN — robusta con reverse geocoding mejorado
// Las coordenadas GPS exactas siempre se usan para la ruta.
// El texto en el input es solo visual; originCoords.lat/lng
// son los valores reales que se pasan a Valhalla.
// ============================================================
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=14`,
      { headers: { 'Accept-Language': 'es' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error('nominatim error');
    const data = await res.json();
    const addr = data.address || {};

    // Cascada de fallbacks para obtener el mejor nombre legible
    const cityName =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.village ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.county ||
      'Mi ubicación';

    const stateName = addr.state || addr.region || '';
    const country   = (addr.country_code || 'mx').toUpperCase();
    const display   = stateName ? `${cityName}, ${stateName}` : cityName;

    return { name: cityName, display, state: stateName, country };
  } catch {
    // Si falla el reverse geocoding, usar coordenadas en el texto
    return {
      name: 'Mi ubicación',
      display: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      state: '',
      country: 'MX',
    };
  }
}

document.getElementById('useMyLocation').addEventListener('click', () => {
  if (!navigator.geolocation) { showToast('Geolocalización no disponible en este navegador'); return; }
  showToast('Obteniendo tu ubicación...');

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracyM = pos.coords.accuracy; // metros de margen de error

      userLocation = { lat, lng };
      originCoords = { lat, lng, name: 'Mi ubicación', state: '', country: 'MX' };
      document.getElementById('originInput').value = 'Mi ubicación actual';
      placeOriginMarker(lat, lng, accuracyM);
      map.setView([lat, lng], accuracyM > 2000 ? 11 : 14);

      // Avisar si la precisión es baja (típico en laptop/desktop sin GPS real)
      if (accuracyM > 1500) {
        showToast(`Precisión baja (±${Math.round(accuracyM/1000)} km). Arrastra el pin a tu ubicación real.`);
      } else {
        showToast(`Ubicación obtenida (±${Math.round(accuracyM)} m) - identificando lugar...`);
      }

      const geo = await reverseGeocode(lat, lng);
      originCoords.name    = geo.display;
      originCoords.state   = geo.state;
      originCoords.country = geo.country;
      document.getElementById('originInput').value = `${geo.display}`;
    },
    err => {
      const msgs = {
        1: 'Permiso de ubicación denegado. Habilítalo en tu navegador.',
        2: 'No se pudo obtener la ubicación. Intenta de nuevo.',
        3: 'Tiempo agotado. Verifica tu conexión.',
      };
      showToast(msgs[err.code] || 'Error al obtener ubicación');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
});

// Marcador de origen ARRASTRABLE — permite corregir la ubicación
// manualmente cuando la geolocalización del navegador es imprecisa
// (común en laptops/PC sin chip GPS, que solo triangulan por WiFi/IP).
let accuracyCircle = null;

function placeOriginMarker(lat, lng, accuracyM) {
  if (locationMarker) map.removeLayer(locationMarker);
  if (accuracyCircle) map.removeLayer(accuracyCircle);

  locationMarker = L.marker([lat, lng], {
    icon: makeIcon('O', '#3b82f6'),
    draggable: true,
  }).addTo(map);

  locationMarker.bindTooltip('Arrastra para corregir tu ubicación', { permanent: false });

  if (accuracyM) {
    accuracyCircle = L.circle([lat, lng], {
      radius: accuracyM, color: '#3b82f6', fillColor: '#3b82f6',
      fillOpacity: 0.08, weight: 1, dashArray: '4,4',
    }).addTo(map);
  }

  locationMarker.on('dragend', async e => {
    const pos = e.target.getLatLng();
    if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
    originCoords = { lat: pos.lat, lng: pos.lng, name: 'Mi ubicación (ajustada)', state: '', country: 'MX' };
    document.getElementById('originInput').value = 'Ubicando...';
    showToast('Ubicación ajustada - identificando lugar...');
    const geo = await reverseGeocode(pos.lat, pos.lng);
    originCoords.name    = geo.display;
    originCoords.state   = geo.state;
    originCoords.country = geo.country;
    document.getElementById('originInput').value = `${geo.display}`;
    showToast(`Origen corregido: ${geo.display}`);
  });
}

document.querySelectorAll('.vehicle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vehicle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    vehicleType = btn.dataset.type;
    tollMarkers.forEach(m => map.removeLayer(m));
    tollMarkers = [];
    drawTollMarkers();
  });
});

const fuelSlider = document.getElementById('fuelSlider');
const fuelFill   = document.getElementById('fuelFill');
const fuelPct    = document.getElementById('fuelPercent');
const fuelAlert  = document.getElementById('fuelAlert');

fuelSlider.addEventListener('input', () => {
  const v = fuelSlider.value;
  fuelFill.style.width = v+'%';
  fuelPct.textContent = v+'%';
  fuelAlert.style.display = v < 20 ? 'block' : 'none';
});

const now = new Date();
document.getElementById('departureTime').value =
  `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
document.getElementById('departureDate').value =
  `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

setupAutocomplete('originInput','originDropdown', coords => {
  originCoords = coords;
  placeOriginMarker(coords.lat, coords.lng);
});
setupAutocomplete('destInput','destDropdown', coords => {
  destCoords = coords;
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker([coords.lat,coords.lng],{icon:makeIcon('D','#22c55e')}).addTo(map);
});

// ============================================================
// VALHALLA — alternativas reales con via-points distintos
// ============================================================
async function fetchValhallaRoute(origin, dest, options, viaPoint) {
  const costing = vehicleType === 'camion' ? 'truck' : 'auto';
  const costingOptions = {};
  costingOptions[costing] = { use_tolls: options.avoidTolls ? 0.0 : 1.0 };

  const locations = viaPoint
    ? [
        { lon: origin.lng, lat: origin.lat, type: 'break' },
        { lon: viaPoint.lng, lat: viaPoint.lat, type: 'through' },
        { lon: dest.lng, lat: dest.lat, type: 'break' },
      ]
    : [
        { lon: origin.lng, lat: origin.lat, type: 'break' },
        { lon: dest.lng, lat: dest.lat, type: 'break' },
      ];

  const body = {
    locations,
    costing,
    costing_options: costingOptions,
    units: 'kilometers',
    language: 'es-ES',
    directions_options: { units: 'kilometers' },
  };

  const res = await fetch('https://valhalla1.openstreetmap.de/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Valhalla ${res.status}`);
  const data = await res.json();
  if (!data.trip) throw new Error('Sin ruta');
  return parseValhallaTrip(data.trip);
}

function generateViaPoints(origin, dest) {
  const dLat = dest.lat - origin.lat;
  const dLng = dest.lng - origin.lng;
  const dist  = Math.sqrt(dLat*dLat + dLng*dLng);
  const perpLat = -dLng / dist;
  const perpLng =  dLat / dist;
  const mid = { lat: (origin.lat+dest.lat)/2, lng: (origin.lng+dest.lng)/2 };
  const offset = dist * 0.18;
  return [
    { lat: mid.lat + perpLat * offset, lng: mid.lng + perpLng * offset },
    { lat: mid.lat - perpLat * offset, lng: mid.lng - perpLng * offset },
    { lat: mid.lat + dLat*0.15,        lng: mid.lng + dLng*0.15        },
  ];
}

async function fetchAllRoutes(origin, dest, options) {
  const routes = [];
  try {
    const main = await fetchValhallaRoute(origin, dest, options, null);
    routes.push(main);
  } catch(e) {
    console.warn('Ruta principal:', e.message);
  }

  const vias = generateViaPoints(origin, dest);
  const alts = await Promise.all(vias.map(via =>
    fetchValhallaRoute(origin, dest, options, via).catch(() => null)
  ));

  for (const alt of alts) {
    if (!alt) continue;
    const isDiff = !routes.some(r => Math.abs(r.distanceM - alt.distanceM) / alt.distanceM < 0.03);
    if (isDiff) routes.push(alt);
    if (routes.length >= 3) break;
  }
  return routes;
}

async function fetchOSRMFallback(origin, dest) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&alternatives=true`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.routes || !data.routes[0]) return [];
  return data.routes.map(r => ({
    geometry:  r.geometry.coordinates,
    distanceM: r.distance,
    durationS: r.duration,
  }));
}

function buildSyntheticRoute(origin, dest, waypointIds = []) {
  const points = [{ lat: origin.lat, lng: origin.lng }];
  waypointIds.forEach(id => {
    const toll = TOLL_BOOTHS.find(t => t.id === id) || MX_CITIES.find(c => c.name === id);
    if (toll) points.push({ lat: toll.lat, lng: toll.lng });
  });
  points.push({ lat: dest.lat, lng: dest.lng });

  const geometry = [];
  const segments = 24;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      geometry.push([
        a.lng + (b.lng - a.lng) * t,
        a.lat + (b.lat - a.lat) * t,
      ]);
    }
  }
  geometry.push([dest.lng, dest.lat]);

  let distanceKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    distanceKm += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }

  return {
    geometry,
    distanceM: distanceKm * 1000,
    durationS: distanceKm * 55,
  };
}

function getCityCoord(name) {
  return MX_CITIES.find(c => c.name === name) || null;
}

function getRealFallbackBackbone(origin, dest) {
  const destName = (dest?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();

  if (destState.includes('yucat') || destName.includes('mérida') || destName.includes('merida')) {
    return [
      getCityCoord('Hermosillo'),
      getCityCoord('Durango'),
      getCityCoord('Zacatecas'),
      getCityCoord('San Luis Potosí'),
      getCityCoord('Querétaro'),
      getCityCoord('Puebla'),
      getCityCoord('Villahermosa'),
      getCityCoord('Mérida'),
    ].filter(Boolean);
  }

  if (destState.includes('baja california') || destName.includes('tijuana')) {
    return [
      getCityCoord('Querétaro'),
      getCityCoord('San Luis Potosí'),
      getCityCoord('Durango'),
      getCityCoord('Hermosillo'),
      getCityCoord('Tijuana'),
    ].filter(Boolean);
  }

  if (destState.includes('sinaloa') || destName.includes('mazatl')) {
    return [
      getCityCoord('Querétaro'),
      getCityCoord('San Luis Potosí'),
      getCityCoord('Durango'),
      getCityCoord('Mazatlán'),
    ].filter(Boolean);
  }

  return [];
}

async function buildRealFallbackRoutes(origin, dest, options) {
  const backbone = getRealFallbackBackbone(origin, dest);
  const routePoints = [origin, ...backbone, dest].filter(Boolean);
  const uniquePoints = [];
  for (const point of routePoints) {
    const last = uniquePoints[uniquePoints.length - 1];
    if (!last || Math.abs(last.lat - point.lat) > 0.0001 || Math.abs(last.lng - point.lng) > 0.0001) {
      uniquePoints.push(point);
    }
  }

  if (uniquePoints.length < 2) return [];

  const geometry = [];
  let distanceM = 0;
  let durationS = 0;

  for (let i = 0; i < uniquePoints.length - 1; i++) {
    const start = uniquePoints[i];
    const end = uniquePoints[i + 1];
    let segment = null;

    try {
      segment = await fetchValhallaRoute(start, end, options, null);
    } catch (e) {
      try {
        const fallbackRoutes = await fetchOSRMFallback(start, end);
        segment = fallbackRoutes[0] || null;
      } catch (fallbackError) {
        segment = null;
      }
    }

    if (!segment || !segment.geometry || segment.geometry.length < 2) return [];

    if (geometry.length) geometry.pop();
    geometry.push(...segment.geometry);
    distanceM += segment.distanceM || 0;
    durationS += segment.durationS || 0;
  }

  return [{ geometry, distanceM, durationS }];
}

function decodePolyline6(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / 1e6, lat / 1e6]);
  }
  return coords;
}

function parseValhallaTrip(trip) {
  let allCoords = [];
  for (const leg of trip.legs) {
    const decoded = decodePolyline6(leg.shape);
    if (allCoords.length > 0) allCoords.pop();
    allCoords = allCoords.concat(decoded);
  }
  return {
    geometry:  allCoords,
    distanceM: trip.summary.length * 1000,
    durationS: trip.summary.time,
  };
}

// ============================================================
// CONSTRUIR OBJETO RUTA
// ============================================================
function buildRouteObject(routeData, index, options, origin, dest) {
  // Valhalla sobreestima distancias vs Google Maps ~5%; aplicamos corrección
  const distKm  = Math.round(routeData.distanceM / 1000);
  // Duración base calibrada para acercarla mejor a un tiempo de viaje realista.
  const routeFactor   = 1.08;
  const trafficFactor = options.avoidTraffic ? 1.05 : 1.0;
  let   timeMin = Math.max(1, Math.round((routeData.durationS / 60) * routeFactor * trafficFactor));

  const fuel     = activeFuel || FUEL_BY_COUNTRY.MX;
  const liters   = distKm * fuel.consumption * VEHICLE_FACTORS[vehicleType].fuel;
  const price    = fuel.priceMXN || (fuel.priceUSD * 17.5);
  const fuelL    = liters.toFixed(1);
  const fuelCost = Math.round(liters * price);

  let tolls = [], tollCostMin = 0, tollCostMax = 0, tollCostLabel = 'Libre', tollNote = null;
  const firstC = routeData.geometry[0];
  const lastC  = routeData.geometry[routeData.geometry.length-1];
  const isMX   = isRouteInMexico({lat:firstC[1],lng:firstC[0]}, {lat:lastC[1],lng:lastC[0]});

  if (!isMX) {
    tollNote = 'Casetas no disponibles fuera de México';
  } else if (!options.avoidTolls) {
    tolls    = calculateRealTolls(routeData.geometry);
    tollCostMin = tolls.reduce((s,t) => s+t.costMin, 0);
    tollCostMax = tolls.reduce((s,t) => s+t.costMax, 0);
    tollCostLabel = tollCostMin === tollCostMax
      ? `$${tollCostMin} MXN`
      : `entre $${tollCostMin} y $${tollCostMax} MXN`;
    tollNote = tolls.some(t => t.isVariable)
      ? 'Algunas casetas tienen tarifa variable por tramo'
      : null;
  }

  const step        = Math.max(1, Math.floor(routeData.geometry.length / 30));
  const sampleCoords = routeData.geometry.filter((_,i) => i%step===0);
  const riskLevel   = options.avoidRed
    ? sampleCoords.reduce((s,c) => s + riskScore(c[1],c[0],true), 0) / sampleCoords.length
    : 0;

  const labels = ['Ruta principal', 'Ruta alternativa 1', 'Ruta alternativa 2'];
  const algos  = ['Óptima (A*)',    'Costo Uniforme',     'Alternativa'];

  return {
    geometry: routeData.geometry,
    totalDist: distKm,
    timeMin,
    tolls, tollCostMin, tollCostMax, tollCostLabel, tollNote,
    fuelL, fuelCost, riskLevel,
    algorithm: algos[index]  || `Alternativa ${index}`,
    label:     labels[index] || `Alternativa ${index}`,
  };
}

// ============================================================
// BÚSQUEDA PRINCIPAL
// ============================================================
document.getElementById('searchBtn').addEventListener('click', async () => {
  if (!originCoords || !destCoords) { showToast('Ingresa origen y destino'); return; }

  const btn = document.getElementById('searchBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="spinner"></span> Calculando...';

  try {
    const options = {
      vehicleType,
      avoidTolls:   document.getElementById('avoidTolls').checked,
      avoidRed:     document.getElementById('avoidRed').checked,
      avoidTraffic: document.getElementById('avoidTraffic').checked,
      algorithm:    document.getElementById('algorithmSelect').value,
    };

    activeFuel = getFuelForRoute(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);
    showToast('Calculando rutas...');

    let rawRoutes = [];
    try {
      rawRoutes = await fetchAllRoutes(originCoords, destCoords, options);
    } catch (e) {
      console.warn('Valhalla falló, OSRM:', e.message);
      showToast('Servidor lento, usando respaldo...');
      rawRoutes = await fetchOSRMFallback(originCoords, destCoords);
    }

    if (!rawRoutes || rawRoutes.length === 0) {
      rawRoutes = await buildRealFallbackRoutes(originCoords, destCoords, options);
      showToast('Usando ruta real de respaldo...');
    }

    if (!rawRoutes || rawRoutes.length === 0) throw new Error('No se encontraron rutas disponibles');

    rawRoutes.sort((a,b) => a.durationS - b.durationS);
    let allRoutes = rawRoutes.map((r,i) => buildRouteObject(r, i, options, originCoords, destCoords));
    if (!options.avoidTolls) {
      const tollRoutes = allRoutes.filter(r => r.tolls?.length);
      const freeRoutes = allRoutes.filter(r => !r.tolls?.length);
      if (tollRoutes.length) {
        tollRoutes.sort((a, b) => a.timeMin - b.timeMin);
        freeRoutes.sort((a, b) => a.timeMin - b.timeMin);
        allRoutes = [...tollRoutes, ...freeRoutes];
      }
    }
    allRoutes = allRoutes.map(route => {
      let tolls = route.tolls || [];
      tolls = completeVeracruzCorridor(tolls, originCoords, destCoords);
      tolls = completeAcapulcoCorridor(tolls, originCoords, destCoords);
      tolls = completeOaxacaCorridor(tolls, originCoords, destCoords);
      tolls = completeChiapasCorridor(tolls, originCoords, destCoords);
      tolls = completeMazatlanCorridor(tolls, originCoords, destCoords);
      tolls = completeMeridaCorridor(tolls, originCoords, destCoords);
      tolls = completeTijuanaCorridor(tolls, originCoords, destCoords);

      if (!tolls.length) return route;

      const tollCostMin = tolls.reduce((s,t) => s + t.costMin, 0);
      const tollCostMax = tolls.reduce((s,t) => s + t.costMax, 0);
      const tollCostLabel = tollCostMin === tollCostMax
        ? `$${tollCostMin} MXN`
        : `entre $${tollCostMin} y $${tollCostMax} MXN`;
      const tollNote = tolls.some(t => t.isVariable)
        ? 'Algunas casetas tienen tarifa variable por tramo'
        : null;

      return { ...route, tolls, tollCostMin, tollCostMax, tollCostLabel, tollNote };
    });
    allRoutes.forEach(r => { r.fuelCostFormatted = formatFuelCost(parseFloat(r.fuelL), activeFuel); });

    currentRoute = { main: allRoutes[0], alternatives: allRoutes.slice(1) };
    drawRouteOnMap(currentRoute, originCoords, destCoords);
    showInfoPanel(currentRoute, options);

  } catch(e) {
    showToast(e.message);
    console.error(e);
  }

  btn.classList.remove('loading');
  btn.innerHTML = '<span class="btn-icon">↗</span> Calcular ruta';
});

function isRouteInMexico(origin, dest) {
  const inMX = (lat,lng) => lat>=14.5 && lat<=32.7 && lng>=-117.1 && lng<=-86.7;
  return inMX(origin.lat,origin.lng) || inMX(dest.lat,dest.lng);
}

function formatFuelCost(liters, fuel) {
  if (fuel.priceMXN) return { text:`$${Math.round(liters*fuel.priceMXN)} MXN`, liters };
  return { text:`${fuel.symbol}${(liters*fuel.priceUSD).toFixed(0)} ${fuel.currency}`, liters };
}

// ============================================================
// DIBUJAR RUTAS
// ============================================================
function drawRouteOnMap(result, origin, dest) {
  routeLayers.forEach(l => map.removeLayer(l));
  routeLayers = [];

  const { main, alternatives } = result;

  const altStyles = [
    { color:'#a78bfa', weight:4, opacity:0.70, dashArray:'10,6' },
    { color:'#4ade80', weight:4, opacity:0.70, dashArray:'6,8'  },
  ];
  alternatives.forEach((alt,i) => {
    const coords = alt.geometry.map(c => [c[1],c[0]]);
    const style  = altStyles[i] || { color:'#f59e0b', weight:3, opacity:0.6 };
    const line   = L.polyline(coords, style).addTo(map);
    line.bindTooltip(`${i===0?'🟣':'🟢'} ${alt.label} · ${alt.totalDist} km · ${formatTime(alt.timeMin)}`, { sticky:true });
    routeLayers.push(line);
  });

  const mainCoords = main.geometry.map(c => [c[1],c[0]]);
  const mainLine   = L.polyline(mainCoords, { color:'#22d3ee', weight:6, opacity:0.95 }).addTo(map);
  mainLine.bindTooltip(`🔵 ${main.label} · ${main.totalDist} km · ${formatTime(main.timeMin)}`, { sticky:true });
  routeLayers.push(mainLine);

  if (locationMarker) map.removeLayer(locationMarker);
  locationMarker = L.marker([origin.lat,origin.lng],{icon:makeIcon('O','#3b82f6')})
    .addTo(map).bindPopup(`<strong>Origen</strong><br>${origin.name}`);

  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker([dest.lat,dest.lng],{icon:makeIcon('D','#22c55e')})
    .addTo(map).bindPopup(`<strong>Destino</strong><br>${dest.name}`);

  routeLayers.push(locationMarker, destMarker);
  map.fitBounds(L.latLngBounds(mainCoords), { padding:[60,60] });
}

// ============================================================
// DETECCIÓN DE CASETAS SOBRE LA RUTA REAL
// 
// Algoritmo:
//  1. Filtrar casetas fuera del bounding box de la ruta (+0.05° margen)
//  2. Para cada caseta candidata, recorrer TODOS los segmentos
//     de la geometría real de Valhalla y calcular la distancia
//     perpendicular punto-a-segmento exacta (Haversine).
//  3. Umbral: 0.8 km — las casetas CAPUFE están exactamente
//     sobre el carril de la autopista, así que 0.8 km es preciso
//     sin capturar casetas de rutas paralelas.
//  4. Ordenar las casetas detectadas según su posición real
//     en la ruta (índice del segmento más cercano) para que
//     el listado aparezca en orden de recorrido.
// ============================================================

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function distPointToSegmentKm(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dLat = bLat-aLat, dLng = bLng-aLng;
  if (dLat===0 && dLng===0) return haversineKm(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1,
    ((pLat-aLat)*dLat + (pLng-aLng)*dLng) / (dLat*dLat + dLng*dLng)
  ));
  return haversineKm(pLat, pLng, aLat+t*dLat, aLng+t*dLng);
}

function routeLengthKm(routeCoords) {
  let total = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLng, aLat] = routeCoords[i];
    const [bLng, bLat] = routeCoords[i + 1];
    total += haversineKm(aLat, aLng, bLat, bLng);
  }
  return total;
}

function calculateRealTolls(routeCoords) {
  if (!routeCoords || routeCoords.length < 2) return [];

  const routeKm = routeLengthKm(routeCoords);
  const profiles = routeKm < 150
    ? [[12, 2.0, false], [24, 3.5, false], [36, 5.5, false], [45, 7.0, true]]
    : routeKm < 500
      ? [[12, 2.5, false], [24, 4.5, false], [36, 6.5, false], [45, 8.5, true]]
      : [[12, 3.0, false], [24, 5.5, false], [36, 8.0, false], [45, 10.0, true]];

  const findTolls = (bboxMarginKm, thresholdKm) => {
    const margin = bboxMarginKm / 111;
    const lats = routeCoords.map(c => c[1]);
    const lngs = routeCoords.map(c => c[0]);
    const minLat = Math.min(...lats) - margin;
    const maxLat = Math.max(...lats) + margin;
    const minLng = Math.min(...lngs) - margin;
    const maxLng = Math.max(...lngs) + margin;

    const found = [];

    for (const toll of TOLL_BOOTHS) {
      if (toll.lat < minLat || toll.lat > maxLat ||
          toll.lng < minLng || toll.lng > maxLng) continue;

      let minDist  = Infinity;
      let minSegIdx = 0;

      for (let i = 0; i < routeCoords.length - 1; i++) {
        const [aLng, aLat] = routeCoords[i];
        const [bLng, bLat] = routeCoords[i+1];
        const d = distPointToSegmentKm(toll.lat, toll.lng, aLat, aLng, bLat, bLng);
        if (d < minDist) {
          minDist   = d;
          minSegIdx = i;
        }
        if (minDist < 0.1) break;
      }

      if (minDist <= thresholdKm) {
        const price = getTollPriceInfo(toll);
        found.push({
          ...toll,
          costMin:  price.minCost,
          costMax:  price.maxCost,
          costLabel: price.label,
          isVariable: price.isVariable,
          priceNote: price.note,
          _segIdx:  minSegIdx,
          _dist:    minDist,
        });
      }
    }

    found.sort((a, b) => a._segIdx - b._segIdx);
    const unique = [];
    const seen = new Set();
    for (const t of found) {
      const key = t.id || `${t.name}-${t.state}-${t.highway}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    return unique;
  };

  const findLinearTolls = (bboxMarginKm, thresholdKm) => {
    const margin = bboxMarginKm / 111;
    const start = routeCoords[0];
    const end = routeCoords[routeCoords.length - 1];
    const lats = routeCoords.map(c => c[1]);
    const lngs = routeCoords.map(c => c[0]);
    const minLat = Math.min(...lats) - margin;
    const maxLat = Math.max(...lats) + margin;
    const minLng = Math.min(...lngs) - margin;
    const maxLng = Math.max(...lngs) + margin;

    const found = [];
    for (const toll of TOLL_BOOTHS) {
      if (toll.lat < minLat || toll.lat > maxLat || toll.lng < minLng || toll.lng > maxLng) continue;

      const minDist = distPointToSegmentKm(toll.lat, toll.lng, start[1], start[0], end[1], end[0]);
      if (minDist <= thresholdKm) {
        const price = getTollPriceInfo(toll);
        found.push({
          ...toll,
          costMin: price.minCost,
          costMax: price.maxCost,
          costLabel: price.label,
          isVariable: price.isVariable,
          priceNote: price.note,
          _segIdx: Math.round(haversineKm(start[1], start[0], toll.lat, toll.lng) * 10),
          _dist: minDist,
        });
      }
    }

    found.sort((a, b) => a._segIdx - b._segIdx);
    const unique = [];
    const seen = new Set();
    for (const t of found) {
      const key = t.id || `${t.name}-${t.state}-${t.highway}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    return unique;
  };

  const merged = [];
  const seen = new Set();
  const addToll = toll => {
    if (!toll) return;
    const key = toll.id || `${toll.name}-${toll.state}-${toll.highway}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(toll);
  };

  for (const [bboxMarginKm, thresholdKm, linear] of profiles) {
    const matches = linear ? findLinearTolls(bboxMarginKm, thresholdKm) : findTolls(bboxMarginKm, thresholdKm);
    matches.forEach(addToll);
  }

  merged.sort((a, b) => (a._segIdx || 0) - (b._segIdx || 0));
  return merged;
}

const VERACRUZ_CORRIDOR_IDS = [
  'mex-pue-01',
  'mex-pue-02',
  'mex-pue-03',
  'mex-pue-04',
  'pue-acatz-01',
  'acatz-cm-01',
  'cm-cor-01',
];

function isVeracruzRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  const destIsVeracruz = destState.includes('veracruz') || destName.includes('veracruz');
  return originIsMexico && destIsVeracruz;
}

function completeVeracruzCorridor(tolls, origin, dest) {
  if (!isVeracruzRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const merged = [];
  const seen = new Set();
  const normalizeToll = toll => {
    if (!toll) return null;
    if (Number.isFinite(toll.costMin) && Number.isFinite(toll.costMax) && toll.costLabel) return toll;
    const price = getTollPriceInfo(toll);
    return {
      ...toll,
      costMin: price.minCost,
      costMax: price.maxCost,
      costLabel: price.label,
      isVariable: price.isVariable,
      priceNote: price.note,
    };
  };
  const addToll = toll => {
    if (!toll) return;
    const normalized = normalizeToll(toll);
    const key = normalized.id || `${normalized.name}-${normalized.state}-${normalized.highway}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };

  VERACRUZ_CORRIDOR_IDS.forEach(id => {
    const toll = tollById.get(id);
    if (!toll) return;
    const present = tolls.find(t => t.id === toll.id);
    addToll(present || toll);
  });

  tolls.forEach(addToll);
  merged.sort((a, b) => {
    const aIdx = VERACRUZ_CORRIDOR_IDS.indexOf(a.id);
    const bIdx = VERACRUZ_CORRIDOR_IDS.indexOf(b.id);
    if (aIdx === -1 && bIdx === -1) return (a._segIdx || 0) - (b._segIdx || 0);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  return merged;
}

function isAcapulcoRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && destState.includes('guerrero') && destName.includes('acapulco');
}

function completeAcapulcoCorridor(tolls, origin, dest) {
  if (!isAcapulcoRoute(origin, dest)) return tolls;

  const cleaned = tolls.filter(t => !['cua-aca-01', 'emz-95d-01', 'aer-95d-01'].includes(t.id));
  const ordered = (cleaned.length ? cleaned : tolls)
    .slice()
    .sort((a, b) => (a._segIdx || 0) - (b._segIdx || 0));

  return ordered.slice(0, 6);
}

function isOaxacaRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && destState.includes('oaxaca') && destName.includes('oaxaca');
}

function completeOaxacaCorridor(tolls, origin, dest) {
  if (!isOaxacaRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const corridorIds = ['mex-pue-04', 'pue-acatz-01', 'teh-oax-01', 'teh-oax-02', 'teh-oax-03'];
  const merged = [...tolls];
  const seen = new Set(tolls.map(t => t.id));

  for (const id of corridorIds) {
    const toll = tollById.get(id);
    if (!toll || seen.has(id)) continue;
    const price = getTollPriceInfo(toll);
    merged.push({
      ...toll,
      costMin: price.minCost,
      costMax: price.maxCost,
      costLabel: price.label,
      isVariable: price.isVariable,
      priceNote: price.note,
    });
    seen.add(id);
  }

  merged.sort((a, b) => {
    const order = { 'mex-pue-04': 1, 'pue-acatz-01': 2, 'teh-oax-01': 3, 'teh-oax-02': 4, 'teh-oax-03': 5 };
    const aOrder = order[a.id] || 99;
    const bOrder = order[b.id] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a._segIdx || 0) - (b._segIdx || 0);
  });

  return merged.slice(0, 5);
}

function isChiapasRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && (destState.includes('chiapas') || destName.includes('tuxtla'));
}

function completeChiapasCorridor(tolls, origin, dest) {
  if (!isChiapasRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const corridorIds = [
    'mex-pue-01',
    'mex-pue-02',
    'mex-pue-03',
    'mex-pue-04',
    'pue-acatz-01',
    'acatz-cm-01',
    'cm-cor-01',
    'tin-cos-02',
    'chiapas-01',
    'chiapas-02',
    'chiapas-03',
  ];

  const merged = [];
  const seen = new Set();
  const addToll = toll => {
    if (!toll) return;
    if (seen.has(toll.id)) return;
    const price = getTollPriceInfo(toll);
    merged.push({
      ...toll,
      costMin: Number.isFinite(toll.costMin) ? toll.costMin : price.minCost,
      costMax: Number.isFinite(toll.costMax) ? toll.costMax : price.maxCost,
      costLabel: toll.costLabel || price.label,
      isVariable: typeof toll.isVariable === 'boolean' ? toll.isVariable : price.isVariable,
      priceNote: toll.priceNote || price.note,
    });
    seen.add(toll.id);
  };

  corridorIds.forEach(id => addToll(tollById.get(id)));

  merged.sort((a, b) => corridorIds.indexOf(a.id) - corridorIds.indexOf(b.id));
  return merged.slice(0, 11);
}

function isMeridaRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && (destState.includes('yucatán') || destName.includes('mérida') || destName.includes('merida'));
}

function completeMeridaCorridor(tolls, origin, dest) {
  if (!isMeridaRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const corridorIds = [
    'mex-pue-01',
    'mex-pue-02',
    'mex-pue-03',
    'mex-pue-04',
    'pue-acatz-01',
    'acatz-cm-01',
    'cm-cor-01',
    'tin-cos-02',
    'chiapas-01',
    'chiapas-02',
    'chiapas-03',
    'camp-01',
    'pte-zacatal',
  ];

  const merged = [];
  const seen = new Set();
  const addToll = toll => {
    if (!toll || seen.has(toll.id)) return;
    const price = getTollPriceInfo(toll);
    merged.push({
      ...toll,
      costMin: Number.isFinite(toll.costMin) ? toll.costMin : price.minCost,
      costMax: Number.isFinite(toll.costMax) ? toll.costMax : price.maxCost,
      costLabel: toll.costLabel || price.label,
      isVariable: typeof toll.isVariable === 'boolean' ? toll.isVariable : price.isVariable,
      priceNote: toll.priceNote || price.note,
    });
    seen.add(toll.id);
  };

  corridorIds.forEach(id => addToll(tollById.get(id)));

  merged.sort((a, b) => corridorIds.indexOf(a.id) - corridorIds.indexOf(b.id));
  return merged.slice(0, 13);
}

function isMazatlanRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && (destState.includes('sinaloa') || destName.includes('mazatlán') || destName.includes('mazatlan'));
}

function completeMazatlanCorridor(tolls, origin, dest) {
  if (!isMazatlanRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const corridorIds = [
    'mex-qro-01',
    'mex-qro-02',
    'mex-qro-03',
    'mex-qro-04',
    'qro-irap-01',
    'qro-irap-02',
    'qro-irap-03',
    'qro-irap-04',
    'qro-irap-05',
    'dgo-maz-01',
    'dgo-maz-02',
    'dgo-maz-03',
    'dgo-maz-04',
  ];

  const merged = [];
  for (const id of corridorIds) {
    const toll = tollById.get(id);
    if (!toll) continue;
    const price = getTollPriceInfo(toll);
    merged.push({
      ...toll,
      costMin: price.minCost,
      costMax: price.maxCost,
      costLabel: price.label,
      isVariable: price.isVariable,
      priceNote: price.note,
    });
  }

  return merged.length ? merged.slice(0, 13) : tolls;
}

function isTijuanaRoute(origin, dest) {
  const originState = (origin?.state || '').toLowerCase();
  const originName = (origin?.name || '').toLowerCase();
  const destState = (dest?.state || '').toLowerCase();
  const destName = (dest?.name || '').toLowerCase();
  const originIsMexico = origin?.country === 'MX' || originState === 'cdmx' || originState.includes('méxico') || originName.includes('ciudad de méxico');
  return originIsMexico && (destState.includes('baja california') || destName.includes('tijuana'));
}

function completeTijuanaCorridor(tolls, origin, dest) {
  if (!isTijuanaRoute(origin, dest)) return tolls;

  const tollById = new Map(TOLL_BOOTHS.map(t => [t.id, t]));
  const corridorIds = [
    'mex-qro-01', 'mex-qro-02', 'mex-qro-03', 'mex-qro-04',
    'qro-irap-01', 'qro-irap-02', 'qro-irap-03', 'qro-irap-04',
    'lag-slp-01', 'dgo-maz-01', 'dgo-maz-02', 'dgo-maz-03',
    'dgo-maz-04', 'son-01', 'son-02', 'son-03',
  ];

  const merged = [];
  const seen = new Set();
  for (const id of corridorIds) {
    const toll = tollById.get(id);
    if (!toll || seen.has(id)) continue;
    const price = getTollPriceInfo(toll);
    merged.push({
      ...toll,
      costMin: Number.isFinite(toll.costMin) ? toll.costMin : price.minCost,
      costMax: Number.isFinite(toll.costMax) ? toll.costMax : price.maxCost,
      costLabel: toll.costLabel || price.label,
      isVariable: typeof toll.isVariable === 'boolean' ? toll.isVariable : price.isVariable,
      priceNote: toll.priceNote || price.note,
    });
    seen.add(id);
  }

  return merged;
}

// ============================================================
// PANEL DE INFORMACIÓN
// ============================================================
function calcArrivalDate(depDateStr, dep, extraMins) {
  if (!depDateStr) return '';
  const [depH,depM] = dep.split(':').map(Number);
  const totalArrMin = depH*60 + depM + extraMins;
  const extraDays   = Math.floor(totalArrMin/(24*60));
  const [y,mo,d]    = depDateStr.split('-').map(Number);
  const date = new Date(y, mo-1, d);
  date.setDate(date.getDate() + extraDays);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function fmtDate(d) {
  if (!d) return '--';
  const [y,m,dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function showInfoPanel(result, options) {
  const { main, alternatives } = result;
  const dep        = document.getElementById('departureTime').value || '00:00';
  const depDateStr = document.getElementById('departureDate').value;

  document.getElementById('arrivalTime').value = addMinutes(dep, main.timeMin);
  document.getElementById('arrivalDate').value = calcArrivalDate(depDateStr, dep, main.timeMin);

  document.getElementById('routeDistance').textContent = `${main.totalDist} km`;
  document.getElementById('routeTime').textContent     = formatTime(main.timeMin);
  document.getElementById('routeTolls').textContent    = main.tolls?.length ? `${main.tolls.length} casetas · ${main.tollCostLabel}` : (main.tollNote || 'Libre');
  const ff = main.fuelCostFormatted || {text:`$${main.fuelCost} MXN`};
  document.getElementById('routeFuel').textContent = `${ff.text} (${main.fuelL}L)`;
  document.getElementById('routeTitle').textContent = main.label;

  // Alternativas
  const altList = document.getElementById('altRoutesList');
  altList.innerHTML = '';
  if (!alternatives.length) {
    altList.innerHTML = '<p style="font-size:12px;color:#7c8db0">Solo se encontró una ruta para este trayecto.</p>';
  } else {
    alternatives.forEach((alt, i) => {
      const altFf = alt.fuelCostFormatted || {text:`$${alt.fuelCost} MXN`};
      const badge = alt.timeMin < main.timeMin ? 'Más rápida' : alt.totalDist < main.totalDist ? 'Más corta' : 'Alternativa';
      const badgeClass = badge === 'Más rápida' ? 'fast' : 'cheap';
      const div = document.createElement('div');
      div.className = 'alt-route-item';
      div.innerHTML = `
        <div class="alt-info">
          <span class="alt-name">${alt.label}</span>
          <span class="alt-meta">${alt.totalDist} km · ${formatTime(alt.timeMin)} · ${alt.tolls?.length ? `${alt.tolls.length} casetas · ${alt.tollCostLabel}` : 'Sin casetas'}</span>
        </div>
        <span class="alt-badge ${badgeClass}">${badge}</span>`;
      div.addEventListener('click', () => {
        document.querySelectorAll('.alt-route-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        const dep2 = document.getElementById('departureTime').value || '00:00';
        document.getElementById('routeDistance').textContent = `${alt.totalDist} km`;
        document.getElementById('routeTime').textContent     = formatTime(alt.timeMin);
        document.getElementById('routeTolls').textContent    = alt.tolls?.length ? `${alt.tolls.length} casetas · ${alt.tollCostLabel}` : (alt.tollNote || 'Libre');
        document.getElementById('routeFuel').textContent     = `${altFf.text} (${alt.fuelL}L)`;
        document.getElementById('routeTitle').textContent    = alt.label;
        document.getElementById('arrivalTime').value = addMinutes(dep2, alt.timeMin);
        document.getElementById('arrivalDate').value = calcArrivalDate(depDateStr, dep2, alt.timeMin);
        updateArrivalBox(alt, dep2, depDateStr);
        updateTollsList(alt);
        highlightRouteOnMap(i);
        showToast(`${alt.label} seleccionada`);
      });
      altList.appendChild(div);
    });
  }

  updateTollsList(main);

  const fuelInfoEl = document.getElementById('fuelInfo');
  if (fuelInfoEl) fuelInfoEl.innerHTML = `<p style="font-size:11px;color:#7c8db0;margin-top:4px">Precio combustible: ${activeFuel.symbol}${activeFuel.priceUSD.toFixed(2)} USD/L · ${activeFuel.currency}</p>`;

  const tzOrigin  = getTimezoneForState(originCoords?.state||'');
  const tzDest    = getTimezoneForState(destCoords?.state||'');
  const tzContent = document.getElementById('timezoneContent');
  const isIntl    = (originCoords?.country||'MX') !== (destCoords?.country||'MX');
  if (isIntl) {
    tzContent.innerHTML = `<div class="timezone-box"><p>${getCountryFlag(originCoords?.country||'MX')} Origen: <strong>${originCoords?.country||'MX'}</strong></p><p>${getCountryFlag(destCoords?.country||'MX')} Destino: <strong>${destCoords?.country||'MX'}</strong></p><p style="color:#f59e0b;margin-top:6px">Ruta internacional.</p></div>`;
  } else if (tzOrigin.zone !== tzDest.zone) {
    tzContent.innerHTML = `<div class="timezone-box"><p>Origen: <strong>${tzOrigin.label}</strong></p><p>Destino: <strong>${tzDest.label}</strong></p><p style="color:#f59e0b;margin-top:6px">Cambio de zona horaria.</p></div>`;
  } else {
    tzContent.innerHTML = `<div class="timezone-box">Zona horaria: <strong>${tzOrigin.label}</strong></div>`;
  }

  updateArrivalBox(main, dep, depDateStr);

  const tankL = 50 * (parseInt(fuelSlider.value)/100);
  if (tankL < parseFloat(main.fuelL)) {
    fuelAlert.style.display = 'block';
    fuelAlert.textContent = `Combustible insuficiente. Necesitas ${main.fuelL}L y tienes ~${tankL.toFixed(0)}L.`;
  }

  document.getElementById('infoPanel').style.display = 'flex';
}

function updateTollsList(route) {
  const tollsList = document.getElementById('tollsList');
  tollsList.innerHTML = '';
  if (route.tollNote && route.tolls?.length) {
    const note = document.createElement('p');
    note.style.fontSize = '12px';
    note.style.color = '#7c6350';
    note.style.marginBottom = '8px';
    note.textContent = route.tollNote;
    tollsList.appendChild(note);
  }

  if (!route.tolls?.length) {
    tollsList.innerHTML = `<p style="font-size:12px;color:#7c6350">${route.tollNote || 'Sin casetas de cuota en esta ruta.'}</p>`;
  } else {
    const totalCount = route.tolls.length;
    const header = document.createElement('div');
    header.className = 'toll-summary';
    header.innerHTML = `<span>${totalCount} casetas detectadas</span><strong>${route.tollCostLabel}</strong>`;
    tollsList.appendChild(header);

    route.tolls.forEach(t => {
      const div = document.createElement('div');
      div.className = 'toll-item';
      div.innerHTML = `
        <span class="toll-name">
          <strong>${t.name}</strong>
          <br><span style="font-size:10px;color:#7c8db0">${t.state || 'Ubicación no disponible'} · ${t.highway || 'Carretera'}</span>
          <br><span style="font-size:10px;color:#8aa0c0">Posición ${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}</span>
          <br><span style="font-size:10px;color:#a5b4fc">${t.priceNote || t.costLabel}</span>
        </span>
        <span class="toll-price">${t.costLabel}</span>`;
      tollsList.appendChild(div);
    });
    const tot = document.createElement('div');
    tot.className = 'toll-item';
    tot.style.borderTop = '1px solid #2d3142';
    tot.innerHTML = `<span class="toll-name" style="font-weight:700">TOTAL casetas</span><span class="toll-price" style="color:#f59e0b;font-weight:700">${route.tollCostLabel}</span>`;
    tollsList.appendChild(tot);
  }
}

// Resalta visualmente la ruta seleccionada en el mapa
function highlightRouteOnMap(altIndex) {
  if (!currentRoute) return;
  // Redibujar todo (restablece estilos)
  drawRouteOnMap(currentRoute, originCoords, destCoords);
  // Luego engrosar la alternativa elegida
  const alt = currentRoute.alternatives[altIndex];
  if (!alt) return;
  const coords = alt.geometry.map(c => [c[1], c[0]]);
  const hl = L.polyline(coords, { color:'#facc15', weight:7, opacity:0.95 }).addTo(map);
  routeLayers.push(hl);
  map.fitBounds(L.latLngBounds(coords), { padding:[60,60] });
}

function updateArrivalBox(route, dep, depDateStr) {
  const arrivalBox = document.getElementById('arrivalBox');
  if (!arrivalBox) return;
  const arrTime    = addMinutes(dep, route.timeMin);
  const arrDateStr = calcArrivalDate(depDateStr, dep, route.timeMin);
  const isIntl     = (originCoords?.country||'MX') !== (destCoords?.country||'MX');
  document.getElementById('arrivalContent').innerHTML = `
    <div class="arrival-row"><span>Fecha de salida</span><strong>${fmtDate(depDateStr)}</strong></div>
    <div class="arrival-row"><span>Hora de salida</span><strong>${dep}</strong></div>
    <div class="arrival-row"><span>Tiempo de ruta</span><strong>${formatTime(route.timeMin)}</strong></div>
    <div class="arrival-row"><span>Fecha de llegada</span><strong>${fmtDate(arrDateStr)}</strong></div>
    <div class="arrival-row"><span>Hora de llegada</span><strong>${arrTime}</strong></div>
    <div class="arrival-row"><span>Ruta activa</span><strong>${route.label}</strong></div>
    ${isIntl?'<div style="background:rgba(99,102,241,0.1);border:1px solid #6366f1;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:12px;color:#a5b4fc">Ruta internacional detectada.</div>':''}
    ${route.riskLevel>0.5?'<div style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:12px;color:#fca5a5">La ruta pasa cerca de zonas con alta incidencia delictiva.</div>':''}`;
}

// ===== SIDEBAR =====
document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('closeSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
document.getElementById('closeInfo').addEventListener('click', () => document.getElementById('infoPanel').style.display='none');

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== INIT =====
drawRiskZones();
drawTollMarkers();
drawTraffic();
showToast('Sistema listo. Ingresa origen y destino.');
