// ============================================================
// ALGORITHMS.JS — A*, Manhattan, Costo Uniforme, Genético
// ============================================================

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function manhattanHeuristic(lat1, lng1, lat2, lng2) {
  const latDiff = Math.abs(lat2 - lat1) * 111;
  const lngDiff = Math.abs(lng2 - lng1) * 111 * Math.cos((lat1+lat2)/2 * Math.PI/180);
  return latDiff + lngDiff;
}

function generateWaypoints(origin, dest, count = 80) {
  const waypoints = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    waypoints.push({
      lat: origin.lat + ((dest.lat - origin.lat) * t),
      lng: origin.lng + ((dest.lng - origin.lng) * t)
    });
  }
  return waypoints;
}

function riskScore(lat, lng, avoidRed) {
  if (!avoidRed) return 0;
  let score = 0;
  for (const zone of RISK_ZONES) {
    const d = haversine(lat, lng, zone.lat, zone.lng);
    if (d < zone.radius) {
      const levelW = { extreme:4, high:3, medium:2, low:1 }[zone.level] || 1;
      score += levelW * (1 - d/zone.radius);
    }
  }
  return score;
}

// Casetas aproximadas solo para cálculo interno de algoritmos
// La detección real se hace en calculateRealTolls (app.js)
function tollsOnRoute(waypoints, vehicleType, avoidTolls) {
  if (avoidTolls) return [];
  const factor = VEHICLE_FACTORS[vehicleType].tolls;
  const found  = [];

  for (const toll of TOLL_BOOTHS) {
    let minDist = Infinity;
    for (const wp of waypoints) {
      const d = haversine(wp.lat, wp.lng, toll.lat, toll.lng);
      if (d < minDist) minDist = d;
      if (minDist < 1) break;
    }
    if (minDist <= 1) {
      found.push({ ...toll, cost: Math.round(toll.autoMXN * factor) });
    }
  }
  return found;
}

// Cálculo de combustible usando precio del país activo
function calcFuelCost(distKm, vehicleType) {
  // activeFuel es la variable global actualizada en app.js
  const fuel = (typeof activeFuel !== 'undefined') ? activeFuel : FUEL_BY_COUNTRY.MX;
  // Busca la línea: let activeFuel = FUEL_BY_COUNTRY.MX;
// Y asegúrate de que justo después esté esto:

async function obtenerPrecioCaseta(nombreCaseta, tipoVehiculo) {
    try {
        const tipoNormalizado = (tipoVehiculo === 'auto') ? 'autos' : tipoVehiculo;
        const response = await fetch(`/api/precio?caseta=${encodeURIComponent(nombreCaseta)}&tipo=${encodeURIComponent(tipoNormalizado)}`);
        
        if (!response.ok) return 0; 
        
        const data = await response.json();
        return data.costo;
    } catch (error) {
        console.error("Error al obtener precio:", error);
        return 0;
    }
}
  const liters = distKm * fuel.consumption * VEHICLE_FACTORS[vehicleType].fuel;
  const price  = fuel.priceMXN ? fuel.priceMXN : (fuel.priceUSD * 17.5); // aprox MXN
  return { fuelL: liters.toFixed(1), fuelCost: Math.round(liters * price) };
}

// ============================================================
// A* ALGORITHM
// ============================================================
function aStarRoute(origin, dest, options) {
  const { vehicleType, avoidTolls, avoidRed, avoidTraffic } = options;
  const wps    = generateWaypoints(origin, dest, 80);
  const scored = wps.map((wp, i) => {
    const g    = i === 0 ? 0 : haversine(wps[i-1].lat, wps[i-1].lng, wp.lat, wp.lng);
    const h    = haversine(wp.lat, wp.lng, dest.lat, dest.lng);
    const risk = riskScore(wp.lat, wp.lng, avoidRed) * 15;
    return { ...wp, g, h, f: g + h + risk };
  });

  const totalDist  = scored.reduce((s, wp, i) => i === 0 ? s : s + haversine(wps[i-1].lat, wps[i-1].lng, wp.lat, wp.lng), 0);
  const tolls      = tollsOnRoute(wps, vehicleType, avoidTolls);
  const tollCost   = tolls.reduce((s, t) => s + t.cost, 0);
  const speedKmh   = avoidTraffic ? 85 : 70;
  const timeMin    = Math.round((totalDist / speedKmh) * 60);
  const { fuelL, fuelCost } = calcFuelCost(totalDist, vehicleType);

  return { waypoints: wps, totalDist: Math.round(totalDist), timeMin, tolls, tollCost, fuelL, fuelCost, algorithm: 'A*', riskLevel: scored.reduce((s,w) => s + riskScore(w.lat, w.lng, avoidRed), 0) / scored.length };
}

// ============================================================
// UNIFORM COST (Dijkstra-like)
// ============================================================
function uniformCostRoute(origin, dest, options) {
  const { vehicleType, avoidTolls, avoidRed, avoidTraffic } = options;
  const wps      = generateWaypoints(origin, dest, 80);
  const totalDist = wps.reduce((s, wp, i) => i === 0 ? s : s + haversine(wps[i-1].lat, wps[i-1].lng, wp.lat, wp.lng), 0);
  const tolls     = tollsOnRoute(wps, vehicleType, avoidTolls);
  const tollCost  = tolls.reduce((s, t) => s + t.cost, 0);
  const speedKmh  = avoidTraffic ? 90 : 75;
  const timeMin   = Math.round((totalDist / speedKmh) * 60);
  const { fuelL, fuelCost } = calcFuelCost(totalDist, vehicleType);

  return { waypoints: wps, totalDist: Math.round(totalDist), timeMin, tolls, tollCost, fuelL, fuelCost, algorithm: 'Costo Uniforme', riskLevel: 0 };
}

// ============================================================
// MANHATTAN HEURISTIC ROUTE
// ============================================================
function manhattanRoute(origin, dest, options) {
  const { vehicleType, avoidTolls, avoidRed, avoidTraffic } = options;
  const midLat   = origin.lat;
  const midLng   = dest.lng;
  const wps      = [
    origin,
    { lat: origin.lat + (dest.lat-origin.lat)*0.25, lng: origin.lng },
    { lat: midLat, lng: midLng },
    { lat: dest.lat - (dest.lat-origin.lat)*0.25, lng: midLng },
    dest
  ];
  const totalDist = wps.reduce((s, wp, i) => i === 0 ? s : s + haversine(wps[i-1].lat, wps[i-1].lng, wp.lat, wp.lng), 0);
  const tolls     = tollsOnRoute(wps, vehicleType, avoidTolls);
  const tollCost  = tolls.reduce((s, t) => s + t.cost, 0);
  const speedKmh  = avoidTraffic ? 80 : 65;
  const timeMin   = Math.round((totalDist / speedKmh) * 60);
  const { fuelL, fuelCost } = calcFuelCost(totalDist, vehicleType);

  return { waypoints: wps, totalDist: Math.round(totalDist), timeMin, tolls, tollCost, fuelL, fuelCost, algorithm: 'Manhattan', riskLevel: 0 };
}

// ============================================================
// GENETIC / EVOLUTIONARY ALGORITHM
// ============================================================
function geneticRoute(origin, dest, options) {
  const { vehicleType, avoidTolls, avoidRed, avoidTraffic } = options;
  const POP = 12, GENS = 20, MUT = 0.2;

  function fitness(wps) {
    const dist    = wps.reduce((s,wp,i) => i===0 ? s : s + haversine(wps[i-1].lat,wps[i-1].lng,wp.lat,wp.lng), 0);
    const risk    = avoidRed ? wps.reduce((s,wp) => s + riskScore(wp.lat,wp.lng,true), 0)*12 : 0;
    const tollPen = avoidTolls ? tollsOnRoute(wps,vehicleType,false).reduce((s,t) => s+t.cost, 0)*0.1 : 0;
    return dist + risk + tollPen;
  }

  function makeIndividual() { return generateWaypoints(origin, dest, 60); }

  function mutate(ind) {
    return ind.map((wp, i) => {
      if (i === 0 || i === ind.length-1) return wp;
      if (Math.random() < MUT) return { lat: wp.lat + (Math.random()-0.5)*0.02, lng: wp.lng + (Math.random()-0.5)*0.02 };
      return wp;
    });
  }

  function crossover(a, b) {
    const cut = Math.floor(Math.random()*(a.length-2))+1;
    return [...a.slice(0,cut), ...b.slice(cut)];
  }

  let pop = Array.from({ length: POP }, makeIndividual);

  for (let g = 0; g < GENS; g++) {
    pop.sort((a,b) => fitness(a) - fitness(b));
    const elite    = pop.slice(0, 4);
    const children = [];
    while (children.length < POP - 4) {
      const p1 = elite[Math.floor(Math.random()*elite.length)];
      const p2 = elite[Math.floor(Math.random()*elite.length)];
      children.push(mutate(crossover(p1, p2)));
    }
    pop = [...elite, ...children];
  }

  const best      = pop[0];
  const totalDist = best.reduce((s,wp,i) => i===0 ? s : s + haversine(best[i-1].lat,best[i-1].lng,wp.lat,wp.lng), 0);
  const tolls     = tollsOnRoute(best, vehicleType, avoidTolls);
  const tollCost  = tolls.reduce((s,t) => s + t.cost, 0);
  const speedKmh  = avoidTraffic ? 88 : 72;
  const timeMin   = Math.round((totalDist/speedKmh)*60);
  const { fuelL, fuelCost } = calcFuelCost(totalDist, vehicleType);

  return { waypoints: best, totalDist: Math.round(totalDist), timeMin, tolls, tollCost, fuelL, fuelCost, algorithm: 'Genético Evolutivo', riskLevel: best.reduce((s,wp) => s + riskScore(wp.lat,wp.lng,avoidRed), 0)/best.length };
}

// ============================================================
// DISPATCHER
// ============================================================
function calculateRoute(origin, dest, options) {
  const alg = options.algorithm;
  let mainRoute;
  if (alg === 'astar')         mainRoute = aStarRoute(origin, dest, options);
  else if (alg === 'manhattan') mainRoute = manhattanRoute(origin, dest, options);
  else if (alg === 'uniform')   mainRoute = uniformCostRoute(origin, dest, options);
  else                           mainRoute = geneticRoute(origin, dest, options);

  const altFns = [aStarRoute, uniformCostRoute, manhattanRoute].filter((_,i) =>
    !(['astar','uniform','manhattan'][i] === alg)
  );
  const alternatives = altFns.slice(0,2).map(fn => fn(origin, dest, { ...options, avoidTolls: false }));

  return { main: mainRoute, alternatives };
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function addMinutes(timeStr, mins) {
  if (!timeStr) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + mins);
    return now.toTimeString().slice(0,5);
  }
  const [h, m] = timeStr.split(':').map(Number);
  const total  = h*60 + m + mins;
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
