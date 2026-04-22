/* ============================================================================
   nonprofit_overlay.js
   CHRONOS NONPROFIT OVERLAY
   ----------------------------------------------------------------------------
   ASSUMPTIONS
   - app.js loads first and exposes window.ChronOSBridge
   - nonprofit geojson file exists at ./data/nonprofits.geojson
   - features are Point geometry
============================================================================ */

(() => {
  'use strict';

  const CFG = {
    DATA_URL: './nonprofits.geojson',

    PANEL_ID: 'chronos-nonprofit-panel',
    READOUT_ID: 'chronos-nonprofit-readout',

    SOURCE_ALL: 'np-all',
    SOURCE_MATCHED: 'np-matched',
    SOURCE_SELECTED: 'np-selected',

    LAYER_ALL: 'np-all-layer',
    LAYER_MATCHED: 'np-matched-layer',
    LAYER_SELECTED: 'np-selected-layer',

    DEFAULTS: {
      category: 'ALL',
      minRevenue: 0,
      maxRevenue: 1000000000,
      pressureTolerance: 0.50,
      opportunityBias: 0.50,
      fitThreshold: 0.00,
      showOnlyMatched: false,
      topN: 1000
    },

    COLORS: {
      faint: '#5e7d88',
      matched: '#72f3ff',
      selected: '#ffb347',
      hot: '#ff6b57',
      text: '#dff9ff',
      soft: '#88a6b1',
      panelBg: 'rgba(4,8,12,.92)',
      border: 'rgba(0,229,255,.16)'
    }
  };

  const state = {
    booted: false,
    map: null,

    all: { type: 'FeatureCollection', features: [] },
    matched: { type: 'FeatureCollection', features: [] },
    selectedFeature: null,

    ui: { ...CFG.DEFAULTS }
  };

  function cleanStr(v) {
    return String(v ?? '').trim();
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function clamp01(v) {
    return clamp(num(v, 0), 0, 1);
  }

  function fmtMoneyShort(value) {
    const n = num(value, 0);
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  function fmtPct01(v) {
    return `${Math.round(clamp01(v) * 100)}%`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeLog(v, min, max) {
    const x = Math.max(min, num(v, min));
    const lo = Math.log(min);
    const hi = Math.log(max);
    const cur = Math.log(Math.min(max, x));
    return clamp01((cur - lo) / (hi - lo));
  }

  function mix(a, b, wa) {
    const wb = 1 - wa;
    return (a * wa) + (b * wb);
  }

  function isPointFeature(f) {
    return !!(
      f &&
      f.geometry &&
      f.geometry.type === 'Point' &&
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates.length >= 2 &&
      Number.isFinite(+f.geometry.coordinates[0]) &&
      Number.isFinite(+f.geometry.coordinates[1])
    );
  }

  function sameCategory(a, b) {
    return cleanStr(a).toLowerCase() === cleanStr(b).toLowerCase();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function getBridge() {
    return window.ChronOSBridge || null;
  }

  function waitForBridge() {
    return new Promise(resolve => {
      const t = setInterval(() => {
        const bridge = getBridge();
        if (bridge && bridge.ready && bridge.map) {
          clearInterval(t);
          resolve(bridge);
        }
      }, 100);
    });
  }

  function normalizeFeature(feature, idx) {
    const p = feature.properties || {};
    const [lng, lat] = feature.geometry.coordinates;

    const id =
      cleanStr(feature.id) ||
      cleanStr(p.id) ||
      cleanStr(p.ein) ||
      cleanStr(p.org_name) ||
      `np-${idx + 1}`;

    return {
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates: [num(lng, 0), num(lat, 0)]
      },
      properties: {
        id,
        org_name: cleanStr(p.org_name || p.organization || p.name || `Nonprofit ${idx + 1}`),
        ein: cleanStr(p.ein || ''),
        category: cleanStr(p.category || p.ntee_major || p.ntee_code || 'Unknown'),
        subcategory: cleanStr(p.subcategory || p.ntee_desc || ''),
        revenue: num(p.revenue, 0),
        employees: num(p.employees, 0),
        address: cleanStr(p.address || p.street_address || ''),
        city: cleanStr(p.city || ''),
        state: cleanStr(p.state || ''),
        geoid: cleanStr(p.geoid || ''),
        source: cleanStr(p.source || 'public'),
        fitScore: 0,
        tractPressure: 0,
        tractOpportunity: 0,
        tractLabor: 0,
        buildingPressure: 0,
        visible: 1
      }
    };
  }

  async function loadData() {
    console.log('[nonprofit_overlay] loading', CFG.DATA_URL);
    const res = await fetch(CFG.DATA_URL, { cache: 'no-store' });
    console.log('[nonprofit_overlay] fetch', res.status);

    if (!res.ok) {
      throw new Error(`Nonprofit GeoJSON failed: ${res.status} ${CFG.DATA_URL}`);
    }

    const geojson = await res.json();
    const features = (geojson.features || [])
      .filter(isPointFeature)
      .map(normalizeFeature);

    console.log('[nonprofit_overlay] valid features', features.length);

    state.all = {
      type: 'FeatureCollection',
      features
    };

    updateCategoryOptions(features);
  }

  function ensurePanel() {
    if (byId(CFG.PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = CFG.PANEL_ID;
    panel.innerHTML = `
      <div class="np-head">
        <div class="np-kicker">LENS</div>
        <div class="np-title">Nonprofit Overlay</div>
      </div>

      <div class="np-row">
        <label>Category</label>
        <select id="np-category">
          <option value="ALL">ALL</option>
        </select>
      </div>

      <div class="np-row">
        <label>Revenue Min</label>
        <input id="np-minRevenue" type="range" min="0" max="1000000000" step="1000000" value="0" />
        <div class="np-val" id="np-minRevenue-val">$0</div>
      </div>

      <div class="np-row">
        <label>Revenue Max</label>
        <input id="np-maxRevenue" type="range" min="0" max="1000000000" step="1000000" value="1000000000" />
        <div class="np-val" id="np-maxRevenue-val">$1.0B</div>
      </div>

      <div class="np-row">
        <label>Pressure Tolerance</label>
        <input id="np-pressureTolerance" type="range" min="0" max="1" step="0.01" value="0.50" />
        <div class="np-val" id="np-pressureTolerance-val">0.50</div>
      </div>

      <div class="np-row">
        <label>Opportunity Bias</label>
        <input id="np-opportunityBias" type="range" min="0" max="1" step="0.01" value="0.50" />
        <div class="np-val" id="np-opportunityBias-val">0.50</div>
      </div>

      <div class="np-row">
        <label>Fit Threshold</label>
        <input id="np-fitThreshold" type="range" min="0" max="1" step="0.01" value="0.00" />
        <div class="np-val" id="np-fitThreshold-val">0.00</div>
      </div>

      <div class="np-row np-check">
        <label><input id="np-showOnlyMatched" type="checkbox" /> show only matched</label>
      </div>

      <div id="${CFG.READOUT_ID}" class="np-readout">
        Loading nonprofit overlay...
      </div>
    `;

    document.body.appendChild(panel);

    const style = document.createElement('style');
    style.textContent = `
      #${CFG.PANEL_ID}{
        position:absolute;
        top:140px;
        right:22px;
        width:310px;
        padding:14px 14px 12px;
        z-index:1200;
        background:${CFG.COLORS.panelBg};
        border:1px solid ${CFG.COLORS.border};
        border-radius:14px;
        color:${CFG.COLORS.text};
        font-family:Inter,system-ui,sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${CFG.PANEL_ID} .np-head{ margin-bottom: 12px; }
      #${CFG.PANEL_ID} .np-kicker{
        font-size:10px;
        letter-spacing:.18em;
        opacity:.65;
        margin-bottom:4px;
      }
      #${CFG.PANEL_ID} .np-title{
        font-size:18px;
        font-weight:700;
      }
      #${CFG.PANEL_ID} .np-row{ margin-bottom: 12px; }
      #${CFG.PANEL_ID} label{
        display:block;
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.10em;
        opacity:.82;
        margin-bottom:6px;
      }
      #${CFG.PANEL_ID} select,
      #${CFG.PANEL_ID} input[type="range"]{
        width:100%;
      }
      #${CFG.PANEL_ID} select{
        background: rgba(255,255,255,.04);
        color:${CFG.COLORS.text};
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;
        padding:8px 10px;
        outline:none;
      }
      #${CFG.PANEL_ID} .np-val{
        font-size:11px;
        color:${CFG.COLORS.soft};
        margin-top:4px;
      }
      #${CFG.PANEL_ID} .np-check label{
        font-size:12px;
        text-transform:none;
        letter-spacing:.02em;
      }
      #${CFG.PANEL_ID} .np-readout{
        margin-top:14px;
        padding-top:12px;
        border-top:1px solid rgba(255,255,255,.08);
        font-size:12px;
        line-height:1.45;
        color:${CFG.COLORS.soft};
      }
      #${CFG.PANEL_ID} .np-cardTitle{
        font-size:15px;
        font-weight:700;
        margin-bottom:6px;
        color:${CFG.COLORS.text};
      }
      #${CFG.PANEL_ID} .np-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px 10px;
        margin-top:8px;
      }
      #${CFG.PANEL_ID} .np-chip{
        background: rgba(114,243,255,.06);
        border:1px solid rgba(114,243,255,.10);
        border-radius:10px;
        padding:8px;
      }
      #${CFG.PANEL_ID} .np-chip .k{
        font-size:10px;
        opacity:.62;
        text-transform:uppercase;
        letter-spacing:.08em;
        margin-bottom:4px;
      }
      #${CFG.PANEL_ID} .np-chip .v{
        font-size:14px;
        font-weight:700;
        color:${CFG.COLORS.text};
      }
    `;
    document.head.appendChild(style);
  }

  function updateCategoryOptions(features) {
    const select = byId('np-category');
    if (!select) return;

    const cats = [...new Set(features.map(f => cleanStr(f.properties.category || 'Unknown')))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    select.innerHTML =
      '<option value="ALL">ALL</option>' +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function wirePanel() {
    const bind = (id, evt, fn) => {
      const el = byId(id);
      if (el) el.addEventListener(evt, fn);
    };

    bind('np-category', 'change', e => {
      state.ui.category = e.target.value;
      recomputeAndRender();
    });

    bind('np-minRevenue', 'input', e => {
      state.ui.minRevenue = num(e.target.value, 0);
      setText('np-minRevenue-val', fmtMoneyShort(state.ui.minRevenue));
      recomputeAndRender();
    });

    bind('np-maxRevenue', 'input', e => {
      state.ui.maxRevenue = num(e.target.value, 1000000000);
      setText('np-maxRevenue-val', fmtMoneyShort(state.ui.maxRevenue));
      recomputeAndRender();
    });

    bind('np-pressureTolerance', 'input', e => {
      state.ui.pressureTolerance = num(e.target.value, 0.5);
      setText('np-pressureTolerance-val', state.ui.pressureTolerance.toFixed(2));
      recomputeAndRender();
    });

    bind('np-opportunityBias', 'input', e => {
      state.ui.opportunityBias = num(e.target.value, 0.5);
      setText('np-opportunityBias-val', state.ui.opportunityBias.toFixed(2));
      recomputeAndRender();
    });

    bind('np-fitThreshold', 'input', e => {
      state.ui.fitThreshold = num(e.target.value, 0);
      setText('np-fitThreshold-val', state.ui.fitThreshold.toFixed(2));
      recomputeAndRender();
    });

    bind('np-showOnlyMatched', 'change', e => {
      state.ui.showOnlyMatched = !!e.target.checked;
      recomputeAndRender();
    });

    setText('np-minRevenue-val', fmtMoneyShort(state.ui.minRevenue));
    setText('np-maxRevenue-val', fmtMoneyShort(state.ui.maxRevenue));
    setText('np-pressureTolerance-val', state.ui.pressureTolerance.toFixed(2));
    setText('np-opportunityBias-val', state.ui.opportunityBias.toFixed(2));
    setText('np-fitThreshold-val', state.ui.fitThreshold.toFixed(2));
  }

  function ensureSourcesAndLayers() {
    if (!state.map.getSource(CFG.SOURCE_ALL)) {
      state.map.addSource(CFG.SOURCE_ALL, {
        type: 'geojson',
        data: state.all
      });
    }

    if (!state.map.getSource(CFG.SOURCE_MATCHED)) {
      state.map.addSource(CFG.SOURCE_MATCHED, {
        type: 'geojson',
        data: state.matched
      });
    }

    if (!state.map.getSource(CFG.SOURCE_SELECTED)) {
      state.map.addSource(CFG.SOURCE_SELECTED, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!state.map.getLayer(CFG.LAYER_ALL)) {
      state.map.addLayer({
        id: CFG.LAYER_ALL,
        type: 'circle',
        source: CFG.SOURCE_ALL,
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#ff4d4d',
          'circle-opacity': [
            'case',
            ['==', ['get', 'visible'], 1], 0.88,
            0.0
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    if (!state.map.getLayer(CFG.LAYER_MATCHED)) {
      state.map.addLayer({
        id: CFG.LAYER_MATCHED,
        type: 'circle',
        source: CFG.SOURCE_MATCHED,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'fitScore'],
            0.0, 4.5,
            0.40, 5.5,
            0.70, 7.0,
            1.00, 8.4
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'fitScore'],
            0.0, CFG.COLORS.matched,
            0.75, CFG.COLORS.matched,
            1.0, CFG.COLORS.hot
          ],
          'circle-opacity': [
            'interpolate', ['linear'], ['get', 'fitScore'],
            0.0, 0.36,
            0.50, 0.65,
            1.00, 0.95
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    if (!state.map.getLayer(CFG.LAYER_SELECTED)) {
      state.map.addLayer({
        id: CFG.LAYER_SELECTED,
        type: 'circle',
        source: CFG.SOURCE_SELECTED,
        paint: {
          'circle-radius': 11,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': CFG.COLORS.selected,
          'circle-stroke-width': 2,
          'circle-opacity': 1
        }
      });
    }
  }

  function getScoredFeature(feature) {
    const bridge = getBridge();
    const p = feature.properties || {};
    const [lng, lat] = feature.geometry.coordinates;

    let geoid = cleanStr(p.geoid);
    if (!geoid && bridge) {
      geoid = bridge.resolveGeoidFromLngLat(lng, lat) || '';
    }

    const buildingCtx = bridge ? bridge.getBuildingContext(lng, lat) : null;
    const nearestBuilding = buildingCtx?.nearestBuilding || null;
    const context = geoid && bridge ? bridge.getContextForGeoid(geoid, nearestBuilding, p) : null;

    const tractPressure = clamp01(context?.row?.pressure_30d ?? 0);
    const tractOpportunity = clamp01(context?.row?.opportunity_30d ?? 0);
    const tractLabor = clamp01(context?.row?.structural_score ?? 0);
    const buildingPressure = clamp01(buildingCtx?.avgClearPressure ?? 0);

    const revenueNorm = normalizeLog(p.revenue || 0, 10000, 100000000);
    const employeesNorm = clamp01((num(p.employees, 0)) / 500);
    const pressureFit = 1 - Math.abs(buildingPressure - clamp01(state.ui.pressureTolerance));
    const tractFit = mix(tractOpportunity, 1 - tractPressure, 1 - clamp01(state.ui.opportunityBias));
    const scaleFit = mix(revenueNorm, employeesNorm, 0.65);

    const fitScore = clamp01(
      (pressureFit * 0.30) +
      (tractFit * 0.28) +
      (tractLabor * 0.20) +
      (scaleFit * 0.12) +
      ((geoid ? 1 : 0) * 0.10)
    );

    return {
      ...feature,
      properties: {
        ...p,
        geoid,
        fitScore,
        tractPressure,
        tractOpportunity,
        tractLabor,
        buildingPressure,
        visible: 1
      },
      _resolved: {
        geoid,
        context,
        buildingCtx,
        nearestBuilding
      }
    };
  }

  function passesUi(feature) {
    const p = feature.properties || {};
    const category = cleanStr(p.category || 'Unknown');
    const revenue = num(p.revenue, 0);
    const fitScore = num(p.fitScore, 0);

    if (state.ui.category !== 'ALL' && !sameCategory(category, state.ui.category)) return false;
    if (revenue < state.ui.minRevenue || revenue > state.ui.maxRevenue) return false;
    if (fitScore < state.ui.fitThreshold) return false;

    return true;
  }

  function setSourceData(sourceId, data) {
    const src = state.map.getSource(sourceId);
    if (src) src.setData(data);
  }

  function recomputeAndRender() {
    if (!state.all?.features?.length) {
      updateReadout();
      return;
    }

    const scored = state.all.features.map(getScoredFeature);

    const matched = scored
      .filter(passesUi)
      .sort((a, b) => num(b.properties.fitScore, 0) - num(a.properties.fitScore, 0))
      .slice(0, state.ui.topN);

    state.matched = {
      type: 'FeatureCollection',
      features: matched
    };

    const matchedIds = new Set(matched.map(f => cleanStr(f.id)));

    const ambient = {
      type: 'FeatureCollection',
      features: scored.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          visible: state.ui.showOnlyMatched ? (matchedIds.has(cleanStr(f.id)) ? 1 : 0) : 1
        }
      }))
    };

    setSourceData(CFG.SOURCE_ALL, ambient);
    setSourceData(CFG.SOURCE_MATCHED, state.matched);

    if (state.selectedFeature) {
      setSelectedFeature(state.selectedFeature);
    }

    updateReadout(matched);
  }

  function setSelectedFeature(feature) {
    state.selectedFeature = feature;
    setSourceData(CFG.SOURCE_SELECTED, {
      type: 'FeatureCollection',
      features: feature ? [feature] : []
    });
  }

  function updateReadout(matched = null) {
    const el = byId(CFG.READOUT_ID);
    if (!el) return;

    if (state.selectedFeature) {
      const p = state.selectedFeature.properties || {};
      el.innerHTML = `
        <div class="np-cardTitle">${escapeHtml(p.org_name || 'Unknown')}</div>
        <div>${escapeHtml(p.category || 'Unknown')} · ${fmtMoneyShort(p.revenue || 0)}</div>
        <div>${escapeHtml(p.address || '')}</div>
        <div class="np-grid">
          <div class="np-chip">
            <div class="k">Fit</div>
            <div class="v">${fmtPct01(p.fitScore)}</div>
          </div>
          <div class="np-chip">
            <div class="k">Tract</div>
            <div class="v">${escapeHtml(p.geoid || '—')}</div>
          </div>
          <div class="np-chip">
            <div class="k">Bldg Press</div>
            <div class="v">${fmtPct01(p.buildingPressure)}</div>
          </div>
          <div class="np-chip">
            <div class="k">Labor</div>
            <div class="v">${fmtPct01(p.tractLabor)}</div>
          </div>
          <div class="np-chip">
            <div class="k">Opportunity</div>
            <div class="v">${fmtPct01(p.tractOpportunity)}</div>
          </div>
          <div class="np-chip">
            <div class="k">Pressure</div>
            <div class="v">${fmtPct01(p.tractPressure)}</div>
          </div>
        </div>
      `;
      return;
    }

    const total = state.all?.features?.length || 0;
    const shown = matched ? matched.length : 0;
    const top = shown ? matched[0].properties : null;
    const avgFit = shown
      ? matched.reduce((a, f) => a + num(f.properties.fitScore, 0), 0) / shown
      : 0;

    el.innerHTML = `
      ${shown} / ${total} nonprofits surfaced<br/>
      Avg fit ${fmtPct01(avgFit)}
      ${top ? `<br/><br/><b>Top surfaced</b><br/>${escapeHtml(top.org_name)}<br/>${escapeHtml(top.category)} · ${fmtMoneyShort(top.revenue)} · ${fmtPct01(top.fitScore)}` : ''}
    `;
  }

  function resolveMatchedFeatureById(id) {
    return state.matched.features.find(f => cleanStr(f.id) === cleanStr(id)) || null;
  }

  function handleNonprofitClick(feature) {
    const bridge = getBridge();
    if (!bridge) return;

    const p = feature.properties || {};
    const [lng, lat] = feature.geometry.coordinates;
    const geoid = cleanStr(p.geoid) || bridge.resolveGeoidFromLngLat(lng, lat);

    if (!geoid) {
      console.warn('[nonprofit_overlay] no geoid could be resolved for nonprofit');
      return;
    }

    const buildingCtx = bridge.getBuildingContext(lng, lat);
    const nearestBuilding = buildingCtx?.nearestBuilding || null;

    setSelectedFeature(feature);

    bridge.focusNonprofitSelection({
      nonprofit: {
        ...p,
        id: cleanStr(feature.id),
        fitScore: num(p.fitScore, 0),
        tractPressure: num(p.tractPressure, 0),
        tractOpportunity: num(p.tractOpportunity, 0),
        tractLabor: num(p.tractLabor, 0),
        buildingPressure: num(p.buildingPressure, 0)
      },
      geoid,
      building: nearestBuilding
    });
  }

  function attachMapEvents() {
    state.map.on('mouseenter', CFG.LAYER_MATCHED, () => {
      state.map.getCanvas().style.cursor = 'pointer';
    });

    state.map.on('mouseleave', CFG.LAYER_MATCHED, () => {
      state.map.getCanvas().style.cursor = '';
    });

    state.map.on('click', CFG.LAYER_MATCHED, e => {
      const feature = e.features?.[0];
      if (!feature) return;
      handleNonprofitClick(feature);
    });

    state.map.on('click', CFG.LAYER_ALL, e => {
      const feature = e.features?.[0];
      if (!feature) return;
      handleNonprofitClick(feature);
    });
  }

  async function boot() {
    const bridge = await waitForBridge();
    state.map = bridge.map;

    ensurePanel();
    wirePanel();
    await loadData();

    if (state.map.isStyleLoaded()) {
      ensureSourcesAndLayers();
    } else {
      await new Promise(resolve => state.map.once('idle', resolve));
      ensureSourcesAndLayers();
    }

    recomputeAndRender();
    attachMapEvents();

    bridge.refreshNonprofitOverlay = () => {
      recomputeAndRender();
    };

    bridge.reselectActiveNonprofit = () => {
      const id = bridge.getSelectedNonprofitId?.();
      if (!id) return;
      const f = resolveMatchedFeatureById(id) || state.all.features.find(x => cleanStr(x.id) === cleanStr(id));
      if (f) {
        const rescored = getScoredFeature(f);
        handleNonprofitClick(rescored);
      }
    };

    state.booted = true;
    console.log('[nonprofit_overlay] ready');
  }

  boot().catch(err => {
    console.error('[nonprofit_overlay] boot failure', err);
    const el = byId(CFG.READOUT_ID);
    if (el) el.textContent = `Overlay failure: ${err.message}`;
  });
})();