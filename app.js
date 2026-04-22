(() => {
  'use strict';

  if (window.__CHRONOS_APP_RUNNING__) return;
  window.__CHRONOS_APP_RUNNING__ = true;

    mapboxgl.accessToken = window.__MAPBOX_ACCESS_TOKEN__ || '';

  const CONFIG = {
  API_BASE: `${window.location.origin}/api`,
  style: 'mapbox://styles/mapbox/navigation-night-v1',
  center: [-77.0369, 38.9072],
  zoom: 15.8,
  pitch: 78,
  bearing: 20,
  minZoom: 9,
  maxZoom: 19.4,

  colors: {
  bg: '#02050a',
  cyan: '#72f3ff',
  cyan2: '#6ea6c1',
  cyan3: '#9cc7d8',
  amber: '#b78a52',
  red: '#b86a62',
  lime: '#8fbf53',
  lime2: '#7dff7a',
  white: '#ecfeff',
  text: '#dff9ff',
  soft: '#7d97a3',
  chrome: '#050d14',
  chrome2: '#09131b',
  tractLine: '#0a1218',
  tractSelectedLine: '#dffcff',

  buildingNightLow: '#0a1118',
  buildingNightMid: '#111a23',
  buildingNightHigh: '#18232d',
  buildingRoof: '#0e151d',
  windowGlowWarm: '#d8b06a',
  windowGlowCool: '#8fb7c4',

  isochroneFill: 'rgba(42, 68, 92, 0.14)',
  isochroneLine: '#8fb7c4',
  isochroneOutline: '#c7e7f2',

  terminalRing: '#6f93a5',
  terminalRingHot: '#d8edf4',

  sphereBase: '#5f7f91',
  sphereHot: '#d8edf4',
  sphereDim: '#314754'
},

  fog: {
  range: [0.55, 10.5],
  color: '#02060b',
  'high-color': '#06141d',
  'space-color': '#010308',
  'star-intensity': 0.89
},

  search: {
    debounceMs: 180,
    minChars: 3
  },

  isochrone: {
    enabled: false,
    defaultMinutes: 15,
    minMinutes: 5,
    maxMinutes: 60,
    stepMinutes: 5,
    profile: 'mapbox/driving',
    polygons: true,
    denoise: 1,
    generalize: 36,
    fallbackKmPerMinute: 0.72
  },

  gravity: {
    distanceKmCap: 18,
    topTracts: 3,
    ringMiles: [3, 5, 10]
  },

  anim: {
    pulseSeconds: 7.8,
    haloSeconds: 4.6,
    buildingSeconds: 12.5,
    cameraDriftSeconds: 30
  },

  exactIndustryColumns: [
    {
      value: 'Management_business_science_arts industries',
      label: 'Management / Business / Science / Arts',
      aliases: [
        'Management_business_science_arts industries',
        'management_business_science_arts',
        'management business science arts industries',
        'management_business_science_arts_industries'
      ]
    },
    {
      value: 'Service Industry',
      label: 'Service',
      aliases: ['Service Industry', 'service', 'service_industry']
    },
    {
      value: 'Sales Office Industry',
      label: 'Sales / Office',
      aliases: ['Sales Office Industry', 'sales_office', 'sales office industry']
    },
    {
      value: 'natural resources and construction industries',
      label: 'Natural Resources / Construction',
      aliases: [
        'natural resources and construction industries',
        'natural_resources_construction',
        'natural resources construction'
      ]
    },
    {
      value: 'Production and Transport Industries',
      label: 'Production / Transport',
      aliases: [
        'Production and Transport Industries',
        'production_transport',
        'production and transport industries'
      ]
    },
    {
      value: 'Information Industry',
      label: 'Information',
      aliases: ['Information Industry', 'information', 'information_industry']
    },
    {
      value: 'Financial Services & Real Estate Industries',
      label: 'Financial Services / Real Estate',
      aliases: [
        'Financial Services & Real Estate Industries',
        'financial_real_estate',
        'financial services real estate industries'
      ]
    },
    {
      value: 'Professional Services Industry',
      label: 'Professional Services',
      aliases: [
        'Professional Services Industry',
        'professional_services',
        'professional services industry'
      ]
    },
    {
      value: 'Education and Health Industries',
      label: 'Education / Health',
      aliases: [
        'Education and Health Industries',
        'education_health',
        'education and health industries'
      ]
    },
    {
      value: 'arts and food industries',
      label: 'Arts / Food',
      aliases: ['arts and food industries', 'arts_food', 'arts food industries']
    },
    {
      value: 'public and admin industries',
      label: 'Public / Admin',
      aliases: ['public and admin industries', 'public_admin', 'public admin industries']
    }
  ]
};

  const STATE = {
    tracts: [],
    tractMap: {},
    tractCentroids: {},

    buildings: [],
    buildingById: {},

    rowsLoaded: 0,

    selectedIndustryColumn: CONFIG.exactIndustryColumns[0].value,
    selectedIndustryLabel: CONFIG.exactIndustryColumns[0].label,

    selectedMode: null, // 'building' | 'address' | 'tract'
    selectedGeoid: null,
    selectedTractGeoid: null,
    selectedBuildingId: null,

    selectedResolvedTarget: null,
    selectedSearchResult: null,
    selectedPointTarget: null,
    selectedBuildingGravity: null,

    searchTimer: null,
    searchResults: [],
    highlightedSearchIndex: -1,
    selectedSearchCandidate: null,

    isochroneMinutes: CONFIG.isochrone.defaultMinutes,
    isochroneBusy: false,
    isochroneReqSeq: 0,
    isochroneFeatureCollection: null,
    isochroneAnalysis: null,

    selfGuided: false,
    interactionLockUntil: 0,
    popup: null,

    animPhase: 0,
    animRaf: null,
    booted: false
  };

  let map = null;

  const SRC = {
    tracts: 'chronos-tracts',
    buildings: 'chronos-buildings',
    selectedBuilding: 'chronos-selected-building',
    selectedAddress: 'chronos-selected-address',
    gravityLines: 'chronos-gravity-lines',
    gravityRings: 'chronos-gravity-rings',
    isochrone: 'chronos-isochrone'
  };

  const LYR = {
    tractsFill: 'chronos-tracts-fill',
    tractsLine: 'chronos-tracts-line',
    tractsLabel: 'chronos-tracts-label',
    buildings: 'chronos-buildings',
    selectedBuilding: 'chronos-selected-building',
    selectedAddressHalo: 'chronos-selected-address-halo',
    selectedAddress: 'chronos-selected-address',
    gravityLines: 'chronos-gravity-lines',
    gravityRings: 'chronos-gravity-rings',
    gravityRingOutline: 'chronos-gravity-rings-outline',
    isochroneFill: 'chronos-isochrone-fill',
    isochroneLine: 'chronos-isochrone-line',
    mapbox3dBuildings: 'chronos-mapbox-3d-buildings'
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(v, fallback = '') {
    const s = String(v ?? '').trim();
    return s || fallback;
  }

  function titleCase(v, fallback = '') {
    return safeText(v, fallback);
  }

  function num(v, fallback = 0) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v ?? '')
      .replace(/,/g, '')
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/[–—]/g, '-')
      .trim();
    if (!s || s === '#NO MATCH') return fallback;
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function clamp01(v) {
    return clamp(num(v, 0), 0, 1);
  }

  function round(v, digits = 2) {
    if (!Number.isFinite(v)) return 0;
    const p = 10 ** digits;
    return Math.round(v * p) / p;
  }

  function cleanGeoid(v) {
    const digits = String(v ?? '').replace(/[^\d]/g, '');
    return digits ? digits.padStart(11, '0').slice(-11) : '';
  }

  function compareBuildingsForSelect(a, b) {
    const aa = safeText(a?.building_name || a?.Building_Address || a?.building_id).toLowerCase();
    const bb = safeText(b?.building_name || b?.Building_Address || b?.building_id).toLowerCase();
    return aa.localeCompare(bb);
  }

  function fmtPct100(v) {
    return `${Math.round(num(v, 0))}%`;
  }

  function fmtPct01(v) {
    return `${Math.round(clamp01(v) * 100)}%`;
  }

  function hasSource(id) {
    try { return !!map.getSource(id); } catch { return false; }
  }

  function hasLayer(id) {
    try { return !!map.getLayer(id); } catch { return false; }
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    const el = byId(id);
    if (el) el.innerHTML = value;
  }

  function setBarWidth(id, widthPct) {
    const el = byId(id);
    if (el) el.style.width = `${clamp(num(widthPct, 0), 0, 100)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function distanceKm(lng1, lat1, lng2, lat2) {
    if (
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng2) ||
      !Number.isFinite(lat2)
    ) return Infinity;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function milesToKm(miles) {
    return miles * 1.609344;
  }

  function buildBezierArc(start, end, strength01 = 0.5, steps = 32) {
    const [sx, sy] = start;
    const [ex, ey] = end;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const nx = -dy / len;
    const ny = dx / len;
    const lift = clamp(len * (0.04 + 0.20 * strength01), 0.015, 0.75);
    const cx = mx + nx * lift;
    const cy = my + ny * lift;

    const coords = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const omt = 1 - t;
      coords.push([
        omt * omt * sx + 2 * omt * t * cx + t * t * ex,
        omt * omt * sy + 2 * omt * t * cy + t * t * ey
      ]);
    }
    return coords;
  }

  function circlePolygon(lng, lat, radiusKm, steps = 96) {
    const coords = [];
    const latRad = lat * Math.PI / 180;
    const kmPerDegLat = 110.574;
    const kmPerDegLng = 111.320 * Math.cos(latRad || 0);

    for (let i = 0; i <= steps; i += 1) {
      const theta = (i / steps) * Math.PI * 2;
      const dx = Math.cos(theta) * radiusKm;
      const dy = Math.sin(theta) * radiusKm;
      coords.push([
        lng + dx / Math.max(kmPerDegLng, 0.00001),
        lat + dy / kmPerDegLat
      ]);
    }

    return {
      type: 'Polygon',
      coordinates: [coords]
    };
  }

  function pointInRing(point, ring) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect =
        ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  function pointInPolygonGeometry(point, geometry) {
    if (!geometry) return false;

    if (geometry.type === 'Polygon') {
      const outer = geometry.coordinates?.[0];
      if (!outer?.length) return false;
      if (!pointInRing(point, outer)) return false;
      for (let i = 1; i < geometry.coordinates.length; i += 1) {
        if (pointInRing(point, geometry.coordinates[i])) return false;
      }
      return true;
    }

    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some(poly =>
        pointInPolygonGeometry(point, { type: 'Polygon', coordinates: poly })
      );
    }

    return false;
  }

  async function fetchJSON(path) {
    const res = await fetch(`${CONFIG.API_BASE}${path}`, { cache: 'no-store' });
    const raw = await res.text();

    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Non-JSON response from ${path}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status} for ${path}`);
    }

    return data;
  }

  async function searchAddress(q) {
    return fetchJSON(`/search/address?q=${encodeURIComponent(q)}`);
  }

  async function fuseAddress(input) {
    if (!input) throw new Error('Missing address fusion input');

    if (typeof input === 'object') {
      const params = new URLSearchParams();
      const lat = num(input.lat, NaN);
      const lon = num(input.lon, NaN);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('CRITICAL: Missing lat/lon for locked address selection');
      }

      const matched =
        safeText(input.matched_address) ||
        safeText(input.address_label) ||
        safeText(input.place_name);

      if (!matched) {
        throw new Error('CRITICAL: Missing matched address');
      }

      params.set('q', matched);
      params.set('matched_address', matched);
      params.set('lat', String(lat));
      params.set('lon', String(lon));
      params.set('source', safeText(input.source || 'sheet'));

      return fetchJSON(`/fusion/address?${params.toString()}`);
    }

    if (typeof input === 'string') {
      return fetchJSON(`/fusion/address?q=${encodeURIComponent(input)}`);
    }

    throw new Error('Invalid fusion input');
  }

  function dispatchTractBarPayload(payload) {
    try {
      window.dispatchEvent(
        new CustomEvent('chronos:tract-bar-update', {
          detail: payload || null
        })
      );
    } catch (err) {
      console.warn('tract bar dispatch failed', err);
    }
  }

  function dispatchAnnihilationPayload(payload) {
    try {
      window.dispatchEvent(
        new CustomEvent('chronos:annihilation-target', {
          detail: payload || null
        })
      );
    } catch (err) {
      console.warn('annihilation dispatch failed', err);
    }
  }

  function getIndustryColumnConfig(columnValue = STATE.selectedIndustryColumn) {
    return (
      CONFIG.exactIndustryColumns.find(x => x.value === columnValue) ||
      CONFIG.exactIndustryColumns[0]
    );
  }

  function getIndustryLens01FromRow(row, columnValue = STATE.selectedIndustryColumn) {
    const config = getIndustryColumnConfig(columnValue);
    const keys = [
      config.value,
      config.label,
      ...(config.aliases || [])
    ];

    for (const key of keys) {
      if (!key) continue;
      const raw = row?.[key];
      if (raw == null || raw === '' || String(raw).trim() === '#NO MATCH') continue;
      const n = num(raw, NaN);
      if (Number.isFinite(n)) return clamp01(n);
    }

    return 0;
  }

  function getTopIndustryStack(row) {
    const ranked = CONFIG.exactIndustryColumns
      .map(col => ({
        label: col.label,
        value: col.value,
        score01: getIndustryLens01FromRow(row, col.value)
      }))
      .sort((a, b) => b.score01 - a.score01);

    return ranked.slice(0, 3);
  }

  function toneFrom100(score100) {
    const n = num(score100, 0);
    if (n >= 75) return { name: 'RED FIELD', color: CONFIG.colors.red };
    if (n >= 45) return { name: 'AMBER FIELD', color: CONFIG.colors.amber };
    return { name: 'CYAN FIELD', color: CONFIG.colors.cyan };
  }

  function pressureToneHex(score01) {
    const s = clamp01(score01);
    if (s >= 0.68) return CONFIG.colors.red;
    if (s >= 0.42) return CONFIG.colors.amber;
    return CONFIG.colors.cyan;
  }

  function pressureToneName(score01) {
    const s = clamp01(score01);
    if (s >= 0.68) return 'RED';
    if (s >= 0.42) return 'AMBER';
    return 'CYAN';
  }

  function smoothWave01(x) {
    const t = 0.5 + 0.5 * Math.sin(x);
    return t * t * (3 - 2 * t);
  }

  function computeFieldPressure(tract) {
    if (!tract) return 0;

    const labor = clamp01(num(tract.labor_pressure, 0) / 100);
    const talent = clamp01(num(tract.talent_density_tract ?? tract.talent_gravity, 0) / 100);
    const market = clamp01(num(tract.market_physics, 0) / 100);
    const macro = clamp01(num(tract.macro_demand, 0) / 100);
    const opp = clamp01(num(tract.opportunity_score, 0) / 100);
    const industry = clamp01(num(tract.industryLens01, 0));

    return clamp01(
      labor * 0.32 +
      talent * 0.20 +
      market * 0.16 +
      macro * 0.12 +
      opp * 0.10 +
      industry * 0.10
    );
  }

  function computeAssetPosture(building) {
    if (!building) return 0;

    const posture = clamp01(num(building.building_posture_score, 0) / 100);
    const clear = clamp01(num(building.clear_pressure_index ?? building.clear_pressure, 0) / 20);
    const rentDelta = clamp01(Math.abs(num(building.rent_delta, 0)) / 15);
    const windowCompression = clamp01((100 - Math.min(num(building.capture_window_days, 45), 100)) / 100);
    const spatial = clamp01(num(building.building_spatial_gravity_0to1, 0));
    const industry = clamp01(num(building.industryLens01, 0));

    return clamp01(
      posture * 0.31 +
      clear * 0.22 +
      rentDelta * 0.12 +
      windowCompression * 0.13 +
      spatial * 0.12 +
      industry * 0.10
    );
  }

  function computeExecutionUrgency(tract, building) {
    if (!tract || !building) {
      return { score01: 0, score100: 0, days: null };
    }

    const field01 = computeFieldPressure(tract);
    const posture01 = computeAssetPosture(building);
    const access01 = clamp01(num(STATE.isochroneAnalysis?.fusedScore, 0));
    const gravity01 = clamp01(num(STATE.selectedBuildingGravity?.totalPull, 0));

    const score01 = clamp01(
      field01 * 0.34 +
      posture01 * 0.26 +
      access01 * 0.22 +
      gravity01 * 0.18
    );

    const baseDays = Math.max(10, Math.round(num(building.capture_window_days, 45)));
    const days = Math.max(3, Math.round(baseDays * (1 - score01 * 0.72)));

    return {
      score01,
      score100: Math.round(score01 * 100),
      days
    };
  }

  function computeKPIStack(tract, building) {
    const field01 = computeFieldPressure(tract);
    const posture01 = computeAssetPosture(building);
    const exec = computeExecutionUrgency(tract, building);

    return {
      field01,
      field100: Math.round(field01 * 100),
      posture01,
      posture100: Math.round(posture01 * 100),
      exec01: exec.score01,
      exec100: exec.score100,
      execDays: exec.days
    };
  }

  function normalizeTract(raw) {
    const geoid = cleanGeoid(raw.geoid || raw.tract_geoid || raw.GEOID);
    if (!geoid) return null;

    const tract = {
      ...raw,
      geoid,
      tract_geoid: geoid,
      GEOID: geoid,
      lat: num(raw.lat, NaN),
      lon: num(raw.lon, NaN),
      tract_name: titleCase(raw.tract_name || `TRACT ${geoid}`),
      dominant_force: safeText(raw.dominant_force),
      signal_regime: safeText(raw.signal_regime),
      tract_brief: safeText(raw.tract_brief || raw.brief)
    };

    tract.industryLens01 = getIndustryLens01FromRow(tract, STATE.selectedIndustryColumn);
    tract.active_pressure_01 = computeFieldPressure(tract);
    tract.active_pressure_100 = Math.round(tract.active_pressure_01 * 100);
    tract.topIndustryStack = getTopIndustryStack(tract);

    if (!tract.top_industry1_label && tract.topIndustryStack[0]) tract.top_industry1_label = tract.topIndustryStack[0].label;
    if (!tract.top_industry2_label && tract.topIndustryStack[1]) tract.top_industry2_label = tract.topIndustryStack[1].label;
    if (!tract.top_industry3_label && tract.topIndustryStack[2]) tract.top_industry3_label = tract.topIndustryStack[2].label;

    return tract;
  }

  function normalizeBuilding(raw) {
    const lat = num(raw.lat ?? raw.latitude, NaN);
    const lon = num(raw.lon ?? raw.longitude ?? raw.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const building = {
      ...raw,
      building_id: safeText(raw.building_id || raw.Building_Address || raw.address_label || `${lat}_${lon}`),
      building_name: titleCase(raw.building_name || raw.Building_Address || raw.address_label || 'Asset'),
      Building_Address: titleCase(raw.Building_Address || raw.building_name || raw.address_label || 'Asset'),
      lat,
      lon,
      geoid: cleanGeoid(raw.geoid || raw.tract_geoid || raw.tractid),
      tract_geoid: cleanGeoid(raw.tract_geoid || raw.geoid || raw.tractid),
      fusedGeoid: cleanGeoid(raw.tract_geoid || raw.geoid || raw.tractid),
      clear_pressure: num(raw.clear_pressure_index ?? raw.clear_pressure, 0),
      clear_pressure_index: num(raw.clear_pressure_index ?? raw.clear_pressure, 0),
      take_rate_pct: num(raw.take_rate_pct, 0),
      capture_window_days: num(raw.capture_window_days, 45),
      building_posture_score: num(raw.building_posture_score ?? raw.posture_score, 0),
      posture_score: num(raw.building_posture_score ?? raw.posture_score, 0),
      direct_rent: num(raw.direct_rent, 0),
      clear_effective_rent: num(raw.clear_effective_rent, 0),
      rent_delta: num(raw.rent_delta, 0),
      ets_vs_clear: num(raw.ets_vs_clear, 0),
      execution_bias: safeText(raw.execution_bias),
      interpretation: safeText(raw.interpretation),
      building_spatial_gravity_0to1: clamp01(num(raw.building_spatial_gravity_0to1, 0))
    };

    building.industryLens01 = getIndustryLens01FromRow(building, STATE.selectedIndustryColumn);
    building.topIndustryStack = getTopIndustryStack(building);
    return building;
  }

  function rehydrateIndustryState() {
    STATE.tracts = STATE.tracts.map(tract => {
      tract.industryLens01 = getIndustryLens01FromRow(tract, STATE.selectedIndustryColumn);
      tract.active_pressure_01 = computeFieldPressure(tract);
      tract.active_pressure_100 = Math.round(tract.active_pressure_01 * 100);
      tract.topIndustryStack = getTopIndustryStack(tract);
      if (tract.topIndustryStack[0]) tract.top_industry1_label = tract.topIndustryStack[0].label;
      if (tract.topIndustryStack[1]) tract.top_industry2_label = tract.topIndustryStack[1].label;
      if (tract.topIndustryStack[2]) tract.top_industry3_label = tract.topIndustryStack[2].label;
      STATE.tractMap[tract.geoid] = tract;
      return tract;
    });

    STATE.buildings = STATE.buildings.map(building => {
      building.industryLens01 = getIndustryLens01FromRow(building, STATE.selectedIndustryColumn);
      building.topIndustryStack = getTopIndustryStack(building);
      STATE.buildingById[building.building_id] = building;
      return building;
    });
  }

  async function loadAllData() {
    STATE.tracts = [];
    STATE.tractMap = {};
    STATE.tractCentroids = {};
    STATE.buildings = [];
    STATE.buildingById = {};

    const [tractRows, buildingRows] = await Promise.all([
      fetchJSON('/tracts'),
      fetchJSON('/buildings')
    ]);

    STATE.tracts = tractRows
      .map(normalizeTract)
      .filter(Boolean)
      .filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lon));

    for (const tract of STATE.tracts) {
      STATE.tractMap[tract.geoid] = tract;
      STATE.tractCentroids[tract.geoid] = [tract.lon, tract.lat];
    }

    STATE.buildings = buildingRows
      .map(normalizeBuilding)
      .filter(Boolean)
      .filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lon));

    for (const building of STATE.buildings) {
      STATE.buildingById[building.building_id] = building;
    }

    STATE.rowsLoaded = STATE.buildings.length;
    rehydrateIndustryState();
  }

  function getTractRaw(geoid) {
    const g = cleanGeoid(geoid);
    return g ? STATE.tractMap[g] || null : null;
  }

  function resolveNearestTractGeoid(lon, lat) {
    let bestGeoid = '';
    let bestKm = Infinity;

    for (const tract of STATE.tracts) {
      const km = distanceKm(lon, lat, tract.lon, tract.lat);
      if (km < bestKm) {
        bestKm = km;
        bestGeoid = tract.geoid;
      }
    }

    return bestGeoid;
  }

  function resolveBuildingGeoid(building) {
    return cleanGeoid(building?.geoid || building?.tract_geoid || building?.fusedGeoid);
  }

  function currentSelectionBuilding() {
    return STATE.selectedBuildingId ? STATE.buildingById[STATE.selectedBuildingId] || null : null;
  }

  function currentSelectionTract() {
    return STATE.selectedGeoid ? getTractRaw(STATE.selectedGeoid) : null;
  }

  function getSelectedPoint() {
    if (STATE.selectedMode === 'building') {
      const building = currentSelectionBuilding();
      if (!building) return null;
      return {
        mode: 'building',
        lat: building.lat,
        lon: building.lon,
        label: building.building_name,
        geoid: resolveBuildingGeoid(building),
        building
      };
    }

    if (STATE.selectedMode === 'address' && STATE.selectedPointTarget) {
      return {
        mode: 'address',
        lat: STATE.selectedPointTarget.lat,
        lon: STATE.selectedPointTarget.lon,
        label: STATE.selectedPointTarget.label,
        geoid: STATE.selectedPointTarget.geoid,
        building: null
      };
    }

    if (STATE.selectedMode === 'tract') {
      const tract = currentSelectionTract();
      if (!tract) return null;
      return {
        mode: 'tract',
        lat: tract.lat,
        lon: tract.lon,
        label: tract.tract_name,
        geoid: tract.geoid,
        building: null
      };
    }

    return null;
  }

  function getDominantIndustryLabel(row) {
    const top = getTopIndustryStack(row);
    return top[0]?.label || getIndustryColumnConfig().label;
  }

  function computeRelativeTracts(tract) {
    if (!tract) return [];

    return STATE.tracts
      .filter(t => t.geoid !== tract.geoid)
      .map(t => {
        const distance = distanceKm(tract.lon, tract.lat, t.lon, t.lat);
        const oppGap = Math.abs(num(t.opportunity_score, 0) - num(tract.opportunity_score, 0)) / 100;
        const talentGap = Math.abs(num(t.talent_gravity, 0) - num(tract.talent_gravity, 0)) / 100;
        const laborGap = Math.abs(num(t.labor_pressure, 0) - num(tract.labor_pressure, 0)) / 100;
        const industryGap = Math.abs(num(t.industryLens01, 0) - num(tract.industryLens01, 0));

        const pull = clamp01(
          1 -
          (
            oppGap * 0.28 +
            talentGap * 0.22 +
            laborGap * 0.20 +
            industryGap * 0.16 +
            clamp01(distance / CONFIG.gravity.distanceKmCap) * 0.14
          )
        );

        return {
          geoid: t.geoid,
          label: t.tract_name,
          pull,
          rank: 0,
          lon: t.lon,
          lat: t.lat,
          topIndustry: getDominantIndustryLabel(t)
        };
      })
      .sort((a, b) => b.pull - a.pull)
      .slice(0, CONFIG.gravity.topTracts)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  function buildDispatchPayload(tract, building = null, overrideSelectedLocation = null, relativeTracts = null) {
    const selectedLocation =
      overrideSelectedLocation ||
      (building
        ? {
            matched_address: building.building_name,
            address_label: building.building_name,
            lat: building.lat,
            lon: building.lon,
            geoid: tract?.geoid || resolveBuildingGeoid(building)
          }
        : STATE.selectedPointTarget
          ? {
              matched_address: STATE.selectedPointTarget.label,
              address_label: STATE.selectedPointTarget.label,
              lat: STATE.selectedPointTarget.lat,
              lon: STATE.selectedPointTarget.lon,
              geoid: STATE.selectedPointTarget.geoid
            }
          : null);

     return {
    mode: building ? 'building' : STATE.selectedMode || 'tract',

    address: selectedLocation?.matched_address || '',
    selected_location: selectedLocation,

    selection: selectedLocation ? {
      mode: building ? 'building' : STATE.selectedMode || 'tract',
      address: selectedLocation.matched_address || selectedLocation.address_label || '',
      lat: selectedLocation.lat,
      lon: selectedLocation.lon,
      geoid: selectedLocation.geoid || tract?.geoid || null
    } : null,

    tract: tract || null,
    tract_raw: tract || null,
    building: building || null,
    relative_tracts: relativeTracts || computeRelativeTracts(tract),

    tract_intelligence: tract ? {
      geoid: tract.geoid,
      tract_name: tract.tract_name || `TRACT ${tract.geoid}`,

      signal_regime: tract.signal_regime || '',
      dominant_force: tract.dominant_force || '',
      tract_brief: tract.tract_brief || '',

      labor_physics_pressure: tract.labor_pressure ?? null,
      talent_gravity: tract.talent_gravity ?? null,
      market_physics: tract.market_physics ?? null,
      macro_demand_pulse: tract.macro_demand ?? null,

      knowledge_work_score:
        tract.knowledge_work_score ??
        tract.knowledge_work_intensity ??
        null,

      decision_class_score:
        tract.decision_class_score ??
        tract.decision_class_share ??
        null,

      transit_access_score: tract.transit_access_score ?? null,
      commute_access_score:
        tract.commute_access_score ??
        tract.commute_time_advantage_score ??
        null,
      remote_flex_score: tract.remote_flex_score ?? null,

      top_industries: (tract.topIndustryStack || []).map((item, index) => ({
        rank: index + 1,
        label: item.label,
        score01: item.score01,
        score100: Math.round((item.score01 || 0) * 100)
      })),

      temporal_pressure:
        tract.DC_Temporal_Pressure ??
        tract.temporal_pressure ??
        null
    } : null,

    building_consequence: building ? {
      building_id: building.building_id || null,
      building_name: building.building_name || building.Building_Address || '',

      clear_pressure:
        building.clear_pressure_index ??
        building.clear_pressure ??
        null,

      posture_score:
        building.building_posture_score ??
        building.posture_score ??
        null,

      rent_delta: building.rent_delta ?? null,
      ets_vs_clear: building.ets_vs_clear ?? null,
      direct_rent: building.direct_rent ?? null,
      clear_effective_rent: building.clear_effective_rent ?? null,
      take_rate_pct: building.take_rate_pct ?? null,
      capture_window_days: building.capture_window_days ?? null,

      building_spatial_gravity_0to1:
        building.building_spatial_gravity_0to1 ?? null,
negotiation_posture:
  building?.Negotiation_Posture ??
  building?.negotiation_posture ??
  '',

      execution: computeExecutionUrgency(tract, building)
    } : null,

    command: tract
      ? {
          geoid: tract.geoid,
          signal_regime: tract.signal_regime,
          dominant_force: tract.dominant_force,
          tract_brief: tract.tract_brief,
          field_pressure: tract.labor_pressure,
          talent_gravity: tract.talent_gravity,
          opportunity_score: tract.opportunity_score,
          friction_score: tract.friction_score,
          market_physics: tract.market_physics,
          macro_demand: tract.macro_demand,
          top_industry1_label: tract.topIndustryStack?.[0]?.label || tract.top_industry1_label,
          top_industry2_label: tract.topIndustryStack?.[1]?.label || tract.top_industry2_label,
          top_industry3_label: tract.topIndustryStack?.[2]?.label || tract.top_industry3_label,
          transit_access_score: tract.transit_access_score,
          commute_time_advantage_score: tract.commute_time_advantage_score,
          remote_flex_score: tract.remote_flex_score,
          commute_access_score: tract.commute_access_score,
          high_earner_score: tract.high_earner_score,
          work_from_home_share: tract.work_from_home_share,
          earnings_power_score: tract.earnings_power_score
        }
      : null
    };
}

function pushSelectionPayload(tract, building = null, overrideSelectedLocation = null, relativeTracts = null) {
    const payload = buildDispatchPayload(tract, building, overrideSelectedLocation, relativeTracts);
    dispatchTractBarPayload(payload);
    dispatchAnnihilationPayload(payload);
  }

  function findFooterCardByLabel(labelText) {
    const cards = document.querySelectorAll('#footerRail [class*="footer"], #footerRail .heroMetric, #footerRail .metricCard');
    for (const card of cards) {
      const txt = card.textContent || '';
      if (txt.toLowerCase().includes(labelText.toLowerCase())) return card;
    }
    return null;
  }

  function setFooterValueByLabel(labelText, value, subText = null) {
    const card = findFooterCardByLabel(labelText);
    if (!card) return;

    const valueEl =
      card.querySelector('.footerVal') ||
      card.querySelector('.metricValue') ||
      card.querySelector('.heroMetricValue') ||
      card.querySelector('.value');

    if (valueEl) valueEl.textContent = value;

    if (subText != null) {
      const subEl =
        card.querySelector('.footerSub') ||
        card.querySelector('.metricSub') ||
        card.querySelector('.heroMetricSub') ||
        card.querySelector('.sub');
      if (subEl) subEl.textContent = subText;
    }
  }

  function updateSelectedPropertyHero(building, tract, kpi) {
    const title =
      byId('selectedPropertyTitle') ||
      byId('heroPropertyTitle') ||
      document.querySelector('#footerRail .selectedPropertyTitle');

    const line2 =
      byId('selectedPropertyMeta') ||
      byId('heroPropertyMeta') ||
      document.querySelector('#footerRail .selectedPropertyMeta');

    const line3 =
      byId('selectedPropertySub') ||
      byId('heroPropertySub') ||
      document.querySelector('#footerRail .selectedPropertySub');

    if (title) {
      title.textContent =
        building?.building_name ||
        STATE.selectedPointTarget?.label ||
        tract?.tract_name ||
        'Awaiting selection';
    }

    if (line2) {
      line2.textContent = building
        ? `${STATE.selectedIndustryLabel} • ${tract?.geoid || '—'}`
        : tract
          ? `${STATE.selectedIndustryLabel} • ${tract.geoid}`
          : 'Awaiting property or tract selection';
    }

    if (line3) {
      line3.textContent = building
        ? `${pressureToneName(kpi.field01)} ${kpi.field100} | POSTURE ${kpi.posture100} | EXEC ${kpi.execDays ?? '—'}D`
        : tract
          ? `${tract.dominant_force || tract.signal_regime || 'Field locked'}`
          : 'No building selected';
    }
  }

  function updateHeroBar(building = null, tract = null) {
    const kpi = computeKPIStack(tract, building);
    const access = fmtPct01(STATE.isochroneAnalysis?.fusedScore || 0);
    const captured = STATE.isochroneAnalysis?.tractCount ? `${STATE.isochroneAnalysis.tractCount} tracts` : '0 tracts';

    setFooterValueByLabel('Field Pressure', String(kpi.field100), `${pressureToneName(kpi.field01)} field read`);
    setFooterValueByLabel('Asset Posture', building ? String(kpi.posture100) : '—', building ? 'asset posture' : 'no asset selected');
    setFooterValueByLabel('Execution Clock', building ? `${kpi.execDays ?? '—'}D` : '—', building ? `${kpi.exec100}% urgency` : 'execution pending');
    setFooterValueByLabel('Industry', STATE.selectedIndustryLabel, STATE.selectedIndustryColumn);
    setFooterValueByLabel('Geoid', tract?.geoid || '—');
    setFooterValueByLabel('Access', access);
    setFooterValueByLabel('Capture', captured);
    setFooterValueByLabel('Window', `${STATE.isochroneMinutes} min`);

    updateSelectedPropertyHero(building, tract, kpi);
  }

  function updateSelectedPanel(geoid, tract, building = null) {
    const kpi = computeKPIStack(tract, building);
    const tone = toneFrom100(kpi.field100);
    const industryValue = Math.round((building?.industryLens01 ?? tract?.industryLens01 ?? 0) * 100);
    const top3 = tract?.topIndustryStack || [];

    setText('tmDataset', 'Smartsheet Live');
    setText('tmRows', String(STATE.rowsLoaded || 0));
    setText('tmGeoid', geoid || '—');
    setText('tmSignal', tract?.dominant_force || tract?.signal_regime || 'Standby');

    setText(
      'panelMode',
      STATE.selectedMode === 'building'
        ? 'Subject asset resolved'
        : STATE.selectedMode === 'address'
          ? 'Subject address resolved'
          : STATE.selectedMode === 'tract'
            ? 'Direct tract lock'
            : 'Click tract or building'
    );

    setText('selGeoid', geoid || '—');
    setText('selScore', String(kpi.field100));
    setText(
      'selSignalText',
      `${tract?.dominant_force || tract?.signal_regime || 'Field lock'} • ${STATE.selectedIndustryLabel}`
    );

    const joinedCount = geoid
      ? STATE.buildings.filter(b => resolveBuildingGeoid(b) === geoid).length
      : 0;

    setText('joinedRows', joinedCount ? String(joinedCount) : '—');
    setText(
      'matchState',
      STATE.selectedMode === 'building'
        ? 'Asset + tract locked'
        : STATE.selectedMode === 'address'
          ? 'Address + tract locked'
          : STATE.selectedMode === 'tract'
            ? 'Tract locked'
            : 'Awaiting subject'
    );

    setText('bigPressure', String(kpi.field100));
    setText('miniLabor', String(Math.round(num(tract?.labor_pressure, 0))));
    setText('miniOpp', String(Math.round(num(tract?.opportunity_score, 0))));
    setText('miniMatch', String(industryValue));
    setText('miniTerminal', building ? 'Asset locked' : 'Live');

    setText('bbFile', `Smartsheet live intelligence join • ${STATE.selectedIndustryLabel}`);
    setText('signalLabel', tone.name);
    setText(
      'narrativeBox',
      building
        ? `${building.building_name}\n${pressureToneName(kpi.field01)} ${kpi.field100} PRESSURE • POSTURE ${kpi.posture100} • EXEC ${kpi.execDays ?? '—'}D\n${STATE.selectedIndustryLabel} lens active`
        : tract
          ? `${tract.tract_brief || tract.dominant_force || tract.signal_regime || 'Field locked'}\n${STATE.selectedIndustryLabel} lens active`
          : 'System armed. Select a tract or asset to resolve the live pressure field.'
    );

    const signalDot = byId('signalDot');
    if (signalDot) signalDot.style.background = tone.color;

    setBarWidth('barOverall', kpi.field100);
    setBarWidth('barPressure', Math.round(num(tract?.labor_pressure, 0)));
    setBarWidth('barOpportunity', Math.round(num(tract?.opportunity_score, 0)));

    const cmd = byId('commandBrief') || byId('commandBriefBody');
    if (cmd) {
      cmd.innerHTML = `
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${CONFIG.colors.soft};margin-bottom:8px;">Operating Signal</div>
        <div style="font-size:24px;font-weight:900;line-height:1;color:${tone.color};margin-bottom:10px;">${escapeHtml(tone.name)}</div>
        <div style="font-size:18px;font-weight:900;color:${CONFIG.colors.white};margin-bottom:8px;">${escapeHtml(tract?.dominant_force || tract?.signal_regime || 'Awaiting resolve')}</div>
        <div style="font-size:12px;line-height:1.45;color:${CONFIG.colors.text};opacity:.92;margin-bottom:12px;">
          ${escapeHtml(tract?.tract_brief || 'No tract intelligence brief available yet.')}
        </div>
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${CONFIG.colors.soft};margin-bottom:8px;">Decision State</div>
        <div style="font-size:16px;font-weight:900;color:${tone.color};margin-bottom:6px;">
          ${building ? 'POSITION + ENGAGE' : 'FIELD LOCK + TARGET'}
        </div>
        <div style="font-size:12px;line-height:1.45;color:${CONFIG.colors.white};margin-bottom:10px;">
          ${escapeHtml(
            building
              ? `${building.building_name} • posture ${kpi.posture100} • clear ${Math.round(num(building.clear_pressure, 0))} • exec ${kpi.execDays ?? '—'}D`
              : `Industry lens ${STATE.selectedIndustryLabel} • tract locked`
          )}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div style="padding:10px;border:1px solid rgba(114,243,255,.10);border-radius:12px;background:rgba(255,255,255,.02);">
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${CONFIG.colors.soft};">Pressure</div>
            <div style="font-size:20px;font-weight:900;color:${tone.color};">${kpi.field100}</div>
          </div>
          <div style="padding:10px;border:1px solid rgba(114,243,255,.10);border-radius:12px;background:rgba(255,255,255,.02);">
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${CONFIG.colors.soft};">Posture</div>
            <div style="font-size:20px;font-weight:900;color:${building ? toneFrom100(kpi.posture100).color : CONFIG.colors.white};">${building ? kpi.posture100 : '—'}</div>
          </div>
          <div style="padding:10px;border:1px solid rgba(114,243,255,.10);border-radius:12px;background:rgba(255,255,255,.02);">
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${CONFIG.colors.soft};">Window</div>
            <div style="font-size:20px;font-weight:900;color:${building ? tone.color : CONFIG.colors.white};">${building ? `${kpi.execDays ?? '—'}D` : '—'}</div>
          </div>
        </div>
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${CONFIG.colors.soft};margin-bottom:8px;">Top 3 Industries</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${top3.slice(0, 3).map((item, i) => `
            <div style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.06);background:${i === 0 ? 'linear-gradient(180deg, rgba(243,228,107,.10), rgba(243,228,107,.04))' : i === 1 ? 'linear-gradient(180deg, rgba(125,255,122,.10), rgba(125,255,122,.04))' : 'linear-gradient(180deg, rgba(114,243,255,.10), rgba(114,243,255,.04))'};font-size:12px;font-weight:900;">
              ${escapeHtml(item.label)} • ${Math.round(item.score01 * 100)}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  function setDefaultPanelState() {
    setText('tmDataset', 'Smartsheet Live');
    setText('tmRows', String(STATE.rowsLoaded || 0));
    setText('tmGeoid', '—');
    setText('tmSignal', 'Standby');
    setText('panelMode', 'Click tract or building');
    setText('selGeoid', '—');
    setText('selScore', '—');
    setText('selSignalText', `${STATE.selectedIndustryLabel} lens idle`);
    setText('joinedRows', '—');
    setText('matchState', 'Awaiting subject');
    setText('bigPressure', '—');
    setText('miniLabor', '—');
    setText('miniOpp', '—');
    setText('miniMatch', '—');
    setText('miniTerminal', 'Live');
    setText('narrativeBox', 'System armed. Select a tract or asset to resolve the live pressure field.');
    setText('bbFile', `Smartsheet live intelligence join • ${STATE.selectedIndustryLabel}`);
    setText('signalLabel', 'Standby');

    const signalDot = byId('signalDot');
    if (signalDot) signalDot.style.background = CONFIG.colors.cyan;

    setBarWidth('barOverall', 0);
    setBarWidth('barPressure', 0);
    setBarWidth('barOpportunity', 0);

    const cmd = byId('commandBrief') || byId('commandBriefBody');
    if (cmd) {
      cmd.innerHTML = `
        <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${CONFIG.colors.soft};margin-bottom:8px;">Boot</div>
        <div style="font-size:24px;font-weight:900;line-height:1;color:${CONFIG.colors.cyan};margin-bottom:10px;">STANDBY</div>
        <div style="font-size:12px;line-height:1.45;color:${CONFIG.colors.text};">
          Resolve an address or click a tract / asset to engage the field.
        </div>
      `;
    }

    updateHeroBar(null, null);
  }

  function makeTractsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: STATE.tracts.map(tract => ({
        type: 'Feature',
        properties: {
          geoid: tract.geoid,
          tract_name: tract.tract_name,
          dominant_force: tract.dominant_force,
          signal_regime: tract.signal_regime,
          active_pressure_100: tract.active_pressure_100,
          labor_pressure: tract.labor_pressure,
          opportunity_score: tract.opportunity_score,
          industry_lens_100: Math.round((tract.industryLens01 || 0) * 100)
        },
        geometry: {
          type: 'Point',
          coordinates: [tract.lon, tract.lat]
        }
      }))
    };
  }

  function makeBuildingsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: STATE.buildings.map(building => ({
        type: 'Feature',
        properties: {
          building_id: building.building_id,
          building_name: building.building_name,
          geoid: resolveBuildingGeoid(building),
          clear_pressure: building.clear_pressure,
          posture_score: building.building_posture_score,
          industry_lens_100: Math.round((building.industryLens01 || 0) * 100)
        },
        geometry: {
          type: 'Point',
          coordinates: [building.lon, building.lat]
        }
      }))
    };
  }

  function getSelectedBuildingLabelGeoJSON() {
    const building = currentSelectionBuilding();
    const tract = currentSelectionTract();
    if (!building) return { type: 'FeatureCollection', features: [] };

    const kpi = computeKPIStack(tract, building);
    const tone = pressureToneName(Math.max(kpi.field01, kpi.exec01));
    const access = Math.round((STATE.isochroneAnalysis?.fusedScore || 0) * 100);
    const capture = STATE.isochroneMinutes || CONFIG.isochrone.defaultMinutes;

    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          title: building.building_name,
          verdict: `${tone} | ${kpi.field100} PRESSURE | ${capture} MIN | ${access}% ACCESS | EXEC ${kpi.execDays ?? '—'}D`
        },
        geometry: {
          type: 'Point',
          coordinates: [building.lon, building.lat]
        }
      }]
    };
  }

  function getSelectedAddressGeoJSON() {
    const pt = STATE.selectedMode === 'address' ? STATE.selectedPointTarget : null;
    if (!pt || !Number.isFinite(pt.lon) || !Number.isFinite(pt.lat)) {
      return { type: 'FeatureCollection', features: [] };
    }

    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { title: pt.label || 'Resolved Address' },
        geometry: {
          type: 'Point',
          coordinates: [pt.lon, pt.lat]
        }
      }]
    };
  }

  function computeGravityVisuals() {
    const point = getSelectedPoint();
    const tract = currentSelectionTract();

    if (!point || !tract) {
      return {
        lines: { type: 'FeatureCollection', features: [] },
        rings: { type: 'FeatureCollection', features: [] }
      };
    }

    const rels = computeRelativeTracts(tract);
    const lineFeatures = rels.map(rel => ({
      type: 'Feature',
      properties: {
        geoid: rel.geoid,
        pull: rel.pull,
        color: pressureToneHex(rel.pull)
      },
      geometry: {
        type: 'LineString',
        coordinates: buildBezierArc([point.lon, point.lat], [rel.lon, rel.lat], rel.pull)
      }
    }));

    const ringFeatures = CONFIG.gravity.ringMiles.map((miles, index) => ({
      type: 'Feature',
      properties: {
        miles,
        opacity: index === 0 ? 0.12 : index === 1 ? 0.08 : 0.05
      },
      geometry: circlePolygon(point.lon, point.lat, milesToKm(miles))
    }));

    return {
      lines: { type: 'FeatureCollection', features: lineFeatures },
      rings: { type: 'FeatureCollection', features: ringFeatures }
    };
  }

  function refreshGravityVisuals() {
    const visuals = computeGravityVisuals();

    if (hasSource(SRC.gravityLines)) {
      map.getSource(SRC.gravityLines).setData(visuals.lines);
    }
    if (hasSource(SRC.gravityRings)) {
      map.getSource(SRC.gravityRings).setData(visuals.rings);
    }
  }

  function refreshTracts() {
    if (hasSource(SRC.tracts)) {
      map.getSource(SRC.tracts).setData(makeTractsGeoJSON());
    }
  }

  function refreshBuildings() {
    if (hasSource(SRC.buildings)) {
      map.getSource(SRC.buildings).setData(makeBuildingsGeoJSON());
    }
  }

  function refreshSelectedBuildingLabel() {
    if (hasSource(SRC.selectedBuilding)) {
      map.getSource(SRC.selectedBuilding).setData(getSelectedBuildingLabelGeoJSON());
    }
  }

  function refreshSelectedAddressSource() {
    if (hasSource(SRC.selectedAddress)) {
      map.getSource(SRC.selectedAddress).setData(getSelectedAddressGeoJSON());
    }
  }

  function refreshTractPaint() {
    if (!hasLayer(LYR.tractsFill)) return;

    map.setPaintProperty(LYR.tractsFill, 'circle-color', [
      'case',
      ['>=', ['get', 'active_pressure_100'], 80], CONFIG.colors.red,
      ['>=', ['get', 'active_pressure_100'], 55], CONFIG.colors.amber,
      CONFIG.colors.cyan
    ]);

    map.setPaintProperty(LYR.tractsFill, 'circle-opacity', [
      'case',
      ['==', ['get', 'geoid'], STATE.selectedGeoid || ''], 0.92,
      0.26
    ]);

    map.setPaintProperty(LYR.tractsLine, 'circle-stroke-color', [
      'case',
      ['==', ['get', 'geoid'], STATE.selectedGeoid || ''], CONFIG.colors.tractSelectedLine,
      CONFIG.colors.tractLine
    ]);

    map.setPaintProperty(LYR.tractsLine, 'circle-stroke-width', [
      'case',
      ['==', ['get', 'geoid'], STATE.selectedGeoid || ''], 2.3,
      0.8
    ]);
  }

  function refreshBuildingPaint() {
  if (!hasLayer(LYR.buildings)) return;

  map.setPaintProperty(LYR.buildings, 'circle-color', [
    'case',
    ['>=', ['get', 'posture_score'], 75], '#a86b63',
    ['>=', ['get', 'posture_score'], 45], '#718494',
    '#465d6b'
  ]);

  map.setPaintProperty(LYR.buildings, 'circle-opacity', 0.50);

  map.setPaintProperty(LYR.buildings, 'circle-stroke-color', '#b8d8e4');

  map.setPaintProperty(LYR.buildings, 'circle-stroke-width', 0.45);

  map.setPaintProperty(LYR.buildings, 'circle-stroke-opacity', 0.16);
}

  function clearIsochrone() {
    STATE.isochroneFeatureCollection = null;
    STATE.isochroneAnalysis = null;
    STATE.isochroneBusy = false;

    if (hasSource(SRC.isochrone)) {
      map.getSource(SRC.isochrone).setData({ type: 'FeatureCollection', features: [] });
    }

    updateIsochroneUiState();
  }

  function selectedIsochroneFallbackPolygon(building) {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: circlePolygon(
          building.lon,
          building.lat,
          Math.max(2.8, STATE.isochroneMinutes * CONFIG.isochrone.fallbackKmPerMinute)
        )
      }]
    };
  }

  function computeIsochroneAnalysis(centerEntity, fc) {
    if (!centerEntity || !fc || !Array.isArray(fc.features) || !fc.features.length) {
      return {
        fusedScore: 0,
        laborAccessScore: 0,
        tractCount: 0,
        reachableTracts: []
      };
    }

    const tractHits = [];

    for (const tract of STATE.tracts) {
      let inside = false;
      for (const feature of fc.features) {
        const geom = feature?.geometry;
        if (!geom) continue;
        if (pointInPolygonGeometry([tract.lon, tract.lat], geom)) {
          inside = true;
          break;
        }
      }
      if (inside) tractHits.push(tract);
    }

    const laborAccessScore = clamp01(
      tractHits.length
        ? tractHits.reduce((sum, t) => sum + computeFieldPressure(t), 0) / tractHits.length
        : 0
    );

    return {
      fusedScore: laborAccessScore,
      laborAccessScore,
      tractCount: tractHits.length,
      reachableTracts: tractHits.slice(0, 12)
    };
  }

  async function fetchIsochrone(building, minutes) {
    const coords = `${building.lon},${building.lat}`;
    const params = new URLSearchParams({
      contours_minutes: String(minutes),
      polygons: CONFIG.isochrone.polygons ? 'true' : 'false',
      denoise: String(CONFIG.isochrone.denoise),
      generalize: String(CONFIG.isochrone.generalize),
      access_token: mapboxgl.accessToken
    });

    const url = `https://api.mapbox.com/isochrone/v1/${CONFIG.isochrone.profile}/${coords}?${params.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Isochrone failed ${res.status}`);
    return res.json();
  }

  async function recomputeIsochrone(building) {
    if (!building || !CONFIG.isochrone.enabled) {
      clearIsochrone();
      return;
    }

    const reqId = ++STATE.isochroneReqSeq;
    STATE.isochroneBusy = true;
    updateIsochroneUiState();

    try {
      const fc = await fetchIsochrone(building, STATE.isochroneMinutes);

      if (reqId !== STATE.isochroneReqSeq) return;

      const normalized = {
        type: 'FeatureCollection',
        features: Array.isArray(fc?.features) ? fc.features : []
      };

      STATE.isochroneFeatureCollection = normalized;
      STATE.isochroneAnalysis = computeIsochroneAnalysis(building, normalized);

      if (hasSource(SRC.isochrone)) {
        map.getSource(SRC.isochrone).setData(normalized);
      }
    } catch (err) {
      console.warn('Isochrone fallback', err);

      if (reqId !== STATE.isochroneReqSeq) return;

      const fallback = selectedIsochroneFallbackPolygon(building);
      STATE.isochroneFeatureCollection = fallback;
      STATE.isochroneAnalysis = computeIsochroneAnalysis(building, fallback);

      if (hasSource(SRC.isochrone)) {
        map.getSource(SRC.isochrone).setData(fallback);
      }
    } finally {
      if (reqId === STATE.isochroneReqSeq) {
        STATE.isochroneBusy = false;
        updateIsochroneUiState();
      }
    }
  }

  async function recomputeBuildingGravity(building, tract) {
    if (!building || !tract) {
      STATE.selectedBuildingGravity = null;
      refreshGravityVisuals();
      return;
    }

    const rels = computeRelativeTracts(tract);
    const industry01 = clamp01(num(building.industryLens01, 0));

    const totalPull = clamp01(
      (rels.reduce((sum, item) => sum + item.pull, 0) / Math.max(rels.length, 1)) * 0.62 +
      industry01 * 0.38
    );

    STATE.selectedBuildingGravity = {
      totalPull,
      topTracts: rels
    };

    refreshGravityVisuals();
  }

  function flyToPoint(lon, lat, zoom = 16.0) {
    if (!map || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    map.flyTo({
      center: [lon, lat],
      zoom,
      pitch: 78,
      bearing: 20,
      speed: 0.72,
      curve: 1.25,
      essential: true
    });
  }

  function closePopup() {
    if (STATE.popup) {
      try { STATE.popup.remove(); } catch {}
      STATE.popup = null;
    }
  }

  function openBuildingPopup(building, tract) {
    closePopup();
    if (!map || !building) return;

    const kpi = computeKPIStack(tract, building);
    const tone = toneFrom100(kpi.field100);

    const html = `
      <div style="min-width:220px;">
        <div style="font-size:13px;font-weight:900;color:${CONFIG.colors.white};margin-bottom:4px;">
          ${escapeHtml(building.building_name)}
        </div>
        <div style="font-size:11px;color:${CONFIG.colors.soft};letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">
          ${escapeHtml(STATE.selectedIndustryLabel)} lens
        </div>
        <div style="font-size:12px;line-height:1.5;color:${CONFIG.colors.text};">
          ${escapeHtml(tone.name)} ${kpi.field100} • POSTURE ${kpi.posture100} • EXEC ${kpi.execDays ?? '—'}D
        </div>
      </div>
    `;

    STATE.popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 16
    })
      .setLngLat([building.lon, building.lat])
      .setHTML(html)
      .addTo(map);
  }

  async function handleBuildingSelection(buildingId) {
    const building = STATE.buildingById[safeText(buildingId)];
    if (!building) return;

    let geoid = resolveBuildingGeoid(building);
    let tract = getTractRaw(geoid);

    if (!tract) {
      geoid = resolveNearestTractGeoid(building.lon, building.lat);
      tract = getTractRaw(geoid);
    }

    if (!tract) {
      throw new Error('CRITICAL: TRACT RESOLUTION FAILURE');
    }

    STATE.selectedMode = 'building';
    STATE.selectedBuildingId = building.building_id;
    STATE.selectedGeoid = geoid;
    STATE.selectedTractGeoid = geoid;
    STATE.selectedResolvedTarget = null;
    STATE.selectedSearchResult = null;
    STATE.selectedPointTarget = null;

    await recomputeBuildingGravity(building, tract);
    await recomputeIsochrone(building);

    refreshSelectedBuildingLabel();
    refreshSelectedAddressSource();
    refreshBuildings();
    refreshBuildingPaint();
    refreshTracts();
    refreshTractPaint();
    refreshGravityVisuals();

    updateSelectedPanel(geoid, tract, building);
    updateHeroBar(building, tract);
    pushSelectionPayload(tract, building);

    openBuildingPopup(building, tract);
    flyToPoint(building.lon, building.lat, 16.25);
  }

  function handleTractSelection(geoid) {
    const tract = getTractRaw(geoid);
    if (!tract) return;

    STATE.selectedMode = 'tract';
    STATE.selectedGeoid = tract.geoid;
    STATE.selectedTractGeoid = tract.geoid;
    STATE.selectedBuildingId = null;
    STATE.selectedResolvedTarget = null;
    STATE.selectedSearchResult = null;
    STATE.selectedPointTarget = null;
    STATE.selectedBuildingGravity = null;

    clearIsochrone();
    closePopup();

    refreshSelectedBuildingLabel();
    refreshSelectedAddressSource();
    refreshBuildings();
    refreshBuildingPaint();
    refreshTracts();
    refreshTractPaint();
    refreshGravityVisuals();

    updateSelectedPanel(tract.geoid, tract, null);
    updateHeroBar(null, tract);
    pushSelectionPayload(tract, null);

    flyToPoint(tract.lon, tract.lat, 14.7);
  }

  function setResolvedTarget(payload) {
    const target =
      payload?.selected_location ||
      payload?.result ||
      payload?.resolved_target ||
      null;

    if (!target) return;

    const tract = payload?.tract || payload?.tract_raw || null;
    const geoid = cleanGeoid(target?.geoid || tract?.geoid);

    STATE.selectedMode = 'address';
    STATE.selectedResolvedTarget = payload;
    STATE.selectedSearchResult = target;
    STATE.selectedPointTarget = {
      lat: num(target.lat, NaN),
      lon: num(target.lon, NaN),
      label: safeText(
        target.matched_address ||
        target.address_label ||
        target.place_name ||
        target.input ||
        'Resolved Address'
      ),
      geoid,
      source: safeText(target.source)
    };

    STATE.selectedBuildingId = null;
    STATE.selectedBuildingGravity = null;
    STATE.selectedGeoid = geoid || null;
    STATE.selectedTractGeoid = geoid || null;

    clearIsochrone();
    closePopup();

    refreshSelectedBuildingLabel();
    refreshSelectedAddressSource();
    refreshBuildings();
    refreshBuildingPaint();
    refreshTracts();
    refreshTractPaint();
    refreshGravityVisuals();

    if (Number.isFinite(STATE.selectedPointTarget.lon) && Number.isFinite(STATE.selectedPointTarget.lat)) {
      flyToPoint(STATE.selectedPointTarget.lon, STATE.selectedPointTarget.lat, 15.45);
    }

    if (tract) {
      updateSelectedPanel(geoid, tract, null);
      updateHeroBar(null, tract);
      pushSelectionPayload(
        tract,
        null,
        {
          matched_address: STATE.selectedPointTarget.label,
          address_label: STATE.selectedPointTarget.label,
          lat: STATE.selectedPointTarget.lat,
          lon: STATE.selectedPointTarget.lon,
          geoid
        },
        payload?.relative_tracts || null
      );
    } else {
      updateHeroBar(null, null);
    }
  }

  function buildPropertySelectUi() {
    const topbar = byId('topbar');
    const select = byId('propertySelect');
    const status = byId('propertySelectStatus');

    if (!topbar || !select) return;

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select property…';
    select.appendChild(placeholder);

    const buildings = [...STATE.buildings].sort(compareBuildingsForSelect);
    for (const building of buildings) {
      const opt = document.createElement('option');
      opt.value = building.building_id;
      opt.textContent = building.building_name || building.Building_Address || building.building_id;
      select.appendChild(opt);
    }

    select.onchange = () => {
      const id = safeText(select.value);
      if (!id) {
        if (status) status.textContent = 'Idle';
        return;
      }
      if (status) status.textContent = 'Locked';
      handleBuildingSelection(id).catch(console.error);
    };

    if (status) status.textContent = 'Idle';
  }

  function syncPropertySelectSelection() {
    const select = byId('propertySelect');
    if (!select) return;
    select.value = STATE.selectedBuildingId || '';
  }

  function buildSearchUi() {
    const input = byId('propertySearchInput');
    const btn = byId('propertySearchBtn');
    const status = byId('propertySelectStatus');
    const wrap = byId('propertyControl') || byId('topbar') || document.body;

    if (!input || !btn) return;

    wrap.style.position = wrap.style.position || 'relative';

    let dropdown = byId('propertySearchDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'propertySearchDropdown';
      dropdown.style.position = 'absolute';
      dropdown.style.left = '42px';
      dropdown.style.right = '84px';
      dropdown.style.top = '42px';
      dropdown.style.zIndex = '9999';
      dropdown.style.display = 'none';
      dropdown.style.border = '1px solid rgba(114,243,255,.14)';
      dropdown.style.borderRadius = '12px';
      dropdown.style.overflow = 'hidden';
      dropdown.style.background = 'rgba(7,16,25,.98)';
      dropdown.style.backdropFilter = 'blur(12px)';
      dropdown.style.boxShadow = '0 18px 36px rgba(0,0,0,.45)';
      wrap.appendChild(dropdown);
    }

    function closeDropdown() {
      STATE.highlightedSearchIndex = -1;
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
    }

    function renderDropdown() {
      const results = STATE.searchResults || [];

      if (!results.length) {
        closeDropdown();
        return;
      }

      dropdown.innerHTML = '';
      dropdown.style.display = 'block';

      results.forEach((candidate, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.width = '100%';
        row.style.border = '0';
        row.style.textAlign = 'left';
        row.style.padding = '10px 12px';
        row.style.cursor = 'pointer';
        row.style.background =
          index === STATE.highlightedSearchIndex
            ? 'rgba(114,243,255,.12)'
            : 'rgba(7,16,25,.98)';
        row.style.color = CONFIG.colors.text;
        row.style.borderBottom = '1px solid rgba(114,243,255,.08)';

        row.innerHTML = `
          <div style="font-size:12px;font-weight:800;letter-spacing:.03em;">
            ${escapeHtml(safeText(candidate.address_label || candidate.matched_address || candidate.place_name))}
          </div>
          <div style="margin-top:3px;font-size:10px;color:${CONFIG.colors.soft};letter-spacing:.08em;text-transform:uppercase;">
            ${escapeHtml([
              safeText(candidate.address_context || candidate.jurisdiction || candidate.region_label, ''),
              safeText(candidate.source, '').replace(/_/g, ' '),
              safeText(candidate.geoid, '') ? `TRACT ${safeText(candidate.geoid)}` : ''
            ].filter(Boolean).join(' • '))}
          </div>
        `;

        row.onmouseenter = () => {
          STATE.highlightedSearchIndex = index;
          renderDropdown();
        };

        row.onmousedown = async evt => {
          evt.preventDefault();
          STATE.selectedSearchCandidate = candidate;
          input.value = safeText(candidate.address_label || candidate.matched_address || candidate.place_name);
          if (status) status.textContent = 'Locked';
          closeDropdown();
          try {
            const payload = await fuseAddress(STATE.selectedSearchCandidate || input.value.trim());
            setResolvedTarget(payload);
            if (status) status.textContent = 'Resolved';
          } catch (err) {
            console.error(err);
            if (status) status.textContent = 'Resolve fail';
          }
        };

        dropdown.appendChild(row);
      });
    }

    async function performSearch() {
      const q = String(input.value || '').trim();
      STATE.selectedSearchCandidate = null;

      if (!q) {
        STATE.searchResults = [];
        if (status) status.textContent = 'Idle';
        closeDropdown();
        return;
      }

      if (q.length < CONFIG.search.minChars) {
        if (status) status.textContent = 'Typing';
        closeDropdown();
        return;
      }

      if (status) status.textContent = 'Search';

      clearTimeout(STATE.searchTimer);
      STATE.searchTimer = setTimeout(async () => {
        try {
          const results = await searchAddress(q);
          STATE.searchResults = Array.isArray(results) ? results : (results?.results || []);
          if (status) status.textContent = STATE.searchResults.length ? 'Select' : 'No match';
          renderDropdown();
        } catch (err) {
          console.error(err);
          if (status) status.textContent = 'Search fail';
          closeDropdown();
        }
      }, CONFIG.search.debounceMs);
    }

    async function resolveSelectedOrTypedAddress() {
      const q = String(input.value || '').trim();
      if (!q) {
        if (status) status.textContent = 'Idle';
        return;
      }

      if (status) status.textContent = 'Resolve';

      try {
        const payload = await fuseAddress(STATE.selectedSearchCandidate || q);
        setResolvedTarget(payload);
        if (status) status.textContent = 'Resolved';
      } catch (err) {
        console.error(err);
        if (status) status.textContent = 'Resolve fail';
      }
    }

    input.oninput = performSearch;
    btn.onclick = resolveSelectedOrTypedAddress;

    input.onkeydown = async evt => {
      const results = STATE.searchResults || [];

      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        if (results.length) {
          STATE.highlightedSearchIndex = Math.min(
            STATE.highlightedSearchIndex + 1,
            results.length - 1
          );
          renderDropdown();
        }
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        if (results.length) {
          STATE.highlightedSearchIndex = Math.max(STATE.highlightedSearchIndex - 1, 0);
          renderDropdown();
        }
      } else if (evt.key === 'Enter') {
        evt.preventDefault();
        if (results.length && STATE.highlightedSearchIndex >= 0) {
          STATE.selectedSearchCandidate = results[STATE.highlightedSearchIndex];
          input.value = safeText(
            STATE.selectedSearchCandidate.address_label ||
            STATE.selectedSearchCandidate.matched_address ||
            STATE.selectedSearchCandidate.place_name
          );
        }
        await resolveSelectedOrTypedAddress();
      } else if (evt.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('click', evt => {
      if (!wrap.contains(evt.target)) closeDropdown();
    });
  }

  function buildIsochroneUi() {
    const topbar = byId('topbar');
    if (!topbar) return;

    const existing = byId('isochroneControlWrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'isochroneControlWrap';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '10px';
    wrap.style.marginLeft = '12px';
    wrap.style.padding = '8px 12px';
    wrap.style.border = '1px solid rgba(114,243,255,.08)';
    wrap.style.borderRadius = '12px';
    wrap.style.background = 'rgba(0,0,0,.22)';
    wrap.style.minWidth = '320px';

    const label = document.createElement('div');
    label.textContent = 'Isochrone';
    label.style.fontSize = '11px';
    label.style.letterSpacing = '.14em';
    label.style.textTransform = 'uppercase';
    label.style.color = CONFIG.colors.soft;

    const input = document.createElement('input');
    input.id = 'isochroneRange';
    input.type = 'range';
    input.min = String(CONFIG.isochrone.minMinutes);
    input.max = String(CONFIG.isochrone.maxMinutes);
    input.step = String(CONFIG.isochrone.stepMinutes);
    input.value = String(STATE.isochroneMinutes);
    input.style.flex = '1 1 auto';
    input.style.accentColor = CONFIG.colors.cyan;

    const value = document.createElement('div');
    value.id = 'isochroneMinutesValue';
    value.textContent = `${STATE.isochroneMinutes} min`;
    value.style.fontSize = '12px';
    value.style.fontWeight = '800';
    value.style.color = CONFIG.colors.text;
    value.style.width = '56px';
    value.style.textAlign = 'right';

    const status = document.createElement('div');
    status.id = 'isochroneStatus';
    status.textContent = 'Select asset';
    status.style.fontSize = '11px';
    status.style.color = CONFIG.colors.soft;
    status.style.minWidth = '76px';
    status.style.textAlign = 'right';

    input.oninput = async () => {
      STATE.isochroneMinutes = num(input.value, CONFIG.isochrone.defaultMinutes);
      value.textContent = `${STATE.isochroneMinutes} min`;

      const building = currentSelectionBuilding();
      const tract = currentSelectionTract();

      if (building) {
        await recomputeIsochrone(building);
        updateSelectedPanel(tract?.geoid || '', tract, building);
        updateHeroBar(building, tract);
        pushSelectionPayload(tract, building);
        refreshSelectedBuildingLabel();
      } else {
        updateHeroBar(null, tract);
      }
    };

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(value);
    wrap.appendChild(status);
    topbar.appendChild(wrap);

    updateIsochroneUiState();
  }

  function updateIsochroneUiState() {
    const input = byId('isochroneRange');
    const value = byId('isochroneMinutesValue');
    const status = byId('isochroneStatus');

    if (input) {
      input.disabled = !STATE.selectedBuildingId;
      input.value = String(STATE.isochroneMinutes);
    }

    if (value) value.textContent = `${STATE.isochroneMinutes} min`;

    if (status) {
      if (!STATE.selectedBuildingId) status.textContent = 'Select asset';
      else if (STATE.isochroneBusy) status.textContent = 'Resolving';
      else status.textContent = 'Live';
    }

    const industryStatus = byId('industryStatus');
    if (industryStatus) {
      industryStatus.textContent = STATE.selectedIndustryLabel;
    }
  }

  function buildIndustryToggleUi() {
    const topbar = byId('topbar');
    if (!topbar) return;

    const existing = byId('industryToggleWrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'industryToggleWrap';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '10px';
    wrap.style.marginLeft = '12px';
    wrap.style.padding = '8px 12px';
    wrap.style.border = '1px solid rgba(114,243,255,.08)';
    wrap.style.borderRadius = '12px';
    wrap.style.background = 'rgba(0,0,0,.22)';
    wrap.style.minWidth = '360px';

    const label = document.createElement('div');
    label.textContent = 'Industry';
    label.style.fontSize = '11px';
    label.style.letterSpacing = '.14em';
    label.style.textTransform = 'uppercase';
    label.style.color = CONFIG.colors.soft;

    const select = document.createElement('select');
    select.id = 'industrySelect';
    select.style.flex = '1 1 auto';
    select.style.height = '30px';
    select.style.borderRadius = '8px';
    select.style.border = '1px solid rgba(114,243,255,.14)';
    select.style.background = 'rgba(7,16,25,.92)';
    select.style.color = CONFIG.colors.text;
    select.style.outline = 'none';
    select.style.padding = '0 10px';
    select.style.fontSize = '12px';

    CONFIG.exactIndustryColumns.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.value === STATE.selectedIndustryColumn) opt.selected = true;
      select.appendChild(opt);
    });

    const status = document.createElement('div');
    status.id = 'industryStatus';
    status.textContent = STATE.selectedIndustryLabel;
    status.style.fontSize = '11px';
    status.style.color = CONFIG.colors.text;
    status.style.minWidth = '96px';
    status.style.textAlign = 'right';

    select.onchange = async () => {
      const selected = getIndustryColumnConfig(select.value);
      STATE.selectedIndustryColumn = selected.value;
      STATE.selectedIndustryLabel = selected.label;
      status.textContent = STATE.selectedIndustryLabel;

      rehydrateIndustryState();
      refreshTracts();
      refreshBuildings();
      refreshTractPaint();
      refreshBuildingPaint();

      const building = currentSelectionBuilding();
      const tract = currentSelectionTract();

      if (building && tract) {
        await recomputeBuildingGravity(building, tract);
        await recomputeIsochrone(building);
        updateSelectedPanel(tract.geoid, tract, building);
        updateHeroBar(building, tract);
        pushSelectionPayload(tract, building);
      } else if (tract) {
        updateSelectedPanel(tract.geoid, tract, null);
        updateHeroBar(null, tract);
        pushSelectionPayload(tract, null);
      } else {
        setDefaultPanelState();
      }

      refreshSelectedBuildingLabel();
      refreshSelectedAddressSource();
      refreshGravityVisuals();
      updateIsochroneUiState();
    };

    wrap.appendChild(label);
    wrap.appendChild(select);
    wrap.appendChild(status);
    topbar.appendChild(wrap);
  }

  function buildSelfGuidedUi() {
    const topbar = byId('topbar');
    if (!topbar) return;

    const existing = byId('selfGuidedWrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'selfGuidedWrap';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '10px';
    wrap.style.marginLeft = '12px';
    wrap.style.padding = '8px 12px';
    wrap.style.border = '1px solid rgba(114,243,255,.08)';
    wrap.style.borderRadius = '12px';
    wrap.style.background = 'rgba(0,0,0,.22)';
    wrap.style.minWidth = '220px';

    const label = document.createElement('div');
    label.textContent = 'Flight';
    label.style.fontSize = '11px';
    label.style.letterSpacing = '.14em';
    label.style.textTransform = 'uppercase';
    label.style.color = CONFIG.colors.soft;

    const btn = document.createElement('button');
    btn.id = 'selfGuidedBtn';
    btn.type = 'button';
    btn.textContent = 'Self-Guided';
    btn.style.height = '30px';
    btn.style.padding = '0 12px';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid rgba(114,243,255,.18)';
    btn.style.background = 'rgba(7,16,25,.92)';
    btn.style.color = CONFIG.colors.text;
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '12px';
    btn.style.fontWeight = '800';

    const status = document.createElement('div');
    status.id = 'selfGuidedStatus';
    status.textContent = 'OFF';
    status.style.fontSize = '11px';
    status.style.minWidth = '52px';
    status.style.textAlign = 'right';
    status.style.color = CONFIG.colors.soft;

    function paint() {
      const on = !!STATE.selfGuided;
      btn.style.background = on ? 'rgba(114,243,255,.16)' : 'rgba(7,16,25,.92)';
      btn.style.borderColor = on ? 'rgba(114,243,255,.42)' : 'rgba(114,243,255,.18)';
      btn.style.color = on ? CONFIG.colors.white : CONFIG.colors.text;
      status.textContent = on ? 'LIVE' : 'OFF';
      status.style.color = on ? CONFIG.colors.cyan : CONFIG.colors.soft;
    }

    btn.onclick = () => {
      STATE.selfGuided = !STATE.selfGuided;
      if (STATE.selfGuided) {
        STATE.interactionLockUntil = performance.now() + 99999999;
        closePopup();
      }
      paint();
    };

    wrap.appendChild(label);
    wrap.appendChild(btn);
    wrap.appendChild(status);
    topbar.appendChild(wrap);

    paint();
  }

  function injectPopupChrome() {
    if (document.getElementById('chronos-popup-chrome')) return;

    const style = document.createElement('style');
    style.id = 'chronos-popup-chrome';
    style.textContent = `
      .mapboxgl-popup-content{
        background: linear-gradient(180deg, ${CONFIG.colors.chrome} 0%, ${CONFIG.colors.chrome2} 100%);
        color: ${CONFIG.colors.text};
        border: 1px solid rgba(114,243,255,.16);
        border-radius: 14px;
        box-shadow:
          0 12px 40px rgba(0,0,0,.45),
          inset 0 0 0 1px rgba(255,255,255,.02);
        padding: 12px 14px;
      }
      .mapboxgl-popup-tip{
        border-top-color: ${CONFIG.colors.chrome2} !important;
        border-bottom-color: ${CONFIG.colors.chrome2} !important;
      }
      .mapboxgl-popup-close-button{
        color: ${CONFIG.colors.text};
        opacity: .7;
      }
      .mapboxgl-popup-close-button:hover{
        opacity: 1;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  function addSources() {
    if (!hasSource(SRC.tracts)) {
      map.addSource(SRC.tracts, {
        type: 'geojson',
        data: makeTractsGeoJSON()
      });
    }

    if (!hasSource(SRC.buildings)) {
      map.addSource(SRC.buildings, {
        type: 'geojson',
        data: makeBuildingsGeoJSON()
      });
    }

    if (!hasSource(SRC.selectedBuilding)) {
      map.addSource(SRC.selectedBuilding, {
        type: 'geojson',
        data: getSelectedBuildingLabelGeoJSON()
      });
    }

    if (!hasSource(SRC.selectedAddress)) {
      map.addSource(SRC.selectedAddress, {
        type: 'geojson',
        data: getSelectedAddressGeoJSON()
      });
    }

    if (!hasSource(SRC.gravityLines)) {
      map.addSource(SRC.gravityLines, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!hasSource(SRC.gravityRings)) {
      map.addSource(SRC.gravityRings, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!hasSource(SRC.isochrone)) {
      map.addSource(SRC.isochrone, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
  }

  function add3DBuildingsLayer() {
  if (hasLayer(LYR.mapbox3dBuildings)) return;

  const style = map.getStyle();
  const layers = style?.layers || [];
  const labelLayer = layers.find(layer => layer.type === 'symbol' && layer.layout?.['text-field']);

  if (!map.getSource('composite')) return;

  map.addLayer(
    {
      id: LYR.mapbox3dBuildings,
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', ['get', 'extrude'], 'true'],
      type: 'fill-extrusion',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'height'], 0],
          0, CONFIG.colors.buildingNightLow,
          40, CONFIG.colors.buildingNightLow,
          120, CONFIG.colors.buildingNightMid,
          260, CONFIG.colors.buildingNightHigh,
          520, '#1d2b36'
        ],
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13, 0,
          13.1, ['*', ['coalesce', ['get', 'height'], 0], 0.98]
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13, 0,
          13.1, ['coalesce', ['get', 'min_height'], 0]
        ],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true
      }
    },
    labelLayer?.id
  );

  if (!hasLayer('chronos-mapbox-3d-building-edges')) {
    map.addLayer(
      {
        id: 'chronos-mapbox-3d-building-edges',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', ['get', 'extrude'], 'true'],
        type: 'line',
        minzoom: 15,
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'height'], 0],
            0, 'rgba(158,215,234,0.03)',
            80, 'rgba(158,215,234,0.05)',
            180, 'rgba(255,211,138,0.08)',
            360, 'rgba(255,211,138,0.11)'
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 0.35,
            17, 0.75,
            18.5, 1.05
          ],
          'line-opacity': 0.32
        }
      },
      labelLayer?.id
    );
  }
}

  function addLayers() {
    add3DBuildingsLayer();

    if (!hasLayer(LYR.tractsFill)) {
      map.addLayer({
        id: LYR.tractsFill,
        type: 'circle',
        source: SRC.tracts,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, 5,
            12, 9,
            16, 15
          ],
          'circle-color': CONFIG.colors.cyan,
          'circle-opacity': 0.28
        }
      });
    }

    if (!hasLayer(LYR.tractsLine)) {
      map.addLayer({
        id: LYR.tractsLine,
        type: 'circle',
        source: SRC.tracts,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, 5,
            12, 9,
            16, 15
          ],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 0.8,
          'circle-stroke-color': CONFIG.colors.tractLine
        }
      });
    }

    if (!hasLayer(LYR.tractsLabel)) {
      map.addLayer({
        id: LYR.tractsLabel,
        type: 'symbol',
        source: SRC.tracts,
        layout: {
          'text-field': ['get', 'tract_name'],
          'text-size': 10,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': CONFIG.colors.white,
          'text-halo-color': 'rgba(2,5,10,.92)',
          'text-halo-width': 1
        }
      });
    }

    if (!hasLayer(LYR.buildings)) {
      map.addLayer({
        id: LYR.buildings,
        type: 'circle',
        source: SRC.buildings,
        paint: {
          'circle-color': CONFIG.colors.amber,
          'circle-radius': 5.4,
          'circle-stroke-width': 1.4,
          'circle-stroke-color': '#02060b',
          'circle-opacity': 0.76
        }
      });
    }

    if (!hasLayer(LYR.selectedBuilding)) {
      map.addLayer({
        id: LYR.selectedBuilding,
        type: 'symbol',
        source: SRC.selectedBuilding,
        layout: {
          'text-field': ['coalesce', ['get', 'title'], ''],
          'text-size': 13,
          'text-offset': [0, -2.3],
          'text-anchor': 'bottom',
          'text-allow-overlap': true
        },
        paint: {
          'text-color': CONFIG.colors.white,
          'text-halo-color': 'rgba(2,5,10,.92)',
          'text-halo-width': 1.2
        }
      });
    }

    if (!hasLayer(LYR.selectedAddressHalo)) {
      map.addLayer({
        id: LYR.selectedAddressHalo,
        type: 'circle',
        source: SRC.selectedAddress,
        paint: {
          'circle-color': CONFIG.colors.lime,
          'circle-radius': 15,
          'circle-opacity': 0.10,
          'circle-stroke-width': 1.8,
          'circle-stroke-color': CONFIG.colors.lime
        }
      });
    }

    if (!hasLayer(LYR.selectedAddress)) {
      map.addLayer({
        id: LYR.selectedAddress,
        type: 'circle',
        source: SRC.selectedAddress,
        paint: {
          'circle-color': CONFIG.colors.white,
          'circle-radius': 6,
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.2,
          'circle-stroke-color': CONFIG.colors.lime
        }
      });
    }

    if (!hasLayer(LYR.gravityRings)) {
      map.addLayer({
        id: LYR.gravityRings,
        type: 'fill',
        source: SRC.gravityRings,
        paint: {
          'fill-color': CONFIG.colors.cyan,
          'fill-opacity': ['coalesce', ['get', 'opacity'], 0.06]
        }
      });
    }

    if (!hasLayer(LYR.gravityRingOutline)) {
      map.addLayer({
        id: LYR.gravityRingOutline,
        type: 'line',
        source: SRC.gravityRings,
        paint: {
          'line-color': CONFIG.colors.cyan,
          'line-width': 1,
          'line-opacity': 0.12
        }
      });
    }

    if (!hasLayer(LYR.gravityLines)) {
      map.addLayer({
        id: LYR.gravityLines,
        type: 'line',
        source: SRC.gravityLines,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], CONFIG.colors.cyan],
          'line-width': 2.1,
          'line-opacity': 0.44
        }
      });
    }

    if (!hasLayer(LYR.isochroneFill)) {
      map.addLayer({
        id: LYR.isochroneFill,
        type: 'fill',
        source: SRC.isochrone,
        paint: {
          'fill-color': CONFIG.colors.cyan,
          'fill-opacity': 0.10
        }
      });
    }

    if (!hasLayer(LYR.isochroneLine)) {
      map.addLayer({
        id: LYR.isochroneLine,
        type: 'line',
        source: SRC.isochrone,
        paint: {
          'line-color': CONFIG.colors.cyan,
          'line-width': 2,
          'line-opacity': 0.62
        }
      });
    }

    refreshTractPaint();
    refreshBuildingPaint();
  }

  function attachInteractions() {
    map.on('click', LYR.buildings, evt => {
      const feature = evt.features?.[0];
      const buildingId = safeText(feature?.properties?.building_id);
      if (buildingId) handleBuildingSelection(buildingId).catch(console.error);
    });

    map.on('click', LYR.tractsFill, evt => {
      const feature = evt.features?.[0];
      const geoid = cleanGeoid(feature?.properties?.geoid);
      if (geoid) handleTractSelection(geoid);
    });

    map.on('mouseenter', LYR.buildings, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', LYR.buildings, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', LYR.tractsFill, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', LYR.tractsFill, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  function applyAtmosphere() {
  if (!map) return;

  try {
    map.setFog(CONFIG.fog);
  } catch {}

  try {
    const style = map.getStyle();
    const layers = style?.layers || [];

    layers.forEach(layer => {
      const id = layer.id || '';

      if (layer.type === 'symbol') {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'none');
        }
      }

      if (layer.type === 'line' && id.includes('road')) {
        try { map.setPaintProperty(id, 'line-opacity', 0.08); } catch {}
      }

      if (layer.type === 'fill') {
        try { map.setPaintProperty(id, 'fill-opacity', 0.15); } catch {}
      }
    });
  } catch {}
}

  function ensureMap() {
    if (map) return map;

    map = new mapboxgl.Map({
      container: 'map',
      style: CONFIG.style,
      center: CONFIG.center,
      zoom: CONFIG.zoom,
      pitch: CONFIG.pitch,
      bearing: CONFIG.bearing,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      attributionControl: false
    });

    map.on('style.load', () => {
      applyAtmosphere();

      if (STATE.booted) {
        addSources();
        addLayers();
        refreshTracts();
        refreshBuildings();
        refreshSelectedBuildingLabel();
        refreshSelectedAddressSource();
        refreshGravityVisuals();
      }
    });

    return map;
  }

  function applyAnimatedBuildingBreath(now) {
  if (!map || !hasLayer(LYR.buildings)) return;

  const t = now / 1000;
  const pulse = smoothWave01((t / CONFIG.anim.buildingSeconds) * Math.PI * 2);

  map.setPaintProperty(LYR.buildings, 'circle-radius', [
    'case',
    ['==', ['get', 'building_id'], STATE.selectedBuildingId || ''],
    [
      'interpolate',
      ['linear'],
      ['zoom'],
      11, 1.4 + pulse * 0.25,
      14, 2.1 + pulse * 0.35,
      16, 3.0 + pulse * 0.45,
      18, 4.0 + pulse * 0.55
    ],
    [
      'interpolate',
      ['linear'],
      ['zoom'],
      11, 1.0 + pulse * 0.10,
      14, 1.6 + pulse * 0.14,
      16, 2.4 + pulse * 0.18,
      18, 3.2 + pulse * 0.22
    ]
  ]);

  map.setPaintProperty(LYR.buildings, 'circle-opacity', [
    'case',
    ['==', ['get', 'building_id'], STATE.selectedBuildingId || ''],
    0.86 + pulse * 0.08,
    0.42 + pulse * 0.06
  ]);

  map.setPaintProperty(LYR.buildings, 'circle-stroke-opacity', [
    'case',
    ['==', ['get', 'building_id'], STATE.selectedBuildingId || ''],
    0.54 + pulse * 0.10,
    0.10 + pulse * 0.05
  ]);
}

  function applyAnimatedSelectedHalo(now) {
    if (!map || !hasLayer(LYR.selectedAddressHalo)) return;

    const seconds = now / 1000;
    const wave = smoothWave01((seconds / CONFIG.anim.haloSeconds) * Math.PI * 2);

    map.setPaintProperty(LYR.selectedAddressHalo, 'circle-radius', 14 + wave * 6);
    map.setPaintProperty(LYR.selectedAddressHalo, 'circle-opacity', 0.08 + wave * 0.10);
  }

  function applyAnimatedIsochrone(now) {
  if (!map || !hasLayer(LYR.isochroneFill) || !hasLayer(LYR.isochroneLine)) return;

  const t = now / 1000;
  const pulse = smoothWave01((t / CONFIG.anim.pulseSeconds) * Math.PI * 2);

  map.setPaintProperty(LYR.isochroneFill, 'fill-opacity', 0.10 + pulse * 0.03);
  map.setPaintProperty(LYR.isochroneLine, 'line-opacity', 0.28 + pulse * 0.08);
}

  function applyIdleCameraDrift(now) {
    if (!STATE.selfGuided || !map || STATE.selectedBuildingId || STATE.selectedPointTarget || STATE.selectedGeoid) return;

    const t = (now / 1000) / CONFIG.anim.cameraDriftSeconds;
    const bearing = CONFIG.bearing + Math.sin(t * Math.PI * 2) * 8;
    const pitch = CONFIG.pitch + Math.sin(t * Math.PI * 2 + 1.1) * 2.2;

    map.easeTo({
      bearing,
      pitch,
      duration: 900,
      easing: x => x
    });
  }

  function tickAnimation(now) {
    STATE.animPhase = (now / 1000) % CONFIG.anim.pulseSeconds / CONFIG.anim.pulseSeconds;

    applyAnimatedBuildingBreath(now);
    applyAnimatedSelectedHalo(now);
    applyAnimatedIsochrone(now);
    applyIdleCameraDrift(now);

    STATE.animRaf = requestAnimationFrame(tickAnimation);
  }

  function startAnimationLoop() {
    if (STATE.animRaf) cancelAnimationFrame(STATE.animRaf);
    STATE.animRaf = requestAnimationFrame(tickAnimation);
  }

  async function boot() {
    injectPopupChrome();
    ensureMap();

    map.on('load', async () => {
      try {
        applyAtmosphere();
        await loadAllData();

        addSources();
        addLayers();
        refreshTracts();
        refreshBuildings();
        buildPropertySelectUi();
        buildSearchUi();
        buildIsochroneUi();
        buildIndustryToggleUi();
        buildSelfGuidedUi();
        syncPropertySelectSelection();
        attachInteractions();
        setDefaultPanelState();
        startAnimationLoop();

        STATE.booted = true;

        console.log('CHRONOS READY', {
          tracts: STATE.tracts.length,
          buildings: STATE.buildings.length,
          industry: STATE.selectedIndustryColumn
        });
      } catch (err) {
        console.error(err);
        setText('tmDataset', 'Fault');
        setText('tmSignal', 'Fault');
        setText('miniTerminal', 'Fault');
        setText('narrativeBox', `BOOT FAILURE\n\n${err.message}`);
      }
    });
  }

  boot().catch(console.error);
})();