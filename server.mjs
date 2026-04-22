import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = __dirname;
const PORT = Number(process.env.PORT || 3000);

const CFG = {
  SMARTSHEET_TOKEN:
    process.env.SMARTSHEET_TOKEN ||
    process.env.SMARTSHEET_API_KEY ||
    '',

  // ONE-SHEET CANONICAL SOURCE GOING FORWARD
  SMARTSHEET_SHEET_ID:
    process.env.SMARTSHEET_SHEET_ID ||
    '8254624780734340',

  SMARTSHEET_TIMEOUT_MS: Number(process.env.SMARTSHEET_TIMEOUT_MS || 20000),
  CACHE_MS: Number(process.env.CACHE_MS || 30000),

  MAPBOX_TOKEN:
    process.env.MAPBOX_ACCESS_TOKEN ||
    '',

  MAPBOX_LIMIT: Number(process.env.MAPBOX_GEOCODE_LIMIT || 6),
  LOCAL_SEARCH_LIMIT: Number(process.env.LOCAL_SEARCH_LIMIT || 8),
  FUSION_MATCH_RADIUS_KM: Number(process.env.FUSION_MATCH_RADIUS_KM || 0.35),
  NEARBY_RADIUS_KM: Number(process.env.NEARBY_RADIUS_KM || 2.5),
  RELATIVE_TRACT_COUNT: Number(process.env.RELATIVE_TRACT_COUNT || 3)
};

if (!safe(CFG.SMARTSHEET_TOKEN)) {
  throw new Error('Missing SMARTSHEET_TOKEN environment variable.');
}

const CACHE = new Map();

function getCache(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) {
    CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function setCache(key, value, ttlMs = CFG.CACHE_MS) {
  CACHE.set(key, { value, expiry: Date.now() + ttlMs });
}

function clearCache() {
  CACHE.clear();
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");
}

function json(res, code, payload) {
  setCors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function text(res, code, body, contentType = 'text/plain; charset=utf-8') {
  setCors(res);
  res.writeHead(code, { 'Content-Type': contentType });
  res.end(body);
}

function safe(v) {
  return String(v ?? '').trim();
}

function lower(v) {
  return safe(v).toLowerCase();
}

function compactSpaces(v) {
  return safe(v).replace(/\s+/g, ' ').trim();
}

function num(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  const s = String(v)
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .replace(/%/g, '')
    .replace(/[–—]/g, '-')
    .trim();

  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function maybeNum(v) {
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v) {
  return clamp(num(v, 0), 0, 1);
}

function round(v, digits = 4) {
  if (!Number.isFinite(v)) return 0;
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

function cleanGeoid(v) {
  const digits = String(v ?? '').replace(/[^\d]/g, '');
  return digits ? digits.padStart(11, '0').slice(-11) : '';
}

function normalizeKey(v) {
  return lower(v).replace(/[\s_\-/.()%:#&]+/g, '');
}

function pickNormalized(row, candidates, fallback = '') {
  const map = new Map();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeKey(k), v);
  }
  for (const key of candidates) {
    const nk = normalizeKey(key);
    if (map.has(nk)) return map.get(nk);
  }
  return fallback;
}

function firstText(row, keys, fallback = '') {
  for (const key of keys) {
    const v = row[key];
    if (safe(v)) return compactSpaces(v);
  }
  return fallback;
}

function firstMaybeNumber(row, keys, fallback = null) {
  for (const key of keys) {
    const n = maybeNum(row[key]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function slugify(v) {
  return lower(v)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function normalizeAddressText(v) {
  return lower(v)
    .replace(/[.,]/g, ' ')
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(boulevard)\b/g, 'blvd')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(place)\b/g, 'pl')
    .replace(/\b(square)\b/g, 'sq')
    .replace(/\b(suite)\b/g, 'ste')
    .replace(/\bnorthwest\b/g, 'nw')
    .replace(/\bnortheast\b/g, 'ne')
    .replace(/\bsouthwest\b/g, 'sw')
    .replace(/\bsoutheast\b/g, 'se')
    .replace(/\s+/g, ' ')
    .trim();
}

function percentFrom01(v) {
  return round(clamp01(v) * 100, 2);
}

function distanceKm(lng1, lat1, lng2, lat2) {
  if (
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng2) ||
    !Number.isFinite(lat2)
  ) {
    return Infinity;
  }

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function average(values) {
  const valid = values.filter(v => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function parseBuildingClear(clearText = '') {
  const txt = safe(clearText);
  if (!txt) {
    return {
      clear_pressure_index: 0,
      take_rate_pct: 0,
      capture_window_days: 45,
      available_stack_sf: 0,
      expected_clear_sf: 0,
      clear_effective_rent: 0,
      direct_rent: 0,
      rent_delta: 0,
      ets_vs_clear: 0,
      interpretation: '',
      execution_bias: '',
      vector: '',
      building_posture_score: 0
    };
  }

  const extract = (regex) => {
    const match = txt.match(regex);
    return match ? num(match[1], 0) : 0;
  };

  const vectorMatch = txt.match(/VECTOR:\s*([^\n\r]+)/i);
  const interpretationMatch = txt.match(/INTERPRETATION:\s*([^\n\r]+)/i);
  const biasMatch = txt.match(/EXECUTION BIAS:\s*([^\n\r]+)/i);

  const clear_pressure_index = extract(/CLEAR PRESSURE INDEX:\s*([-\d.,]+)/i);
  const take_rate_pct = extract(/TAKE RATE.*?:\s*([-\d.,]+)%/i);
  const capture_window_days = extract(/CAPTURE WINDOW \(D\):\s*([-\d.,]+)/i) || 45;
  const available_stack_sf = extract(/AVAILABLE STACK \(SF\):\s*([-\d.,]+)/i);
  const expected_clear_sf = extract(/EXPECTED CLEAR \(SF\):\s*([-\d.,]+)/i);
  const clear_effective_rent = extract(/CLEAR \$\/SF .*?:\s*\$([-\d.,]+)/i);
  const direct_rent = extract(/DIRECT \$\/SF:\s*\$([-\d.,]+)/i);
  const rent_delta = extract(/RENT DELTA .*?:\s*\$([-\d.,]+)/i);
  const ets_vs_clear = extract(/ETS VS CLEAR.*?:\s*\$([-\d.,]+)/i);

  const pressure01 = clamp01(clear_pressure_index / 20);
  const takeRate01 = clamp01(take_rate_pct / 40);
  const windowCompression01 = clamp01((90 - clamp(capture_window_days, 0, 90)) / 90);
  const rentDelta01 = clamp01(Math.abs(rent_delta) / 15);

  const building_posture_score = round(
    clamp(
      pressure01 * 44 +
        takeRate01 * 22 +
        windowCompression01 * 18 +
        rentDelta01 * 10 +
        (safe(vectorMatch?.[1]).includes('↗') ? 6 : 0),
      0,
      100
    ),
    2
  );

  return {
    clear_pressure_index: round(clear_pressure_index, 2),
    take_rate_pct: round(take_rate_pct, 2),
    capture_window_days: Math.round(capture_window_days || 45),
    available_stack_sf: round(available_stack_sf, 0),
    expected_clear_sf: round(expected_clear_sf, 0),
    clear_effective_rent: round(clear_effective_rent, 2),
    direct_rent: round(direct_rent, 2),
    rent_delta: round(rent_delta, 2),
    ets_vs_clear: round(ets_vs_clear, 2),
    interpretation: safe(interpretationMatch?.[1]),
    execution_bias: safe(biasMatch?.[1]),
    vector: safe(vectorMatch?.[1]),
    building_posture_score
  };
}

const INDUSTRY_COLUMN_MAP = [
  {
    column: 'Management_business_science_arts industries',
    label: 'Management / Business / Science / Arts',
    key: 'management_business_science_arts'
  },
  {
    column: 'Service Industry',
    label: 'Service',
    key: 'service'
  },
  {
    column: 'Sales Office Industry',
    label: 'Sales / Office',
    key: 'sales_office'
  },
  {
    column: 'natural resources and construction industries',
    label: 'Natural Resources / Construction',
    key: 'natural_resources_construction'
  },
  {
    column: 'Production and Transport Industries',
    label: 'Production / Transport',
    key: 'production_transport'
  },
  {
    column: 'Information Industry',
    label: 'Information',
    key: 'information'
  },
  {
    column: 'Financial Services & Real Estate Industries',
    label: 'Financial Services / Real Estate',
    key: 'financial_real_estate'
  },
  {
    column: 'Professional Services Industry',
    label: 'Professional Services',
    key: 'professional_services'
  },
  {
    column: 'Education and Health Industries',
    label: 'Education / Health',
    key: 'education_health'
  },
  {
    column: 'arts and food industries',
    label: 'Arts / Food',
    key: 'arts_food'
  },
  {
    column: 'public and admin industries',
    label: 'Public Administration',
    key: 'public_admin'
  }
];

function buildIndustryShares(row) {
  const shares = {};
  for (const item of INDUSTRY_COLUMN_MAP) {
    shares[item.key] = clamp01(
      num(
        row[item.column] ??
          row[item.key] ??
          pickNormalized(row, [item.column, item.key]),
        0
      )
    );
  }
  return shares;
}

function buildTopIndustries(shares, row = {}) {
  const ranked = INDUSTRY_COLUMN_MAP.map(item => ({
    label: item.label,
    key: item.key,
    score: clamp01(shares[item.key] || 0)
  }))
    .sort((a, b) => b.score - a.score);

  const phrase1 = safe(
    row.Top1_industry_phrase || pickNormalized(row, ['Top1_industry_phrase'])
  );
  const phrase2 = safe(
    row.Top2_industry_phrase || pickNormalized(row, ['Top2_industry_phrase'])
  );
  const phrase3 = safe(
    row.Top3_industry_phrase || pickNormalized(row, ['Top3_industry_phrase'])
  );

  const top1 = ranked[0] || { label: '—', score: 0 };
  const top2 = ranked[1] || { label: '—', score: 0 };
  const top3 = ranked[2] || { label: '—', score: 0 };

  return {
    list: ranked,
    top1: phrase1 || `${top1.label} dominant`,
    top2: phrase2 || `${top2.label} concentrated`,
    top3: phrase3 || `${top3.label} active`,
    top1_label: top1.label,
    top2_label: top2.label,
    top3_label: top3.label,
    top1_score: round(top1.score, 4),
    top2_score: round(top2.score, 4),
    top3_score: round(top3.score, 4)
  };
}

function deriveGravityFields(shares) {
  const g_nonprofit = clamp01(
    shares.public_admin * 0.36 +
      shares.education_health * 0.30 +
      shares.arts_food * 0.10 +
      shares.service * 0.12 +
      shares.professional_services * 0.12
  );

  const g_law = clamp01(
    shares.professional_services * 0.58 +
      shares.management_business_science_arts * 0.28 +
      shares.information * 0.06 +
      shares.financial_real_estate * 0.08
  );

  const g_defense = clamp01(
    shares.public_admin * 0.42 +
      shares.professional_services * 0.22 +
      shares.information * 0.18 +
      shares.management_business_science_arts * 0.10 +
      shares.production_transport * 0.08
  );

  const g_proffin = clamp01(
    shares.financial_real_estate * 0.58 +
      shares.professional_services * 0.22 +
      shares.management_business_science_arts * 0.12 +
      shares.sales_office * 0.08
  );

  const g_accounting = clamp01(
    shares.professional_services * 0.54 +
      shares.management_business_science_arts * 0.26 +
      shares.financial_real_estate * 0.12 +
      shares.sales_office * 0.08
  );

  const g_ai_tech = clamp01(
    shares.information * 0.52 +
      shares.management_business_science_arts * 0.28 +
      shares.professional_services * 0.12 +
      shares.financial_real_estate * 0.08
  );

  const g_association = clamp01(
    shares.public_admin * 0.34 +
      shares.professional_services * 0.24 +
      shares.management_business_science_arts * 0.16 +
      shares.service * 0.14 +
      shares.education_health * 0.12
  );

  const g_education = clamp01(
    shares.education_health * 0.70 +
      shares.management_business_science_arts * 0.12 +
      shares.public_admin * 0.10 +
      shares.service * 0.08
  );

  return {
    g_nonprofit,
    G_Nonprofit: g_nonprofit,
    industry_gravity_nonprofit: g_nonprofit,

    g_law,
    G_Law: g_law,
    industry_gravity_law: g_law,

    g_defense,
    G_Defense: g_defense,
    industry_gravity_defense: g_defense,

    g_proffin,
    G_ProfFin: g_proffin,
    industry_gravity_proffin: g_proffin,

    g_accounting,
    G_Accounting: g_accounting,
    industry_gravity_accounting: g_accounting,

    g_ai_tech,
    G_AI_Tech: g_ai_tech,
    G_Ai_Tech: g_ai_tech,
    industry_gravity_ai_tech: g_ai_tech,

    g_association,
    G_Association: g_association,
    industry_gravity_association: g_association,

    g_education,
    G_Education: g_education,
    industry_gravity_education: g_education,

    industry_gravity_0to1: round(
      Math.max(
        g_nonprofit,
        g_law,
        g_defense,
        g_proffin,
        g_accounting,
        g_ai_tech,
        g_association,
        g_education
      ),
      4
    )
  };
}

function deriveTractMetrics(rawRow, shares, clear) {
  const talentGravity = clamp(num(rawRow['Talent Gravity Score'], 0), 0, 100);
  const opportunityScore = clamp(num(rawRow['Opportunity Score'], 0), 0, 100);
  const decisionClassShare = clamp01(num(rawRow['decision class share'], 0));
  const workFromHomeShare = clamp01(num(rawRow['Work from home share'], 0));
  const meanTravelTime = clamp(num(rawRow['Mean travel time'], 0), 0, 90);
  const publicTransportShare = clamp01(num(rawRow['Public transport share'], 0));
  const publicPrivateMix = clamp01(num(rawRow['public private mix raw'], 0));
  const perCapitaIncome = Math.max(0, num(rawRow['Per capita income'], 0));

  const income01 = clamp01((perCapitaIncome - 40000) / 120000);
  const commuteAdvantage01 = clamp01((45 - meanTravelTime) / 25);

  const laborPressure = round(
    clamp(
      talentGravity * 0.44 +
        decisionClassShare * 100 * 0.22 +
        shares.professional_services * 100 * 0.12 +
        shares.management_business_science_arts * 100 * 0.10 +
        publicTransportShare * 100 * 0.06 +
        commuteAdvantage01 * 100 * 0.06,
      0,
      100
    ),
    2
  );

  const marketPhysics = round(
    clamp(
      opportunityScore * 0.46 +
        shares.financial_real_estate * 100 * 0.16 +
        shares.professional_services * 100 * 0.12 +
        clear.clear_pressure_index * 2.2 * 0.12 +
        publicPrivateMix * 100 * 0.08 +
        income01 * 100 * 0.06,
      0,
      100
    ),
    2
  );

  const macroDemand = round(
    clamp(
      opportunityScore * 0.38 +
        decisionClassShare * 100 * 0.18 +
        income01 * 100 * 0.14 +
        publicPrivateMix * 100 * 0.12 +
        publicTransportShare * 100 * 0.08 +
        commuteAdvantage01 * 100 * 0.10,
      0,
      100
    ),
    2
  );

  const frictionScore = round(
    clamp(
      meanTravelTime * 1.55 +
        (1 - publicTransportShare) * 24 +
        (1 - commuteAdvantage01) * 18,
      0,
      100
    ),
    2
  );

  const talentDensity = round(
    clamp(
      talentGravity * 0.66 +
        decisionClassShare * 100 * 0.18 +
        income01 * 100 * 0.10 +
        publicTransportShare * 100 * 0.06,
      0,
      100
    ),
    2
  );

  return {
    talent_gravity: talentGravity,
    opportunity_score: opportunityScore,
    friction_score: frictionScore,
    labor_pressure: laborPressure,
    market_physics: marketPhysics,
    macro_demand: macroDemand,
    talent_density_tract: talentDensity,
    decision_class_share: round(decisionClassShare, 4),
    work_from_home_share: round(workFromHomeShare, 4),
    mean_travel_time: round(meanTravelTime, 1),
    public_transport_share: round(publicTransportShare, 4),
    public_private_mix_raw: round(publicPrivateMix, 4),
    per_capita_income: round(perCapitaIncome, 0),

    commute_time_advantage_score: percentFrom01(commuteAdvantage01),
    transit_access_score: percentFrom01(publicTransportShare),
    remote_flex_score: percentFrom01(workFromHomeShare),
    commute_access_score: percentFrom01(publicTransportShare * 0.65 + commuteAdvantage01 * 0.35),
    high_earner_score: percentFrom01(income01),
    earnings_power_score: percentFrom01(income01 * 0.75 + decisionClassShare * 0.25),
    knowledge_work_intensity: round(
      clamp01(
        shares.management_business_science_arts * 0.40 +
          shares.professional_services * 0.30 +
          shares.financial_real_estate * 0.20 +
          shares.information * 0.10
      ),
      4
    )
  };
}

function normalizeCanonicalRow(row, idx) {
  const address = compactSpaces(
    firstText(
      row,
      ['Building_Address', 'building_address', 'Address', 'address'],
      'Unnamed Address'
    )
  );

  const geoid = cleanGeoid(
    firstText(row, ['geoid_11', 'tract_geoid', 'source_geo_id', 'GEOID'], '')
  );

  const lat =
    firstMaybeNumber(row, ['Lat', 'lat', 'Latitude', 'latitude']) ??
    (() => {
      const ll = safe(row.interpolated_longitude_latitude);
      if (!ll.includes(',')) return null;
      const parts = ll.split(',').map(v => num(v, NaN));
      return Number.isFinite(parts[1]) ? parts[1] : null;
    })();

  const lon =
    firstMaybeNumber(row, ['Lon', 'lon', 'Longitude', 'longitude', 'Lng', 'lng']) ??
    (() => {
      const ll = safe(row.interpolated_longitude_latitude);
      if (!ll.includes(',')) return null;
      const parts = ll.split(',').map(v => num(v, NaN));
      return Number.isFinite(parts[0]) ? parts[0] : null;
    })();

  const shares = buildIndustryShares(row);
  const top = buildTopIndustries(shares, row);
  const gravity = deriveGravityFields(shares);
  const clear = parseBuildingClear(row['Building Clear']);

  const metrics = deriveTractMetrics(row, shares, clear);
  const signalRegime = safe(row['Dominant Force']) || 'Field Regime';
  const tractBrief = safe(row['tract brief today']);
  const dominantForce =
    signalRegime ||
    (metrics.labor_pressure >= metrics.market_physics && metrics.labor_pressure >= metrics.macro_demand
      ? 'Labor Pressure'
      : metrics.market_physics >= metrics.macro_demand
        ? 'Market Physics'
        : 'Macro Demand');

  const canonical = {
    ...row,

    building_id: `${slugify(address)}_${idx + 1}`,
    building_name: address,
    Building_Address: address,
    address_label: address,
    matched_address: address,

    geoid,
    tract_geoid: geoid,
    tractid: geoid,
    source_geo_id: safe(row.source_geo_id) || (geoid ? `1400000US${geoid}` : ''),

    lat: Number.isFinite(lat) ? round(lat, 6) : null,
    lon: Number.isFinite(lon) ? round(lon, 6) : null,
    latitude: Number.isFinite(lat) ? round(lat, 6) : null,
    longitude: Number.isFinite(lon) ? round(lon, 6) : null,

    tract_name: geoid ? `TRACT ${geoid}` : address,
    tract_brief: tractBrief,
    brief: tractBrief,

    signal_regime: signalRegime,
    dominant_force: dominantForce,
    signal: signalRegime,

    ...metrics,
    ...gravity,

    top_industry1_label: top.top1_label,
    top_industry2_label: top.top2_label,
    top_industry3_label: top.top3_label,
    top_industry1_score: top.top1_score,
    top_industry2_score: top.top2_score,
    top_industry3_score: top.top3_score,
    top_industry1_phrase: top.top1,
    top_industry2_phrase: top.top2,
    top_industry3_phrase: top.top3,

    clear_pressure: clear.clear_pressure_index,
    clear_pressure_index: clear.clear_pressure_index,
    take_rate_pct: clear.take_rate_pct,
    capture_window_days: clear.capture_window_days,
    available_stack_sf: clear.available_stack_sf,
    expected_clear_sf: clear.expected_clear_sf,
    clear_effective_rent: clear.clear_effective_rent,
    direct_rent: clear.direct_rent,
    rent_delta: clear.rent_delta,
    ets_vs_clear: clear.ets_vs_clear,
    interpretation: clear.interpretation,
    execution_bias: clear.execution_bias,
    building_vector: clear.vector,
    building_posture_score: clear.building_posture_score,
    posture_score: clear.building_posture_score,

    building_spatial_gravity_0to1: round(
      clamp01(
        metrics.opportunity_score / 100 * 0.36 +
          gravity.industry_gravity_0to1 * 0.34 +
          metrics.transit_access_score / 100 * 0.12 +
          metrics.remote_flex_score / 100 * 0.08 +
          metrics.knowledge_work_intensity * 0.10
      ),
      4
    ),

    dc_physics_final_v2_0to1: round(
      clamp01(
        metrics.market_physics / 100 * 0.40 +
          metrics.macro_demand / 100 * 0.24 +
          metrics.labor_pressure / 100 * 0.20 +
          metrics.opportunity_score / 100 * 0.16
      ),
      4
    ),

    decision_labor_pressure: metrics.labor_pressure,

    building_signal_index: round(
      clamp(
        clear.clear_pressure_index * 2.0 +
          clear.building_posture_score * 0.38 +
          metrics.labor_pressure * 0.18 +
          metrics.market_physics * 0.14,
        0,
        100
      ),
      2
    ),

    management_business_science_arts: shares.management_business_science_arts,
    service: shares.service,
    sales_office: shares.sales_office,
    natural_resources_construction: shares.natural_resources_construction,
    production_transport: shares.production_transport,
    information: shares.information,
    financial_real_estate: shares.financial_real_estate,
    professional_services: shares.professional_services,
    education_health: shares.education_health,
    arts_food: shares.arts_food,
    public_admin: shares.public_admin
  };

  return canonical;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = CFG.SMARTSHEET_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const body = await res.text().catch(() => '');
    let payload = null;

    try {
      payload = body ? JSON.parse(body) : null;
    } catch {
      throw new Error(`Non-JSON response from ${url}: ${body.slice(0, 240)}`);
    }

    if (!res.ok) {
      throw new Error(payload?.error || `HTTP ${res.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSheet(sheetId) {
  if (!safe(CFG.SMARTSHEET_TOKEN)) {
    throw new Error('Missing SMARTSHEET_TOKEN / SMARTSHEET_API_KEY');
  }

  return fetchJsonWithTimeout(
    `https://api.smartsheet.com/2.0/sheets/${sheetId}`,
    {
      headers: {
        Authorization: `Bearer ${CFG.SMARTSHEET_TOKEN}`
      }
    },
    CFG.SMARTSHEET_TIMEOUT_MS
  );
}

function sheetToObjects(sheet) {
  const colMap = new Map((sheet.columns || []).map(c => [c.id, c.title]));
  return (sheet.rows || []).map(row => {
    const out = {};
    for (const cell of row.cells || []) {
      const title = colMap.get(cell.columnId);
      if (!title) continue;
      out[title] = cell.displayValue ?? cell.value ?? '';
    }
    return out;
  });
}

async function loadDataset() {
  const cached = getCache('dataset');
  if (cached) return cached;

  const sheet = await fetchSheet(CFG.SMARTSHEET_SHEET_ID);
  const rawRows = sheetToObjects(sheet);

  const buildings = rawRows
    .map((row, idx) => normalizeCanonicalRow(row, idx))
    .filter(row => safe(row.Building_Address) && Number.isFinite(row.lat) && Number.isFinite(row.lon));

  const tractGroups = new Map();

  for (const row of buildings) {
    const geoid = cleanGeoid(row.geoid);
    if (!geoid) continue;
    if (!tractGroups.has(geoid)) tractGroups.set(geoid, []);
    tractGroups.get(geoid).push(row);
  }

  const tracts = [];
  const tractMap = new Map();

  for (const [geoid, rows] of tractGroups.entries()) {
    const leader =
      rows
        .slice()
        .sort((a, b) => (b.opportunity_score + b.talent_gravity) - (a.opportunity_score + a.talent_gravity))[0] ||
      rows[0];

    const industryAvg = {};
    for (const item of INDUSTRY_COLUMN_MAP) {
      industryAvg[item.key] = round(average(rows.map(r => clamp01(r[item.key] || 0))) || 0, 4);
    }
    const top = buildTopIndustries(industryAvg);

    const tract = {
      ...leader,

      geoid,
      tract_geoid: geoid,
      tractid: geoid,
      GEOID: geoid,

      building_count: rows.length,
      lat: round(average(rows.map(r => r.lat)) || leader.lat || 0, 6),
      lon: round(average(rows.map(r => r.lon)) || leader.lon || 0, 6),

      talent_gravity: round(average(rows.map(r => r.talent_gravity)) || leader.talent_gravity || 0, 2),
      opportunity_score: round(average(rows.map(r => r.opportunity_score)) || leader.opportunity_score || 0, 2),
      friction_score: round(average(rows.map(r => r.friction_score)) || leader.friction_score || 0, 2),
      labor_pressure: round(average(rows.map(r => r.labor_pressure)) || leader.labor_pressure || 0, 2),
      market_physics: round(average(rows.map(r => r.market_physics)) || leader.market_physics || 0, 2),
      macro_demand: round(average(rows.map(r => r.macro_demand)) || leader.macro_demand || 0, 2),
      talent_density_tract: round(average(rows.map(r => r.talent_density_tract)) || leader.talent_density_tract || 0, 2),

      decision_class_share: round(average(rows.map(r => r.decision_class_share)) || leader.decision_class_share || 0, 4),
      work_from_home_share: round(average(rows.map(r => r.work_from_home_share)) || leader.work_from_home_share || 0, 4),
      mean_travel_time: round(average(rows.map(r => r.mean_travel_time)) || leader.mean_travel_time || 0, 1),
      public_transport_share: round(average(rows.map(r => r.public_transport_share)) || leader.public_transport_share || 0, 4),
      public_private_mix_raw: round(average(rows.map(r => r.public_private_mix_raw)) || leader.public_private_mix_raw || 0, 4),
      per_capita_income: round(average(rows.map(r => r.per_capita_income)) || leader.per_capita_income || 0, 0),

      transit_access_score: round(average(rows.map(r => r.transit_access_score)) || leader.transit_access_score || 0, 2),
      commute_time_advantage_score: round(average(rows.map(r => r.commute_time_advantage_score)) || leader.commute_time_advantage_score || 0, 2),
      remote_flex_score: round(average(rows.map(r => r.remote_flex_score)) || leader.remote_flex_score || 0, 2),
      commute_access_score: round(average(rows.map(r => r.commute_access_score)) || leader.commute_access_score || 0, 2),
      high_earner_score: round(average(rows.map(r => r.high_earner_score)) || leader.high_earner_score || 0, 2),
      earnings_power_score: round(average(rows.map(r => r.earnings_power_score)) || leader.earnings_power_score || 0, 2),
      knowledge_work_intensity: round(average(rows.map(r => r.knowledge_work_intensity)) || leader.knowledge_work_intensity || 0, 4),

      clear_pressure: round(average(rows.map(r => r.clear_pressure)) || leader.clear_pressure || 0, 2),
      clear_pressure_index: round(average(rows.map(r => r.clear_pressure_index)) || leader.clear_pressure_index || 0, 2),
      building_posture_score: round(average(rows.map(r => r.building_posture_score)) || leader.building_posture_score || 0, 2),
      take_rate_pct: round(average(rows.map(r => r.take_rate_pct)) || leader.take_rate_pct || 0, 2),
      capture_window_days: Math.round(average(rows.map(r => r.capture_window_days)) || leader.capture_window_days || 45),

      ...deriveGravityFields(industryAvg),

      management_business_science_arts: industryAvg.management_business_science_arts,
      service: industryAvg.service,
      sales_office: industryAvg.sales_office,
      natural_resources_construction: industryAvg.natural_resources_construction,
      production_transport: industryAvg.production_transport,
      information: industryAvg.information,
      financial_real_estate: industryAvg.financial_real_estate,
      professional_services: industryAvg.professional_services,
      education_health: industryAvg.education_health,
      arts_food: industryAvg.arts_food,
      public_admin: industryAvg.public_admin,

      top_industry1_label: top.top1_label,
      top_industry2_label: top.top2_label,
      top_industry3_label: top.top3_label,
      top_industry1_phrase: top.top1,
      top_industry2_phrase: top.top2,
      top_industry3_phrase: top.top3,

      tract_name: leader.tract_name || `TRACT ${geoid}`,
      signal_regime: leader.signal_regime,
      dominant_force: leader.dominant_force,
      tract_brief: leader.tract_brief
    };

    tracts.push(tract);
    tractMap.set(geoid, tract);
  }

  const dataset = {
    buildings,
    tracts,
    tractMap,
    rows: buildings.length,
    tractCount: tracts.length,
    loadedAt: new Date().toISOString()
  };

  setCache('dataset', dataset);
  return dataset;
}

function scoreLocalAddressMatch(query, row) {
  const q = normalizeAddressText(query);
  const addr = normalizeAddressText(row.Building_Address);
  if (!q || !addr) return -Infinity;

  let score = 0;
  if (addr === q) score += 200;
  if (addr.startsWith(q)) score += 120;
  if (addr.includes(q)) score += 80;

  const qTokens = q.split(' ').filter(Boolean);
  const addrTokens = new Set(addr.split(' ').filter(Boolean));
  let tokenHits = 0;
  for (const token of qTokens) {
    if (addrTokens.has(token)) tokenHits += 1;
  }
  score += tokenHits * 12;

  const numMatch = q.match(/^\d+/)?.[0];
  if (numMatch && addr.startsWith(numMatch)) score += 20;

  return score;
}

function toSearchCandidate(row, source = 'sheet') {
  return {
    source,
    matched_address: row.Building_Address,
    address_label: row.Building_Address,
    address_context: row.tract_name || (row.geoid ? `TRACT ${row.geoid}` : ''),
    place_name: row.Building_Address,
    geoid: row.geoid,
    lat: row.lat,
    lon: row.lon,
    tract_name: row.tract_name || '',
    dominant_force: row.dominant_force || '',
    signal_regime: row.signal_regime || '',
    top_industry1_label: row.top_industry1_label || '',
    top_industry2_label: row.top_industry2_label || '',
    top_industry3_label: row.top_industry3_label || ''
  };
}

async function geocodeMapbox(query) {
  if (!safe(CFG.MAPBOX_TOKEN) || !safe(query)) return [];
  const cacheKey = `geocode:${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${encodeURIComponent(CFG.MAPBOX_TOKEN)}` +
    `&autocomplete=true&country=us&types=address,poi,place&limit=${CFG.MAPBOX_LIMIT}`;

  try {
    const data = await fetchJsonWithTimeout(url, {}, 10000);
    const features = Array.isArray(data?.features) ? data.features : [];
    const out = features.map(f => ({
      source: 'mapbox',
      matched_address: safe(f.place_name),
      address_label: safe(f.text) || safe(f.place_name),
      address_context: Array.isArray(f.context) ? f.context.map(c => c.text).filter(Boolean).join(', ') : '',
      place_name: safe(f.place_name),
      geoid: '',
      lat: Array.isArray(f.center) ? num(f.center[1], NaN) : NaN,
      lon: Array.isArray(f.center) ? num(f.center[0], NaN) : NaN,
      tract_name: ''
    })).filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lon));

    setCache(cacheKey, out, 86400000);
    return out;
  } catch (err) {
    log('MAPBOX GEOCODE FAILED:', err?.message || err);
    return [];
  }
}

function uniqueCandidates(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${normalizeAddressText(row.matched_address)}|${round(num(row.lat, 0), 6)}|${round(num(row.lon, 0), 6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function searchAddressCandidates(query) {
  const q = compactSpaces(query);
  if (q.length < 2) return [];

  const { buildings } = await loadDataset();

  const local = buildings
    .map(row => ({ row, score: scoreLocalAddressMatch(q, row) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.LOCAL_SEARCH_LIMIT)
    .map(item => toSearchCandidate(item.row, 'sheet'));

  if (local.length >= CFG.LOCAL_SEARCH_LIMIT) return uniqueCandidates(local);

  const remote = await geocodeMapbox(q);
  return uniqueCandidates([...local, ...remote]).slice(0, Math.max(CFG.LOCAL_SEARCH_LIMIT, 8));
}

function pickBestLocalRowFromCoords(buildings, lat, lon) {
  let best = null;
  let bestKm = Infinity;
  for (const row of buildings) {
    const km = distanceKm(lon, lat, row.lon, row.lat);
    if (km < bestKm) {
      best = row;
      bestKm = km;
    }
  }
  if (!best) return null;
  return { row: best, km: bestKm };
}

function pickBestLocalRowFromQuery(buildings, query) {
  const scored = buildings
    .map(row => ({ row, score: scoreLocalAddressMatch(query, row) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.row || null;
}

function buildRelativeTracts(selectedTract, tracts) {
  if (!selectedTract) return [];
  const targetGeoid = cleanGeoid(selectedTract.geoid);
  const out = [];

  for (const tract of tracts) {
    const geoid = cleanGeoid(tract.geoid);
    if (!geoid || geoid === targetGeoid) continue;

    const distance = distanceKm(selectedTract.lon, selectedTract.lat, tract.lon, tract.lat);
    const talentGap = Math.abs((tract.talent_gravity || 0) - (selectedTract.talent_gravity || 0)) / 100;
    const oppGap = Math.abs((tract.opportunity_score || 0) - (selectedTract.opportunity_score || 0)) / 100;
    const laborGap = Math.abs((tract.labor_pressure || 0) - (selectedTract.labor_pressure || 0)) / 100;
    const marketGap = Math.abs((tract.market_physics || 0) - (selectedTract.market_physics || 0)) / 100;

    const similarity = clamp01(
      1 -
        (
          talentGap * 0.28 +
          oppGap * 0.28 +
          laborGap * 0.22 +
          marketGap * 0.22 +
          clamp01(distance / 8) * 0.18
        )
    );

    out.push({
      rank: 0,
      geoid,
      label: tract.tract_name || `TRACT ${geoid}`,
      score: round(similarity, 4),
      talent_gravity: tract.talent_gravity,
      opportunity_score: tract.opportunity_score,
      labor_pressure: tract.labor_pressure,
      market_physics: tract.market_physics,
      signal_regime: tract.signal_regime,
      dominant_force: tract.dominant_force
    });
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, CFG.RELATIVE_TRACT_COUNT)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function buildNearbyOrganizations(selectedRow, buildings) {
  if (!selectedRow) return [];
  return buildings
    .filter(row => row.building_id !== selectedRow.building_id)
    .map(row => ({
      address: row.Building_Address,
      matched_address: row.Building_Address,
      geoid: row.geoid,
      lat: row.lat,
      lon: row.lon,
      distance_km: round(distanceKm(selectedRow.lon, selectedRow.lat, row.lon, row.lat), 3),
      signal_regime: row.signal_regime,
      dominant_force: row.dominant_force,
      building_posture_score: row.building_posture_score,
      clear_pressure_index: row.clear_pressure_index
    }))
    .filter(row => row.distance_km <= CFG.NEARBY_RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 12);
}

function buildCommandPayload(selectedRow, tract) {
  return {
    geoid: tract?.geoid || selectedRow?.geoid || '',
    signal_regime: tract?.signal_regime || selectedRow?.signal_regime || '',
    dominant_force: tract?.dominant_force || selectedRow?.dominant_force || '',
    talent_gravity: tract?.talent_gravity ?? selectedRow?.talent_gravity ?? 0,
    opportunity_score: tract?.opportunity_score ?? selectedRow?.opportunity_score ?? 0,
    friction_score: tract?.friction_score ?? selectedRow?.friction_score ?? 0,
    labor_pressure: tract?.labor_pressure ?? selectedRow?.labor_pressure ?? 0,
    market_physics: tract?.market_physics ?? selectedRow?.market_physics ?? 0,
    macro_demand: tract?.macro_demand ?? selectedRow?.macro_demand ?? 0,
    clear_pressure_index: selectedRow?.clear_pressure_index ?? tract?.clear_pressure_index ?? 0,
    building_posture_score: selectedRow?.building_posture_score ?? tract?.building_posture_score ?? 0,
    execution_bias: selectedRow?.execution_bias || '',
    interpretation: selectedRow?.interpretation || ''
  };
}

async function resolveFusionAddress(params) {
  const q = compactSpaces(params.get('q') || '');
  const matched = compactSpaces(params.get('matched_address') || '');
  const lat = maybeNum(params.get('lat'));
  const lon = maybeNum(params.get('lon'));

  const dataset = await loadDataset();
  const { buildings, tracts, tractMap } = dataset;

  let selectedRow = null;
  let selectionSource = 'sheet';

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const picked = pickBestLocalRowFromCoords(buildings, lat, lon);
    if (picked && picked.km <= CFG.FUSION_MATCH_RADIUS_KM) {
      selectedRow = picked.row;
      selectionSource = 'sheet_coords';
    }
  }

  if (!selectedRow && matched) {
    selectedRow = pickBestLocalRowFromQuery(buildings, matched);
    if (selectedRow) selectionSource = 'sheet_address';
  }

  if (!selectedRow && q) {
    selectedRow = pickBestLocalRowFromQuery(buildings, q);
    if (selectedRow) selectionSource = 'sheet_query';
  }

  if (!selectedRow && Number.isFinite(lat) && Number.isFinite(lon)) {
    const nearest = pickBestLocalRowFromCoords(buildings, lat, lon);
    if (nearest?.row) {
      selectedRow = nearest.row;
      selectionSource = 'nearest_sheet';
    }
  }

  if (!selectedRow) {
    throw new Error('No address match found in canonical sheet.');
  }

  const tract = tractMap.get(cleanGeoid(selectedRow.geoid)) || null;
  const relative_tracts = buildRelativeTracts(tract || selectedRow, tracts);
  const nearby_organizations = buildNearbyOrganizations(selectedRow, buildings);

  return {
    ok: true,
    source: selectionSource,
    query: q || matched || selectedRow.Building_Address,
    selected_location: {
      source: selectionSource,
      matched_address: selectedRow.Building_Address,
      address_label: selectedRow.Building_Address,
      place_name: selectedRow.Building_Address,
      lat: selectedRow.lat,
      lon: selectedRow.lon,
      geoid: selectedRow.geoid
    },
    result: {
      source: selectionSource,
      matched_address: selectedRow.Building_Address,
      address_label: selectedRow.Building_Address,
      place_name: selectedRow.Building_Address,
      lat: selectedRow.lat,
      lon: selectedRow.lon,
      geoid: selectedRow.geoid
    },
    tract,
    tract_raw: tract,
    command: buildCommandPayload(selectedRow, tract),
    relative_tracts,
    nearby_organizations,
    selected_row: selectedRow
  };
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    text(res, 403, 'Forbidden');
    return;
  }

  try {
    if (filePath.endsWith('.html')) {
      let body = await fs.readFile(filePath, 'utf8');

      const injectedTokenScript = `<script>window.__MAPBOX_ACCESS_TOKEN__ = ${JSON.stringify(CFG.MAPBOX_TOKEN || '')};</script>`;

      body = body.replace(
        '</head>',
        `${injectedTokenScript}\n</head>`
      );

      text(res, 200, body, mimeTypeFor(filePath));
      return;
    }

    const body = await fs.readFile(filePath);
    text(res, 200, body, mimeTypeFor(filePath));
  } catch {
    text(res, 404, 'Not found');
  }
}

async function route(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        status: 'ok',
        service: 'chronos canonical one-sheet fusion pipe',
        sheet_id: CFG.SMARTSHEET_SHEET_ID,
        now: new Date().toISOString()
      });
      return;
    }

    if (pathname === '/api/status') {
      const dataset = await loadDataset();
      json(res, 200, {
        ok: true,
        service: 'chronos canonical one-sheet fusion pipe',
        sheet_id: CFG.SMARTSHEET_SHEET_ID,
        rows: dataset.rows,
        tract_count: dataset.tractCount,
        loaded_at: dataset.loadedAt,
        cache_entries: CACHE.size
      });
      return;
    }

    if (pathname === '/api/cache/clear') {
      clearCache();
      json(res, 200, { ok: true, cleared: true });
      return;
    }

    if (pathname === '/api/tracts') {
      const dataset = await loadDataset();
      json(res, 200, dataset.tracts);
      return;
    }

    if (pathname === '/api/buildings') {
      const dataset = await loadDataset();
      json(res, 200, dataset.buildings);
      return;
    }

    if (pathname === '/api/overrides') {
      json(res, 200, []);
      return;
    }

    if (pathname === '/api/search/address') {
      const q = compactSpaces(url.searchParams.get('q') || '');
      if (q.length < 2) {
        json(res, 200, []);
        return;
      }
      const rows = await searchAddressCandidates(q);
      json(res, 200, rows);
      return;
    }

    if (pathname === '/api/fusion/address') {
      const payload = await resolveFusionAddress(url.searchParams);
      json(res, 200, payload);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    log('SERVER ERROR:', err?.message || err);
    json(res, 500, {
      ok: false,
      error: err?.message || 'Internal server error'
    });
  }
}

const server = http.createServer((req, res) => {
  route(req, res).catch(err => {
    log('UNCAUGHT ROUTE ERROR:', err?.message || err);
    json(res, 500, {
      ok: false,
      error: err?.message || 'Unhandled route error'
    });
  });
});

server.listen(PORT, () => {
  log(`QAGE ChronOS canonical one-sheet fusion pipe live on http://localhost:${PORT}`);
  log(`Using canonical Smartsheet sheet id: ${CFG.SMARTSHEET_SHEET_ID}`);
});