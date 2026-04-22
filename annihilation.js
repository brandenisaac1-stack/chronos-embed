(() => {
  'use strict';

  if (window.__CHRONOS_ANNIHILATION_RUNNING__) return;
  window.__CHRONOS_ANNIHILATION_RUNNING__ = true;

  const IDS = {
    root: 'annihilationRoot',
    map: 'annihilationMap',
    hud: 'annihilationHud',
    force: 'annForce',
    gravity: 'annGravityScore',
    transit: 'annTransit',
    commute: 'annCommute',
    remote: 'annRemote',
    earnings: 'annEarnings',
    industry1: 'annIndustry1',
    industry2: 'annIndustry2',
    industry3: 'annIndustry3',
    footer: 'annihilationFooter'
  };

  const COLORS = {
    bg: '#03070d',
    bg2: '#07111a',
    bg3: '#0a1722',
    cyan: '#8fd7ea',
    cyan2: '#6ea6c1',
    cyan3: '#c7e7f2',
    amber: '#d8b06a',
    amber2: '#b78a52',
    red: '#c96b63',
    red2: '#a45652',
    white: '#ecfeff',
    text: '#dff9ff',
    soft: '#89a0ab',
    line: '#163041',
    line2: '#0d2230',
    road: '#102333',
    glass: 'rgba(7,16,25,.74)',
    glass2: 'rgba(7,16,25,.90)',
    border: 'rgba(143,215,234,.14)',
    borderStrong: 'rgba(143,215,234,.24)',
    tractIdle: '#243947',
    tractDim: '#314754',
    darkBuildingLow: '#08111a',
    darkBuildingMid: '#0d1720',
    darkBuildingHigh: '#14212b'
  };

  const CONFIG = {
    API_BASE: `${window.location.origin}/api`,

    defaultCenter: [-77.0369, 38.9072],
    baseZoom: 16.2,
    basePitch: 76,
    baseBearing: -24,
    lockZoom: 17.95,
    lockPitch: 79,
    lockBearing: -31,

    camera: {
      orbitAmplitude: 5.8,
      orbitSeconds: 24,
      zoomPulse: 0.045,
      pitchPulse: 0.95
    },

    building: {
      subjectHeightMin: 120,
      subjectHeightMax: 360,
      ambientHeightMin: 10,
      ambientHeightMax: 160,
      footprintMeters: 34,
      ambientFootprintMeters: 24
    },

    isochrone: {
      innerMinutesMin: 4,
      innerMinutesMax: 12,
      outerMinutesMin: 10,
      outerMinutesMax: 28,
      minuteToMeters: 88,
      fillOpacityInner: 0.10,
      fillOpacityOuter: 0.05,
      lineOpacityInner: 0.72,
      lineOpacityOuter: 0.30
    },

    vector: {
      minMeters: 90,
      maxMeters: 320
    },

    fog: {
      range: [0.62, 10.2],
      color: '#061019',
      'high-color': '#122230',
      'space-color': '#01040a',
      'star-intensity': 0.72
    }
  };

  const EXACT_INDUSTRY_COLUMNS = [
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
  ];

  const state = {
    map: null,
    mapReady: false,

    payload: null,
    marker: null,

    tractRows: [],
    tractMap: {},
    buildings: [],
    buildingById: {},
    tractsLoaded: false,
    buildingsLoaded: false,

    selectedIndustryColumn: EXACT_INDUSTRY_COLUMNS[0].value,
    selectedIndustryLabel: EXACT_INDUSTRY_COLUMNS[0].label,

    phase: 0,
    raf: null,
    lastLockedCenter: CONFIG.defaultCenter.slice(),
    lastBearingBase: CONFIG.lockBearing,
    currentSubject: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(v, fallback = '—') {
    const s = String(v ?? '').trim();
    return s || fallback;
  }

  function num(v, fallback = 0) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v ?? '').trim();
    if (!s || s === '#NO MATCH') return fallback;
    const n = Number(s.replace(/[^\d.\-]/g, ''));
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    const el = byId(id);
    if (el) el.innerHTML = value;
  }

  function hasSource(id) {
    try {
      return !!state.map?.getSource(id);
    } catch {
      return false;
    }
  }

  function hasLayer(id) {
    try {
      return !!state.map?.getLayer(id);
    } catch {
      return false;
    }
  }

  function fmtInt(v, fallback = '—') {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return fallback;
    return Math.round(n).toLocaleString();
  }

  function fmtPct(v, fallback = '—') {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return fallback;
    return `${round(n, 1)}%`;
  }

  function fmtMoney(v, fallback = '—') {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return fallback;
    return `$${round(n, 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtSignedMoney(v, fallback = '—') {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return fallback;
    const sign = n >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(round(n, 2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtYearMoney(v, fallback = '—') {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return fallback;
    const sign = n >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
  }

  function distanceKm(lng1, lat1, lng2, lat2) {
    if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return Infinity;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function metersToLngLatOffsets(meters, lat) {
    const latRad = (lat * Math.PI) / 180;
    const degLat = meters / 110574;
    const degLng = meters / Math.max(111320 * Math.cos(latRad), 0.00001);
    return { degLng, degLat };
  }

  function squarePolygon(lon, lat, meters, headingDeg = 0) {
    const { degLng, degLat } = metersToLngLatOffsets(meters, lat);
    const points = [
      [-degLng, -degLat],
      [degLng, -degLat],
      [degLng, degLat],
      [-degLng, degLat],
      [-degLng, -degLat]
    ];

    const theta = (headingDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    return {
      type: 'Polygon',
      coordinates: [[
        ...points.map(([x, y]) => [
          lon + x * cos - y * sin,
          lat + x * sin + y * cos
        ])
      ]]
    };
  }

  function circlePolygon(lon, lat, radiusMeters, steps = 88) {
    const coords = [];
    const latRad = (lat * Math.PI) / 180;
    const degLat = radiusMeters / 110574;
    const degLng = radiusMeters / Math.max(111320 * Math.cos(latRad), 0.00001);

    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      coords.push([lon + Math.cos(t) * degLng, lat + Math.sin(t) * degLat]);
    }

    return { type: 'Polygon', coordinates: [coords] };
  }

  function lineForward(lon, lat, bearingDeg, meters) {
    const theta = (bearingDeg * Math.PI) / 180;
    const dx = Math.sin(theta) * meters;
    const dy = Math.cos(theta) * meters;
    const p0 = [lon, lat];
    const p1 = [
      lon + metersToLngLatOffsets(dx, lat).degLng,
      lat + metersToLngLatOffsets(dy, lat).degLat
    ];
    return {
      type: 'LineString',
      coordinates: [p0, p1]
    };
  }

  function getTract(payload) {
    return payload?.tract || payload?.tract_raw || payload?.command || {};
  }

  function getBuilding(payload) {
    return payload?.building || null;
  }

  function getBuildingConsequence(payload) {
    return payload?.building_consequence || {};
  }

  function getSelectedLocation(payload) {
    return payload?.selected_location || {};
  }

  function getAddressLabel(payload) {
    const selected = getSelectedLocation(payload);
    const building = getBuilding(payload);
    return safeText(
      selected.matched_address ||
      selected.address_label ||
      building?.building_name ||
      building?.Building_Address ||
      selected.place_name ||
      payload?.address ||
      payload?.query ||
      'Strategic field idle'
    );
  }

  function getIndustryConfig(columnValue = state.selectedIndustryColumn) {
    return EXACT_INDUSTRY_COLUMNS.find(x => x.value === columnValue) || EXACT_INDUSTRY_COLUMNS[0];
  }

  function getIndustryColumnValue(row, columnValue = state.selectedIndustryColumn) {
    const config = getIndustryConfig(columnValue);
    const keys = [config.value, config.label, ...(config.aliases || [])];

    for (const key of keys) {
      if (!key) continue;
      const raw = row?.[key];
      if (raw == null || raw === '' || String(raw).trim() === '#NO MATCH') continue;
      const n = num(raw, NaN);
      if (Number.isFinite(n)) return clamp01(n);
    }

    return 0;
  }

  function getTopIndustriesFromPayload(payload) {
    const tract = getTract(payload);

    const ranked = EXACT_INDUSTRY_COLUMNS
      .map(col => ({
        label: col.label,
        value: col.value,
        score01: getIndustryColumnValue(tract, col.value)
      }))
      .sort((a, b) => b.score01 - a.score01)
      .slice(0, 3);

    if (ranked[0]?.score01 > 0) return ranked.map(item => item.label);

    return [
      safeText(tract.top_industry1_label, 'Management / Business / Science / Arts'),
      safeText(tract.top_industry2_label, 'Professional Services'),
      safeText(tract.top_industry3_label, 'Public / Admin')
    ];
  }

  function resolveIndustryFromPayload(payload) {
    const selected =
      safeText(payload?.industry_column || '', '') ||
      safeText(payload?.selected_industry_column || '', '') ||
      safeText(payload?.command?.industry_column || '', '');

    if (!selected) return;

    const config =
      EXACT_INDUSTRY_COLUMNS.find(x => x.value === selected || x.aliases?.includes(selected)) ||
      null;

    if (config) {
      state.selectedIndustryColumn = config.value;
      state.selectedIndustryLabel = config.label;
    }
  }

  function normalizeTract(raw) {
    const geoid = cleanGeoid(raw.geoid || raw.tract_geoid || raw.GEOID);
    const lat = num(raw.lat, NaN);
    const lon = num(raw.lon ?? raw.lng ?? raw.longitude, NaN);
    if (!geoid || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      ...raw,
      geoid,
      tract_geoid: geoid,
      lat,
      lon,
      tract_name: safeText(raw.tract_name || `TRACT ${geoid}`, `TRACT ${geoid}`)
    };
  }

  function normalizeBuilding(raw) {
    const lat = num(raw.lat ?? raw.latitude, NaN);
    const lon = num(raw.lon ?? raw.lng ?? raw.longitude, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const id = safeText(raw.building_id || raw.Building_Address || raw.building_name || `${lat}_${lon}`);
    return {
      ...raw,
      building_id: id,
      building_name: safeText(raw.building_name || raw.Building_Address || raw.address_label || 'Asset'),
      Building_Address: safeText(raw.Building_Address || raw.address_label || ''),
      geoid: cleanGeoid(raw.geoid || raw.tract_geoid || raw.tractid),
      lat,
      lon
    };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    const raw = await res.text();

    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      console.error('Non-JSON response from:', url, raw);
      throw new Error(`Non-JSON response from ${url}`);
    }

    if (!res.ok) {
      console.error('HTTP failure:', url, res.status, data);
      throw new Error(data?.error || `HTTP ${res.status} for ${url}`);
    }

    return data;
  }

  async function loadTracts() {
    if (state.tractsLoaded) return;
    const rows = await fetchJson(`${CONFIG.API_BASE}/tracts`);
    state.tractRows = rows.map(normalizeTract).filter(Boolean);
    state.tractMap = {};
    for (const row of state.tractRows) state.tractMap[row.geoid] = row;
    state.tractsLoaded = true;
  }

  async function loadBuildings() {
    if (state.buildingsLoaded) return;
    const rows = await fetchJson(`${CONFIG.API_BASE}/buildings`);
    state.buildings = rows.map(normalizeBuilding).filter(Boolean);
    state.buildingById = {};
    for (const row of state.buildings) state.buildingById[row.building_id] = row;
    state.buildingsLoaded = true;
  }

  function nearestBuildingTo(lon, lat) {
    let best = null;
    let bestKm = Infinity;
    for (const b of state.buildings) {
      const km = distanceKm(lon, lat, b.lon, b.lat);
      if (km < bestKm) {
        bestKm = km;
        best = b;
      }
    }
    return best;
  }

  function resolveSubjectFromPayload(payload) {
    const building = getBuilding(payload);
    if (building && Number.isFinite(building.lon) && Number.isFinite(building.lat)) {
      return {
        kind: 'building',
        lon: building.lon,
        lat: building.lat,
        label: safeText(building.building_name || building.Building_Address, 'Subject asset'),
        geoid: cleanGeoid(building.geoid || building.tract_geoid),
        sourceBuilding: building
      };
    }

    const selected = getSelectedLocation(payload);
    const lon =
      (Number.isFinite(selected?.lon) ? selected.lon : null) ??
      (Number.isFinite(selected?.lng) ? selected.lng : null) ??
      (Number.isFinite(selected?.longitude) ? selected.longitude : null);
    const lat =
      (Number.isFinite(selected?.lat) ? selected.lat : null) ??
      (Number.isFinite(selected?.latitude) ? selected.latitude : null);

    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      const nearest = state.buildingsLoaded ? nearestBuildingTo(lon, lat) : null;
      if (nearest && distanceKm(lon, lat, nearest.lon, nearest.lat) <= 0.12) {
        return {
          kind: 'building',
          lon: nearest.lon,
          lat: nearest.lat,
          label: safeText(nearest.building_name, 'Subject asset'),
          geoid: cleanGeoid(nearest.geoid),
          sourceBuilding: nearest
        };
      }

      return {
        kind: 'address',
        lon,
        lat,
        label: safeText(selected.address_label || selected.matched_address || selected.place_name, 'Resolved address'),
        geoid: cleanGeoid(selected.geoid || getTract(payload)?.geoid),
        sourceBuilding: null
      };
    }

    const tract = getTract(payload);
    if (Number.isFinite(tract?.lon) && Number.isFinite(tract?.lat)) {
      return {
        kind: 'tract',
        lon: tract.lon,
        lat: tract.lat,
        label: safeText(tract.tract_name || tract.geoid, 'Resolved tract'),
        geoid: cleanGeoid(tract.geoid),
        sourceBuilding: null
      };
    }

    return {
      kind: 'idle',
      lon: CONFIG.defaultCenter[0],
      lat: CONFIG.defaultCenter[1],
      label: 'Strategic field idle',
      geoid: '',
      sourceBuilding: null
    };
  }

  function parseBuildingClearText(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return null;

    const findNum = (re) => {
      const m = raw.match(re);
      if (!m) return NaN;
      return num(m[1], NaN);
    };

    const findText = (re, fallback = '') => {
      const m = raw.match(re);
      return m ? safeText(m[1], fallback) : fallback;
    };

    return {
      heading: findText(/BUILDING:\s*(.+)/i, ''),
      availableStackSf: findNum(/AVAILABLE STACK\s*\(SF\)\s*:\s*([-\d,\.]+)/i),
      captureWindowDays: findNum(/CAPTURE WINDOW\s*\(D\)\s*:\s*([-\d,\.]+)/i),
      takeRatePct: findNum(/TAKE RATE.*?:\s*([-\d,\.]+)%/i),
      expectedClearSf: findNum(/EXPECTED CLEAR\s*\(SF\)\s*:\s*([-\d,\.]+)/i),
      vector: findText(/VECTOR\s*:\s*([^\n\r]+)/i, ''),
      clearImpliedSf: findNum(/CLEAR \$\/SF.*?:\s*\$?([-\d,\.]+)/i),
      directSf: findNum(/DIRECT \$\/SF\s*:\s*\$?([-\d,\.]+)/i),
      rentDelta: findNum(/RENT DELTA.*?:\s*\$?([-\d,\.]+)/i),
      etsVsClear: findNum(/ETS VS CLEAR.*?:\s*\$?([-\d,\.]+)/i),
      clearPressureIndex: findNum(/CLEAR PRESSURE INDEX\s*:\s*([-\d,\.]+)/i),
      interpretation: findText(/INTERPRETATION:\s*([\s\S]*?)(?:EXECUTION BIAS:|$)/i, ''),
      executionBias: findText(/EXECUTION BIAS:\s*([\s\S]*?)$/i, '')
    };
  }

  function getBuildingClearText(payload) {
    const building = getBuilding(payload);
    const bc = getBuildingConsequence(payload);

    const keys = [
      building?.building_clear,
      building?.Building_Clear,
      building?.['Building Clear'],
      building?.clear_text,
      building?.building_clear_text,
      bc?.building_clear,
      bc?.Building_Clear,
      payload?.building_clear
    ];

    for (const item of keys) {
      if (String(item ?? '').trim()) return String(item).trim();
    }

    return '';
  }

  function buildClearModel(payload) {
    const building = getBuilding(payload);
    const bc = getBuildingConsequence(payload);
    const tract = getTract(payload);
    const parsed = parseBuildingClearText(getBuildingClearText(payload));

    const model = {
      buildingName: safeText(
        bc?.building_name ||
        building?.building_name ||
        building?.Building_Address ||
        parsed?.heading ||
        getAddressLabel(payload),
        'Subject asset'
      ),
      doctrineHeading: 'SPACE CLEARANCE — DETERMINISTIC',

      availableStackSf:
        num(building?.available_stack_sf, NaN) ??
        parsed?.availableStackSf,
      captureWindowDays:
        num(bc?.capture_window_days, NaN) ||
        num(building?.capture_window_days, NaN) ||
        parsed?.captureWindowDays,
      takeRatePct:
        num(bc?.take_rate_pct, NaN) ||
        num(building?.take_rate_pct, NaN) ||
        parsed?.takeRatePct,
      expectedClearSf:
        num(building?.expected_clear_sf, NaN) ||
        parsed?.expectedClearSf,
      vector:
        safeText(building?.vector || parsed?.vector || '', ''),
      clearImpliedSf:
        num(bc?.clear_effective_rent, NaN) ||
        num(building?.clear_effective_rent, NaN) ||
        parsed?.clearImpliedSf,
      directSf:
        num(bc?.direct_rent, NaN) ||
        num(building?.direct_rent, NaN) ||
        parsed?.directSf,
      rentDelta:
        num(bc?.rent_delta, NaN) ||
        num(building?.rent_delta, NaN) ||
        parsed?.rentDelta,
      etsVsClear:
        num(bc?.ets_vs_clear, NaN) ||
        num(building?.ets_vs_clear, NaN) ||
        parsed?.etsVsClear,
      clearPressureIndex:
        num(bc?.clear_pressure, NaN) ||
        num(building?.clear_pressure_index, NaN) ||
        num(building?.clear_pressure, NaN) ||
        parsed?.clearPressureIndex,

      interpretation:
        safeText(
          bc?.negotiation_posture ||
          building?.Negotiation_Posture ||
          building?.negotiation_posture ||
          parsed?.interpretation ||
          '',
          ''
        ),
      executionBias:
        safeText(
          building?.execution_bias ||
          bc?.execution_bias ||
          parsed?.executionBias ||
          '',
          ''
        ),

      tractLaborPressure: num(tract?.labor_pressure, NaN),
      tractDominantForce: safeText(tract?.dominant_force || tract?.signal_regime, '')
    };

    const hasDirectValues = [
      model.availableStackSf,
      model.captureWindowDays,
      model.takeRatePct,
      model.clearPressureIndex
    ].some(Number.isFinite);

    if (!hasDirectValues) {
      model.clearPressureIndex = num(tract?.labor_pressure, 0) / 5;
    }

    return model;
  }

  function toneFromPayload(payload) {
    const clear = buildClearModel(payload);
    const clearPressure = num(clear.clearPressureIndex, NaN);
    const labor = num(clear.tractLaborPressure, 0);

    if (Number.isFinite(clearPressure) && clearPressure >= 15) {
      return {
        name: 'RED FIELD',
        color: COLORS.red,
        colorDim: COLORS.red2,
        footer: 'Compressed clear field / act before optionality closes'
      };
    }

    if (
      (Number.isFinite(clearPressure) && clearPressure >= 6) ||
      labor >= 55
    ) {
      return {
        name: 'AMBER FIELD',
        color: COLORS.amber,
        colorDim: COLORS.amber2,
        footer: 'Active clear field / shape, frame, and capture'
      };
    }

    return {
      name: 'CYAN FIELD',
      color: COLORS.cyan,
      colorDim: COLORS.cyan2,
      footer: 'Stable clear field / monitor, price, and preserve leverage'
    };
  }

  function computeGravityWell(payload) {
    const tract = getTract(payload);

    const transit = num(tract.transit_access_score, 0);
    const commute = num(tract.commute_time_advantage_score, 0);
    const remote = num(tract.remote_flex_score, 0);
    const commuteAccess = num(tract.commute_access_score, 0);
    const talent = num(tract.talent_density_tract ?? tract.talent_gravity, 0);
    const earners = num(tract.high_earner_score, 0);
    const earningsPower = num(tract.earnings_power_score, 0);
    const industryLens = getIndustryColumnValue(tract, state.selectedIndustryColumn) * 100;

    const gravity =
      transit * 0.12 +
      commute * 0.15 +
      remote * 0.12 +
      commuteAccess * 0.13 +
      talent * 0.19 +
      earners * 0.08 +
      earningsPower * 0.11 +
      industryLens * 0.10;

    return Math.round(clamp(gravity, 0, 99));
  }

  function computeIsochroneModel(payload) {
    const clear = buildClearModel(payload);
    const takeRate = clamp(num(clear.takeRatePct, 0), 0, 100);
    const windowDays = clamp(num(clear.captureWindowDays, 45), 10, 120);
    const pressure = clamp(num(clear.clearPressureIndex, 0), 0, 25);
    const commute = clamp(num(getTract(payload)?.commute_time_advantage_score, 0), 0, 100);
    const transit = clamp(num(getTract(payload)?.transit_access_score, 0), 0, 100);
    const gravity = computeGravityWell(payload);

    const urgency01 =
      clamp01((25 - Math.min(windowDays, 25)) / 25) * 0.28 +
      clamp01(takeRate / 40) * 0.28 +
      clamp01(pressure / 20) * 0.24 +
      clamp01(gravity / 100) * 0.12 +
      clamp01((commute + transit) / 200) * 0.08;

    const innerMinutes = clamp(
      Math.round(CONFIG.isochrone.innerMinutesMax - urgency01 * 5),
      CONFIG.isochrone.innerMinutesMin,
      CONFIG.isochrone.innerMinutesMax
    );

    const outerMinutes = clamp(
      Math.round(CONFIG.isochrone.outerMinutesMax - urgency01 * 8 + commute * 0.02),
      CONFIG.isochrone.outerMinutesMin,
      CONFIG.isochrone.outerMinutesMax
    );

    const innerMeters = innerMinutes * CONFIG.isochrone.minuteToMeters;
    const outerMeters = outerMinutes * CONFIG.isochrone.minuteToMeters;

    const pulseFast = 0.9 + clamp01(takeRate / 35) * 1.3 + clamp01(pressure / 15) * 0.9;
    const pulseSlow = 0.45 + clamp01((100 - windowDays) / 100) * 0.8;

    return {
      urgency01,
      innerMinutes,
      outerMinutes,
      innerMeters,
      outerMeters,
      pulseFast,
      pulseSlow
    };
  }

  function computeVectorMeters(payload) {
    const clear = buildClearModel(payload);
    const expectedClear = clamp(num(clear.expectedClearSf, 0), 0, 50000);
    const rentDelta = Math.abs(num(clear.rentDelta, 0));
    const takeRate = clamp(num(clear.takeRatePct, 0), 0, 100);

    const score01 =
      clamp01(expectedClear / 20000) * 0.55 +
      clamp01(rentDelta / 10) * 0.20 +
      clamp01(takeRate / 35) * 0.25;

    return Math.round(
      CONFIG.vector.minMeters +
      (CONFIG.vector.maxMeters - CONFIG.vector.minMeters) * score01
    );
  }

  function subjectHeadingFromPayload(payload) {
    const tone = toneFromPayload(payload);
    const clear = buildClearModel(payload);

    if (tone.name === 'RED FIELD') {
      return 'CLEAR FIELD COMPRESSING / EXECUTE OR FORFEIT';
    }
    if (tone.name === 'AMBER FIELD') {
      return 'CLEAR BURDEN ACTIVE / STRUCTURE AND TIMING MATTER';
    }
    if (num(clear.clearPressureIndex, 0) > 0) {
      return 'CLEAR BURDEN EASING / PROTECT RATE AND SHAPE OPTIONALITY';
    }
    return 'STABLE FIELD / MONITOR PRESSURE AND SHAPE OPTIONALITY';
  }

  function subjectSubheadFromPayload(payload) {
    const clear = buildClearModel(payload);
    const windowDays = num(clear.captureWindowDays, NaN);
    const takeRate = num(clear.takeRatePct, NaN);
    const rentDelta = num(clear.rentDelta, NaN);

    if (Number.isFinite(windowDays) && Number.isFinite(takeRate)) {
      const vector = Number.isFinite(rentDelta)
        ? ` | delta ${rentDelta >= 0 ? '+' : ''}${round(rentDelta, 2)}`
        : '';
      return `${Math.round(windowDays)} day window | ${round(takeRate, 1)}% clear velocity${vector}`;
    }

    return safeText(clear.tractDominantForce, 'Awaiting building clear resolution');
  }

  function buildFieldDoctrine(payload) {
    const clear = buildClearModel(payload);
    const pressure = num(clear.clearPressureIndex, NaN);
    const windowDays = num(clear.captureWindowDays, NaN);
    const takeRate = num(clear.takeRatePct, NaN);
    const clearRent = num(clear.clearImpliedSf, NaN);
    const directRent = num(clear.directSf, NaN);

    if (safeText(clear.interpretation, '') !== '') {
      return clear.interpretation;
    }

    const line1 = Number.isFinite(pressure)
      ? pressure >= 15
        ? 'Clear pressure is acute and cannot be watched passively.'
        : pressure >= 6
          ? 'Clear pressure is active and tradable.'
          : 'Clear pressure is present but controlled.'
      : 'Clear pressure not fully resolved.';

    const line2 = Number.isFinite(windowDays)
      ? windowDays <= 21
        ? 'Execution window is tight.'
        : windowDays <= 45
          ? 'Execution window is actionable.'
          : 'Execution window remains open.'
      : 'Execution window unresolved.';

    const line3 = Number.isFinite(takeRate)
      ? takeRate >= 25
        ? 'Velocity is confirming.'
        : takeRate >= 12
          ? 'Velocity is building.'
          : 'Velocity must confirm.'
      : 'Velocity unresolved.';

    const line4 =
      Number.isFinite(clearRent) && Number.isFinite(directRent)
        ? `Implied clear ${fmtMoney(clearRent)} vs direct ${fmtMoney(directRent)}.`
        : '';

    return [line1, line2, line3, line4].filter(Boolean).join(' ');
  }

  function buildExecutionBias(payload) {
    const clear = buildClearModel(payload);
    const pressure = num(clear.clearPressureIndex, NaN);
    const takeRate = num(clear.takeRatePct, NaN);
    const windowDays = num(clear.captureWindowDays, NaN);

    if (safeText(clear.executionBias, '') !== '') {
      return clear.executionBias;
    }

    if (Number.isFinite(pressure) && pressure >= 15 && Number.isFinite(takeRate) && takeRate >= 20) {
      return 'Exploit optionality now. Keep rate integrity.';
    }

    if (Number.isFinite(windowDays) && windowDays <= 21) {
      return 'Convert now. Delay compounds carry and narrative drift.';
    }

    if (Number.isFinite(pressure) && pressure >= 6) {
      return 'Protect rate. Trade structure and timing, not headline price.';
    }

    return 'Maintain optionality and shape the field before forcing terms.';
  }

  function makeAmbientTractGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: state.tractRows.map(r => ({
        type: 'Feature',
        properties: {
          geoid: r.geoid,
          tract_name: r.tract_name,
          labor_pressure: num(r.labor_pressure, 0),
          opportunity_score: num(r.opportunity_score, 0)
        },
        geometry: {
          type: 'Point',
          coordinates: [r.lon, r.lat]
        }
      }))
    };
  }

  function makeSceneGeoJSON(payload) {
    const subject = resolveSubjectFromPayload(payload);
    state.currentSubject = subject;

    const tone = toneFromPayload(payload);
    const tract = getTract(payload);
    const clear = buildClearModel(payload);
    const iso = computeIsochroneModel(payload);

    const laborScore01 = clamp01(num(tract?.labor_pressure, 0) / 100);
    const clearScore01 = clamp01(num(clear.clearPressureIndex, 0) / 20);
    const gravityScore01 = clamp01(computeGravityWell(payload) / 100);

    const subjectHeight = Math.round(
      CONFIG.building.subjectHeightMin +
      (CONFIG.building.subjectHeightMax - CONFIG.building.subjectHeightMin) *
        clamp01(laborScore01 * 0.35 + clearScore01 * 0.40 + gravityScore01 * 0.25)
    );

    const bearing = state.lastBearingBase;
    const footprint = squarePolygon(subject.lon, subject.lat, CONFIG.building.footprintMeters, bearing);
    const innerRing = circlePolygon(subject.lon, subject.lat, iso.innerMeters);
    const outerRing = circlePolygon(subject.lon, subject.lat, iso.outerMeters);
    const vectorMeters = computeVectorMeters(payload);
    const forward = lineForward(subject.lon, subject.lat, bearing, vectorMeters);

    const features = [
      {
        type: 'Feature',
        properties: {
          kind: 'subject-footprint',
          height: subjectHeight,
          base: 0,
          color: tone.color,
          opacity: 0.82
        },
        geometry: footprint
      },
      {
        type: 'Feature',
        properties: {
          kind: 'iso-fill-outer',
          fill: tone.color,
          opacity: CONFIG.isochrone.fillOpacityOuter
        },
        geometry: outerRing
      },
      {
        type: 'Feature',
        properties: {
          kind: 'iso-fill-inner',
          fill: tone.color,
          opacity: CONFIG.isochrone.fillOpacityInner
        },
        geometry: innerRing
      },
      {
        type: 'Feature',
        properties: {
          kind: 'iso-line-outer',
          stroke: tone.color,
          opacity: CONFIG.isochrone.lineOpacityOuter,
          width: 1.15
        },
        geometry: outerRing
      },
      {
        type: 'Feature',
        properties: {
          kind: 'iso-line-inner',
          stroke: tone.color,
          opacity: CONFIG.isochrone.lineOpacityInner,
          width: 2.15
        },
        geometry: innerRing
      },
      {
        type: 'Feature',
        properties: {
          kind: 'forward-vector',
          stroke: tone.color,
          opacity: 0.58,
          width: 1.8
        },
        geometry: forward
      },
      {
        type: 'Feature',
        properties: {
          kind: 'subject-core',
          pulse: tone.color
        },
        geometry: {
          type: 'Point',
          coordinates: [subject.lon, subject.lat]
        }
      }
    ];

    return { type: 'FeatureCollection', features };
  }

  function makeNearbyBuildingsGeoJSON(payload) {
    const subject = resolveSubjectFromPayload(payload);
    const tone = toneFromPayload(payload);

    const nearby = state.buildingsLoaded
      ? state.buildings
          .map(b => ({
            ...b,
            distanceKm: distanceKm(subject.lon, subject.lat, b.lon, b.lat)
          }))
          .filter(b => b.distanceKm <= 0.55)
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 20)
      : [];

    const features = nearby.map((b, idx) => {
      const prominence = clamp01(1 - b.distanceKm / 0.55);
      const height = Math.round(
        CONFIG.building.ambientHeightMin +
        (CONFIG.building.ambientHeightMax - CONFIG.building.ambientHeightMin) * prominence * 0.78
      );

      return {
        type: 'Feature',
        properties: {
          kind: 'ambient',
          building_id: b.building_id,
          label: b.building_name,
          height,
          base: 0,
          color: idx === 0 && subject.kind !== 'building' ? tone.colorDim : COLORS.darkBuildingMid,
          opacity: idx === 0 && subject.kind !== 'building' ? 0.30 : 0.16
        },
        geometry: squarePolygon(
          b.lon,
          b.lat,
          CONFIG.building.ambientFootprintMeters * (0.78 + prominence * 0.42),
          -14
        )
      };
    });

    return { type: 'FeatureCollection', features };
  }

  function ensureMapSources() {
    if (!hasSource('ann-tracts')) {
      state.map.addSource('ann-tracts', {
        type: 'geojson',
        data: makeAmbientTractGeoJSON()
      });
    }

    if (!hasSource('ann-scene')) {
      state.map.addSource('ann-scene', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!hasSource('ann-nearby')) {
      state.map.addSource('ann-nearby', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
  }

  function ensureMapLayers() {
    if (!hasLayer('ann-mapbox-3d')) {
      state.map.addLayer({
        id: 'ann-mapbox-3d',
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
            0, COLORS.darkBuildingLow,
            90, COLORS.darkBuildingMid,
            220, COLORS.darkBuildingHigh
          ],
          'fill-extrusion-opacity': 0.42,
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-vertical-gradient': true
        }
      });
    }

    if (!hasLayer('ann-road-glow')) {
      state.map.addLayer({
        id: 'ann-road-glow',
        type: 'line',
        source: 'composite',
        'source-layer': 'road',
        paint: {
          'line-color': COLORS.road,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12, 0.25,
            18, 1.6
          ],
          'line-opacity': 0.22
        }
      });
    }

    if (!hasLayer('ann-tract-aura')) {
      state.map.addLayer({
        id: 'ann-tract-aura',
        type: 'circle',
        source: 'ann-tracts',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'labor_pressure'],
            0, 6,
            45, 10,
            75, 16,
            95, 20
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'labor_pressure'],
            0, COLORS.tractIdle,
            45, COLORS.cyan2,
            65, COLORS.amber2,
            85, COLORS.red2
          ],
          'circle-opacity': 0.10,
          'circle-blur': 1.1
        }
      });
    }

    if (!hasLayer('ann-tract-core')) {
      state.map.addLayer({
        id: 'ann-tract-core',
        type: 'circle',
        source: 'ann-tracts',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'labor_pressure'],
            0, 1.4,
            45, 2.3,
            75, 3.4,
            95, 4.4
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'labor_pressure'],
            0, COLORS.tractDim,
            45, COLORS.cyan,
            65, COLORS.amber,
            85, COLORS.red
          ],
          'circle-opacity': 0.54,
          'circle-stroke-width': 0.45,
          'circle-stroke-color': COLORS.white,
          'circle-stroke-opacity': 0.10
        }
      });
    }

    if (!hasLayer('ann-nearby-fill')) {
      state.map.addLayer({
        id: 'ann-nearby-fill',
        type: 'fill-extrusion',
        source: 'ann-nearby',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-opacity': ['get', 'opacity'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base']
        }
      });
    }

    if (!hasLayer('ann-iso-fill-outer')) {
      state.map.addLayer({
        id: 'ann-iso-fill-outer',
        type: 'fill',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'iso-fill-outer'],
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': ['get', 'opacity']
        }
      });
    }

    if (!hasLayer('ann-iso-fill-inner')) {
      state.map.addLayer({
        id: 'ann-iso-fill-inner',
        type: 'fill',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'iso-fill-inner'],
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': ['get', 'opacity']
        }
      });
    }

    if (!hasLayer('ann-iso-line-outer')) {
      state.map.addLayer({
        id: 'ann-iso-line-outer',
        type: 'line',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'iso-line-outer'],
        paint: {
          'line-color': ['get', 'stroke'],
          'line-opacity': ['get', 'opacity'],
          'line-width': ['get', 'width'],
          'line-blur': 0.15
        }
      });
    }

    if (!hasLayer('ann-iso-line-inner')) {
      state.map.addLayer({
        id: 'ann-iso-line-inner',
        type: 'line',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'iso-line-inner'],
        paint: {
          'line-color': ['get', 'stroke'],
          'line-opacity': ['get', 'opacity'],
          'line-width': ['get', 'width']
        }
      });
    }

    if (!hasLayer('ann-forward-vector')) {
      state.map.addLayer({
        id: 'ann-forward-vector',
        type: 'line',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'forward-vector'],
        paint: {
          'line-color': ['get', 'stroke'],
          'line-opacity': ['get', 'opacity'],
          'line-width': ['get', 'width'],
          'line-dasharray': [1.2, 1.3]
        }
      });
    }

    if (!hasLayer('ann-subject-fill')) {
      state.map.addLayer({
        id: 'ann-subject-fill',
        type: 'fill-extrusion',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'subject-footprint'],
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-opacity': ['get', 'opacity'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base']
        }
      });
    }

    if (!hasLayer('ann-subject-core')) {
      state.map.addLayer({
        id: 'ann-subject-core',
        type: 'circle',
        source: 'ann-scene',
        filter: ['==', ['get', 'kind'], 'subject-core'],
        paint: {
          'circle-radius': 3.2,
          'circle-color': ['get', 'pulse'],
          'circle-opacity': 0.96,
          'circle-stroke-color': COLORS.white,
          'circle-stroke-width': 0.6,
          'circle-stroke-opacity': 0.4,
          'circle-blur': 0.08
        }
      });
    }
  }

  function applyMapAtmosphere() {
    try {
      state.map.setFog(CONFIG.fog);
    } catch {}

    try {
      state.map.setLight({
        anchor: 'viewport',
        color: '#e1b988',
        intensity: 0.18,
        position: [1.15, 160, 76]
      });
    } catch {}

    try {
      const style = state.map.getStyle();
      const layers = style?.layers || [];

      layers.forEach(layer => {
        const id = layer.id || '';

        if (layer.type === 'symbol') {
          try { state.map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
        }

        if (layer.type === 'line' && id.includes('road')) {
          try { state.map.setPaintProperty(id, 'line-opacity', 0.08); } catch {}
        }

        if (layer.type === 'fill') {
          try { state.map.setPaintProperty(id, 'fill-opacity', 0.12); } catch {}
        }
      });
    } catch {}
  }

  function updateMapData(payload) {
    if (!state.mapReady) return;

    if (hasSource('ann-tracts')) {
      state.map.getSource('ann-tracts').setData(makeAmbientTractGeoJSON());
    }

    if (hasSource('ann-scene')) {
      state.map.getSource('ann-scene').setData(makeSceneGeoJSON(payload));
    }

    if (hasSource('ann-nearby')) {
      state.map.getSource('ann-nearby').setData(makeNearbyBuildingsGeoJSON(payload));
    }
  }

  function createMarkerEl() {
    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '999px';
    el.style.border = '1px solid rgba(255,255,255,.62)';
    el.style.background = 'rgba(255,255,255,.14)';
    el.style.boxShadow = `0 0 28px ${COLORS.cyan}55`;
    return el;
  }

  function updateMarker(payload) {
    if (!state.mapReady) return;

    const subject = resolveSubjectFromPayload(payload);
    const tone = toneFromPayload(payload);

    if (!state.marker) {
      state.marker = new mapboxgl.Marker({
        element: createMarkerEl(),
        anchor: 'center'
      })
        .setLngLat([subject.lon, subject.lat])
        .addTo(state.map);
    } else {
      state.marker.setLngLat([subject.lon, subject.lat]);
    }

    const el = state.marker.getElement();
    el.style.boxShadow = `0 0 28px ${tone.color}66`;
    el.style.background = `${tone.color}26`;
  }

  function updateCameraImmediate(payload, duration = 950) {
    if (!state.mapReady) return;

    const subject = resolveSubjectFromPayload(payload);
    state.lastLockedCenter = [subject.lon, subject.lat];
    state.lastBearingBase = CONFIG.lockBearing;

    state.map.easeTo({
      center: state.lastLockedCenter,
      zoom: CONFIG.lockZoom,
      pitch: CONFIG.lockPitch,
      bearing: state.lastBearingBase,
      duration,
      essential: true
    });
  }

  function tickCamera() {
    if (!state.mapReady || !state.payload) return;

    const t = state.phase;
    const bearing =
      state.lastBearingBase +
      Math.sin((t / CONFIG.camera.orbitSeconds) * Math.PI * 2) * CONFIG.camera.orbitAmplitude;
    const zoom =
      CONFIG.lockZoom +
      Math.sin((t / (CONFIG.camera.orbitSeconds * 0.46)) * Math.PI * 2) * CONFIG.camera.zoomPulse;
    const pitch =
      CONFIG.lockPitch +
      Math.sin((t / (CONFIG.camera.orbitSeconds * 0.62)) * Math.PI * 2) * CONFIG.camera.pitchPulse;

    try {
      state.map.jumpTo({
        center: state.lastLockedCenter,
        bearing,
        zoom,
        pitch
      });
    } catch {}
  }

  function ensureHudScaffold() {
    const hud = byId(IDS.hud);
    if (!hud) return;

    if (byId('annSubjectHeader')) return;

    const block = document.createElement('div');
    block.id = 'annSubjectHeader';
    block.className = 'annBlock';
    block.style.marginTop = '10px';
    block.style.padding = '12px';
    block.style.border = `1px solid ${COLORS.border}`;
    block.style.borderRadius = '14px';
    block.style.background = COLORS.glass2;
    block.style.backdropFilter = 'blur(14px)';

    block.innerHTML = `
      <div id="annClearTitle" style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.cyan3};margin-bottom:10px;"></div>

      <div id="annClearDoctrineHeading" style="font-size:13px;font-weight:900;letter-spacing:.04em;color:${COLORS.amber};margin-bottom:8px;"></div>

      <div style="height:1px;background:${COLORS.borderStrong};margin:8px 0 12px 0;"></div>

      <div id="annClearStats" style="font-size:12px;line-height:1.55;color:${COLORS.text};white-space:pre-line;margin-bottom:14px;"></div>

      <div style="height:1px;background:${COLORS.border};margin:8px 0 12px 0;"></div>

      <div id="annFieldDoctrineLabel" style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${COLORS.cyan3};margin-bottom:6px;">Field Doctrine</div>
      <div id="annFieldDoctrine" style="font-size:12px;line-height:1.5;color:${COLORS.text};margin-bottom:14px;"></div>

      <div id="annExecutionBiasLabel" style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${COLORS.red};margin-bottom:6px;">Execution Bias</div>
      <div id="annExecutionBias" style="font-size:12px;line-height:1.5;color:${COLORS.text};"></div>
    `;

    hud.appendChild(block);
  }

  function renderHud(payload) {
    resolveIndustryFromPayload(payload);
    ensureHudScaffold();

    const tract = getTract(payload);
    const industries = getTopIndustriesFromPayload(payload);
    const gravity = computeGravityWell(payload);
    const tone = toneFromPayload(payload);
    const clear = buildClearModel(payload);
    const iso = computeIsochroneModel(payload);

    const transit = num(tract.transit_access_score, 0);
    const commute = num(tract.commute_time_advantage_score, 0);
    const remote = num(tract.remote_flex_score, 0);
    const earnings = num(tract.earnings_power_score, 0);

    setText(IDS.force, subjectHeadingFromPayload(payload));
    setText(IDS.gravity, String(gravity));
    setText(IDS.transit, transit ? String(Math.round(transit)) : '--');
    setText(IDS.commute, commute ? String(Math.round(commute)) : '--');
    setText(IDS.remote, remote ? String(Math.round(remote)) : '--');
    setText(IDS.earnings, earnings ? String(Math.round(earnings)) : '--');
    setText(IDS.industry1, industries[0] || '--');
    setText(IDS.industry2, industries[1] || '--');
    setText(IDS.industry3, industries[2] || '--');

    const footer = [
      tone.footer,
      state.selectedIndustryLabel,
      getAddressLabel(payload)
    ].filter(Boolean).join(' • ');
    setText(IDS.footer, footer);

    const gravityEl = byId(IDS.gravity);
    if (gravityEl) {
      gravityEl.style.color = tone.color;
      gravityEl.style.textShadow = `0 0 22px ${tone.color}44`;
    }

    const i1 = byId(IDS.industry1);
    const i2 = byId(IDS.industry2);
    const i3 = byId(IDS.industry3);
    if (i1) i1.style.color = COLORS.amber;
    if (i2) i2.style.color = COLORS.cyan;
    if (i3) i3.style.color = tone.color;

    const root = byId(IDS.root);
    if (root) {
      root.style.background = `
        radial-gradient(circle at 50% 14%, ${tone.color}14 0%, transparent 42%),
        linear-gradient(180deg, rgba(7,12,20,.10) 0%, rgba(1,4,8,.68) 60%, rgba(1,4,8,.94) 100%)
      `;
    }

    setText('annClearTitle', `BUILDING CLEAR : ${clear.buildingName}`);
    setText('annClearDoctrineHeading', clear.doctrineHeading);

    setText(
      'annClearStats',
      [
        `AVAILABLE STACK (SF): ${fmtInt(clear.availableStackSf)}`,
        `CAPTURE WINDOW (D): ${fmtInt(clear.captureWindowDays)}`,
        `TAKE RATE (CLEAR VELOCITY): ${fmtPct(clear.takeRatePct)}`,
        `EXPECTED CLEAR (SF): ${fmtInt(clear.expectedClearSf)}${safeText(clear.vector, '') !== '' ? ` | VECTOR: ${clear.vector}` : ''}`,
        '',
        `CLEAR $/SF (IMPLIED EFFECTIVE): ${fmtMoney(clear.clearImpliedSf)}`,
        `DIRECT $/SF: ${fmtMoney(clear.directSf)}`,
        `RENT DELTA (IMPLIED - DIRECT): ${fmtSignedMoney(clear.rentDelta)}`,
        `ETS VS CLEAR ($/YR): ${fmtYearMoney(clear.etsVsClear)}`,
        `CLEAR PRESSURE INDEX: ${Number.isFinite(num(clear.clearPressureIndex, NaN)) ? round(clear.clearPressureIndex, 2) : '—'}`,
        '',
        `ISOCHRONE RING: ${iso.innerMinutes} / ${iso.outerMinutes} MIN`,
        `FIELD TONE: ${tone.name}`
      ].join('\n')
    );

    setText('annFieldDoctrine', buildFieldDoctrine(payload));
    setText('annExecutionBias', buildExecutionBias(payload));

    const forceEl = byId(IDS.force);
    if (forceEl) {
      forceEl.style.color = COLORS.white;
      forceEl.style.textShadow = `0 0 16px ${tone.color}22`;
    }
  }

  function render(payload = {}) {
    state.payload = payload;
    renderHud(payload);
    updateMapData(payload);
    updateMarker(payload);

    if (state.mapReady) {
      updateCameraImmediate(payload, 950);
    }
  }

  function bootFallback() {
    render({
      tract: {
        dominant_force: 'Awaiting Resolve',
        signal_regime: 'Awaiting Resolve',
        top_industry1_label: '--',
        top_industry2_label: '--',
        top_industry3_label: '--'
      }
    });
  }

  function ensureMap() {
    if (state.map) return state.map;
    if (!window.mapboxgl) return null;

    const container = byId(IDS.map);
    if (!container) return null;

    state.map = new mapboxgl.Map({
      container: IDS.map,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CONFIG.defaultCenter,
      zoom: CONFIG.baseZoom,
      pitch: CONFIG.basePitch,
      bearing: CONFIG.baseBearing,
      interactive: false,
      attributionControl: false,
      antialias: true
    });

    state.map.on('load', async () => {
      try {
        await Promise.all([loadTracts(), loadBuildings()]);
      } catch (err) {
        console.warn('annihilation preload failed', err);
      }

      state.mapReady = true;
      applyMapAtmosphere();
      ensureMapSources();
      ensureMapLayers();

      if (state.payload) {
        updateMapData(state.payload);
        updateMarker(state.payload);
        updateCameraImmediate(state.payload, 10);
      } else {
        bootFallback();
      }

      startAnimationLoop();
    });

    return state.map;
  }

  function startAnimationLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);

    const frame = () => {
      state.phase += 0.016;
      tickCamera();

      if (state.mapReady && state.payload) {
        const tone = toneFromPayload(state.payload);
        const iso = computeIsochroneModel(state.payload);

        if (hasLayer('ann-iso-line-inner')) {
          const pulse = CONFIG.isochrone.lineOpacityInner - 0.14 + 0.14 * ((Math.sin(state.phase * iso.pulseFast) + 1) / 2);
          try { state.map.setPaintProperty('ann-iso-line-inner', 'line-opacity', pulse); } catch {}
        }

        if (hasLayer('ann-iso-line-outer')) {
          const pulse = CONFIG.isochrone.lineOpacityOuter - 0.10 + 0.10 * ((Math.sin(state.phase * iso.pulseSlow) + 1) / 2);
          try { state.map.setPaintProperty('ann-iso-line-outer', 'line-opacity', pulse); } catch {}
        }

        if (hasLayer('ann-iso-fill-inner')) {
          const pulse = CONFIG.isochrone.fillOpacityInner - 0.03 + 0.03 * ((Math.sin(state.phase * iso.pulseFast) + 1) / 2);
          try { state.map.setPaintProperty('ann-iso-fill-inner', 'fill-opacity', pulse); } catch {}
        }

        if (hasLayer('ann-iso-fill-outer')) {
          const pulse = CONFIG.isochrone.fillOpacityOuter - 0.02 + 0.02 * ((Math.sin(state.phase * iso.pulseSlow) + 1) / 2);
          try { state.map.setPaintProperty('ann-iso-fill-outer', 'fill-opacity', pulse); } catch {}
        }

        if (hasLayer('ann-subject-core')) {
          const pulse = 3.0 + 1.5 * ((Math.sin(state.phase * iso.pulseFast * 1.25) + 1) / 2);
          try {
            state.map.setPaintProperty('ann-subject-core', 'circle-radius', pulse);
            state.map.setPaintProperty('ann-subject-core', 'circle-color', tone.color);
          } catch {}
        }

        if (state.marker) {
          const glow = 24 + 10 * ((Math.sin(state.phase * iso.pulseFast) + 1) / 2);
          const el = state.marker.getElement();
          el.style.boxShadow = `0 0 ${glow}px ${tone.color}66`;
          el.style.background = `${tone.color}26`;
        }
      }

      state.raf = requestAnimationFrame(frame);
    };

    state.raf = requestAnimationFrame(frame);
  }

  function init() {
    if (!byId(IDS.root) || !byId(IDS.map) || !byId(IDS.hud)) return;

    ensureHudScaffold();
    ensureMap();
    bootFallback();

    window.addEventListener('chronos:annihilation-target', evt => {
      render(evt.detail || {});
    });

    window.addEventListener('chronos:tract-bar-update', evt => {
      const payload = evt.detail || {};
      if (
        payload?.industry_column ||
        payload?.selected_industry_column ||
        payload?.command?.industry_column
      ) {
        resolveIndustryFromPayload(payload);
        if (state.payload) render(state.payload);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();