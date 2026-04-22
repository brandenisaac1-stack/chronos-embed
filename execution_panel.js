(() => {
  'use strict';

  if (window.__CHRONOS_EXECUTION_PANEL_RUNNING__) return;
  window.__CHRONOS_EXECUTION_PANEL_RUNNING__ = true;

  const ROOT_ID = 'executionMount';
  const STYLE_ID = 'chronosExecutionPanelStylesFinalDominance';

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(v, fallback = '') {
    const s = String(v ?? '').trim();
    return s || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function compact(value) {
    return safeText(value).replace(/\s+/g, ' ').trim();
  }

  function sentence(value, fallback = '') {
    const s = compact(value || fallback);
    if (!s) return '';
    return /[.!?]$/.test(s) ? s : `${s}.`;
  }

  function clip(value, max = 180) {
    const s = compact(value);
    if (!s || s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 48 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }

  function num(v, fallback = null) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v ?? '')
      .replace(/,/g, '')
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .trim();
    if (!s) return fallback;
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmt(v, fallback = '—') {
    const n = num(v, null);
    if (n == null) return fallback;
    return String(Math.round(n));
  }

  function fmtPct(v, fallback = '—') {
    const n = num(v, null);
    if (n == null) return fallback;
    return `${Math.round(n)}%`;
  }

  function fmtDays(v, fallback = '—') {
    const n = num(v, null);
    if (n == null) return fallback;
    return `${Math.round(n)}D`;
  }

  function parse(text) {
    const map = {};
    String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => {
        const i = line.indexOf(':');
        if (i === -1) return;
        const key = line.slice(0, i).trim().toUpperCase();
        const value = line.slice(i + 1).trim();
        if (value) map[key] = value;
      });
    return map;
  }

  function pick(map, keys, fallback = '') {
    for (const key of keys) {
      if (map[key]) return map[key];
    }
    return fallback;
  }

  function inferHeading(text, fallback) {
    const s = compact(text).toUpperCase();
    if (!s) return fallback;
    if (s.includes('HOLD') || s.includes('DISCIPLINE') || s.includes('DENY')) return 'HOLD LINE';
    if (s.includes('DELAY') || s.includes('PRESS') || s.includes('FORCE')) return 'FORCE REACTION';
    if (s.includes('LEVERAGE') || s.includes('ENGAGE') || s.includes('ACTION')) return 'COMMAND ACTION';
    if (s.includes('WINDOW')) return 'WINDOW CONTROL';
    if (s.includes('BIAS')) return 'EXECUTION BIAS';
    if (s.includes('STRIKE') || s.includes('TRAP')) return 'PREPARE TO STRIKE';
    return fallback;
  }

  function toneFromMetrics(payload) {
    const labor = num(payload?.tract_intelligence?.labor_physics_pressure, null);
    const clear =
      num(payload?.building_consequence?.clear_pressure, null) ??
      num(payload?.building?.clear_pressure_index, null) ??
      num(payload?.building?.clear_pressure, null);

    const primary = clear != null ? clear * 5 : labor;

    if ((clear != null && clear >= 15) || (primary != null && primary >= 75)) {
      return {
        name: 'RED FIELD',
        code: 'red',
        accent: '#ff7f73',
        accentDim: 'rgba(255,127,115,.72)',
        accentGlow: 'rgba(255,127,115,.22)',
        doctrine: 'Compressed field // execution now'
      };
    }

    if ((clear != null && clear >= 6) || (primary != null && primary >= 45)) {
      return {
        name: 'AMBER FIELD',
        code: 'amber',
        accent: '#f1b65f',
        accentDim: 'rgba(241,182,95,.76)',
        accentGlow: 'rgba(241,182,95,.20)',
        doctrine: 'Active field // pressure tradable'
      };
    }

    return {
      name: 'CYAN FIELD',
      code: 'cyan',
      accent: '#7dddf6',
      accentDim: 'rgba(125,221,246,.74)',
      accentGlow: 'rgba(125,221,246,.18)',
      doctrine: 'Stable field // shape optionality'
    };
  }

  function buildSummary(payload) {
    const map = parse(
      safeText(
        payload?.building_consequence?.negotiation_posture ||
        payload?.building?.Negotiation_Posture ||
        payload?.building?.negotiation_posture ||
        ''
      )
    );

    const tract = payload?.tract_intelligence || {};
    const command = payload?.command || {};
    const building = payload?.building || {};
    const buildingConsequence = payload?.building_consequence || {};
    const selection = payload?.selection || {};

    const regime =
      pick(map, ['REGIME'], '') ||
      safeText(command?.signal_regime || tract?.signal_regime || tract?.dominant_force, 'Pressure Field Active');

    const geoid = safeText(selection?.geoid || tract?.geoid || command?.geoid, '—');

    const owner = pick(map, ['OWNER']);
    const tenant = pick(map, ['TENANT']);
    const broker = pick(map, ['BROKER']);
    const space = pick(map, ['SPACE']);
    const buildingText = pick(map, ['BLDG', 'BUILDING']);
    const labor = pick(map, ['LABOR']) || sentence(command?.dominant_force || tract?.dominant_force || '', '');
    const access = pick(map, ['ACCESS']) || sentence(command?.commute_access_score ? `Commute access ${command.commute_access_score}` : '', '');
    const industry = pick(map, ['INDUSTRY']) || sentence(tract?.top_industries?.[0]?.label || command?.top_industry1_label || '', '');
    const tractText = pick(map, ['TRACT']) || sentence(tract?.tract_brief || '', '');
    const doctrine = pick(map, ['DOCTRINE'], '') || safeText(building?.execution_bias || buildingConsequence?.execution_bias || '', '') || 'Prepare to Strike. Build the Trap.';

    const laborScore = fmt(tract?.labor_physics_pressure);
    const clearPressure = num(buildingConsequence?.clear_pressure, null) ?? num(building?.clear_pressure_index, null) ?? num(building?.clear_pressure, null);
    const posture = num(buildingConsequence?.posture_score, null) ?? num(building?.building_posture_score, null) ?? num(building?.posture_score, null);
    const execDays = num(buildingConsequence?.execution?.days, null) ?? num(building?.capture_window_days, null);

    return {
      regime: regime.replace(/\s*\|\s*/g, ' // '),
      geoid,
      laborScore,
      clearPressureDisplay: clearPressure == null ? '—' : String(Math.round(clearPressure)),
      postureDisplay: posture == null ? '—' : String(Math.round(posture)),
      execDaysDisplay: execDays == null ? '—' : fmtDays(execDays),

      leftTopHeading: 'Operator Posture',
      leftTopTitle: 'Owner // Tenant // Broker',
      leftTopBody: clip(
        sentence([owner, tenant, broker].filter(Boolean).join(' '), 'Operator posture unresolved.'),
        150
      ),

      leftBottomHeading: 'Owner Bias',
      leftBottomTitle: inferHeading(owner, 'HOLD LINE'),
      leftBottomBody: clip(sentence(owner, 'Owner posture unresolved.'), 96),

      rightTopHeading: 'Field Condition',
      rightTopTitle: 'Labor // Access // Industry',
      rightTopBody: clip(
        sentence([labor, access, industry, tractText].filter(Boolean).join(' '), 'Field condition unresolved.'),
        150
      ),

      rightBottomHeading: 'Broker Posture',
      rightBottomTitle: inferHeading(broker, 'COMMAND ACTION'),
      rightBottomBody: clip(sentence(broker, 'Broker posture unresolved.'), 96),

      lowerLeftHeading: 'Tenant Bias',
      lowerLeftTitle: inferHeading(tenant, 'FORCE REACTION'),
      lowerLeftBody: clip(sentence(tenant, 'Tenant posture unresolved.'), 96),

      lowerRightHeading: 'Spatial Condition',
      lowerRightTitle: 'Space // Building // Tract',
      lowerRightBody: clip(
        sentence(
          [
            space,
            buildingText,
            tractText,
            clearPressure != null ? `Clear pressure active ${Math.round(clearPressure)}` : ''
          ].filter(Boolean).join(' '),
          'Spatial condition unresolved.'
        ),
        122
      ),

      doctrine: clip(doctrine, 94)
    };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        --exec-bg-0: #01060a;
        --exec-bg-1: #020911;
        --exec-bg-2: #041019;
        --exec-line: rgba(134, 196, 220, 0.10);
        --exec-line-soft: rgba(134, 196, 220, 0.06);
        --exec-line-strong: rgba(162, 222, 245, 0.18);
        --exec-cyan: #d9f4fb;
        --exec-cyan-dim: rgba(150, 194, 208, 0.58);
        --exec-text: rgba(230, 238, 241, 0.94);
        --exec-text-dim: rgba(197, 214, 221, 0.74);
        --exec-text-faint: rgba(160, 186, 196, 0.50);
        --exec-amber: rgba(241, 182, 95, 0.94);
        --exec-amber-dim: rgba(241, 182, 95, 0.74);
        --exec-green: rgba(145, 211, 187, 0.90);
        --exec-green-dim: rgba(145, 211, 187, 0.70);

        position: relative;
        width: 100%;
        height: 100%;
        min-height: clamp(228px, 19.2vh, 298px);
        max-height: clamp(228px, 20.4vh, 310px);
        overflow: hidden;
        border-top: 1px solid rgba(124, 194, 218, 0.10);
        background:
          radial-gradient(620px 160px at 50% 44%, rgba(68, 146, 174, 0.075), transparent 58%),
          radial-gradient(420px 100px at 50% 89%, rgba(210, 158, 88, 0.030), transparent 65%),
          linear-gradient(180deg, #02070b 0%, #030911 42%, #030a12 100%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.018),
          inset 0 18px 36px rgba(0,0,0,0.24),
          inset 0 -28px 44px rgba(0,0,0,0.30);
      }

      #${ROOT_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          repeating-linear-gradient(
            180deg,
            rgba(132, 199, 224, 0.018) 0px,
            rgba(132, 199, 224, 0.018) 1px,
            transparent 1px,
            transparent 18px
          );
        opacity: 0.22;
      }

      #${ROOT_ID}::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(
            90deg,
            rgba(0,0,0,0.38) 0%,
            rgba(0,0,0,0.06) 14%,
            transparent 50%,
            rgba(0,0,0,0.06) 86%,
            rgba(0,0,0,0.38) 100%
          );
      }

      #${ROOT_ID} .execShell {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-rows: auto auto 1fr auto auto;
        height: 100%;
        padding: 8px 12px 8px;
        gap: 7px;
      }

      #${ROOT_ID} .execTop {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: end;
      }

      #${ROOT_ID} .execTitleWrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      #${ROOT_ID} .execEyebrow {
        font-size: 6px;
        line-height: 1;
        letter-spacing: 0.34em;
        text-transform: uppercase;
        color: var(--exec-cyan-dim);
      }

      #${ROOT_ID} .execTitle {
        font-size: 13px;
        line-height: 0.98;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 800;
        color: var(--exec-cyan);
        text-shadow:
          0 0 10px rgba(110, 205, 236, 0.08),
          0 0 1px rgba(255,255,255,0.10);
      }

      #${ROOT_ID} .execSubtitle {
        font-size: 6px;
        line-height: 1.1;
        letter-spacing: 0.20em;
        text-transform: uppercase;
        color: var(--exec-text-faint);
      }

      #${ROOT_ID} .execStatus {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        min-height: 18px;
        border: 1px solid rgba(140, 208, 231, 0.12);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%, 0 8px);
        background: linear-gradient(180deg, rgba(6, 17, 25, 0.90), rgba(4, 10, 16, 0.96));
      }

      #${ROOT_ID} .execStatusDot {
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: rgba(150, 222, 246, 0.95);
        box-shadow: 0 0 8px rgba(150, 222, 246, 0.28);
        animation: chronosExecPulse 1.8s ease-in-out infinite;
      }

      @keyframes chronosExecPulse {
        0%, 100% { opacity: 0.45; transform: scale(0.90); }
        50% { opacity: 1; transform: scale(1); }
      }

      #${ROOT_ID} .execStatusText {
        font-size: 6px;
        line-height: 1;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(216, 235, 242, 0.86);
        white-space: nowrap;
      }

      #${ROOT_ID} .execRegimeRail,
      #${ROOT_ID} .execDoctrineRail {
        position: relative;
        display: grid;
        gap: 7px;
      }

      #${ROOT_ID} .execRegimeRail {
        grid-template-columns: 96px 1fr;
        min-height: 20px;
      }

      #${ROOT_ID} .execDoctrineRail {
        grid-template-columns: 118px 1fr;
        min-height: 24px;
      }

      #${ROOT_ID} .execRailTag,
      #${ROOT_ID} .execRailBody,
      #${ROOT_ID} .execDoctrineTag,
      #${ROOT_ID} .execDoctrineBody {
        position: relative;
        display: flex;
        align-items: center;
        overflow: hidden;
        border: 1px solid rgba(140, 205, 228, 0.09);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%, 0 8px);
        background:
          linear-gradient(180deg, rgba(6, 16, 24, 0.88), rgba(4, 10, 16, 0.95));
      }

      #${ROOT_ID} .execRailTag::before,
      #${ROOT_ID} .execRailBody::before,
      #${ROOT_ID} .execDoctrineTag::before,
      #${ROOT_ID} .execDoctrineBody::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      #${ROOT_ID} .execRailTag::before,
      #${ROOT_ID} .execRailBody::before {
        background:
          linear-gradient(
            90deg,
            rgba(240, 180, 94, 0.10) 0%,
            rgba(240, 180, 94, 0.02) 20%,
            transparent 55%,
            rgba(130, 207, 233, 0.04) 100%
          );
      }

      #${ROOT_ID} .execDoctrineTag,
      #${ROOT_ID} .execDoctrineBody {
        border-color: rgba(240, 180, 94, 0.14);
        background:
          linear-gradient(180deg, rgba(8, 15, 20, 0.90), rgba(5, 9, 13, 0.96));
      }

      #${ROOT_ID} .execDoctrineTag::before,
      #${ROOT_ID} .execDoctrineBody::before {
        background:
          linear-gradient(
            90deg,
            rgba(240, 180, 94, 0.12) 0%,
            rgba(240, 180, 94, 0.03) 20%,
            transparent 60%,
            rgba(130, 207, 233, 0.02) 100%
          );
      }

      #${ROOT_ID} .execRailTag,
      #${ROOT_ID} .execDoctrineTag {
        padding: 0 8px;
      }

      #${ROOT_ID} .execRailBody,
      #${ROOT_ID} .execDoctrineBody {
        padding: 0 10px;
      }

      #${ROOT_ID} .execRailLabel,
      #${ROOT_ID} .execDoctrineKicker {
        position: relative;
        z-index: 1;
        font-size: 6px;
        line-height: 1;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }

      #${ROOT_ID} .execRailLabel {
        color: var(--exec-amber-dim);
      }

      #${ROOT_ID} .execDoctrineKicker {
        color: rgba(240, 190, 118, 0.94);
      }

      #${ROOT_ID} .execRailText {
        position: relative;
        z-index: 1;
        font-size: 7px;
        line-height: 1.05;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(232, 241, 245, 0.90);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .execDoctrineText {
        position: relative;
        z-index: 1;
        font-size: 11px;
        line-height: 0.98;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 900;
        color: rgba(245, 186, 96, 0.98);
        text-shadow:
          0 0 10px rgba(240, 180, 94, 0.10),
          0 0 1px rgba(255,255,255,0.08);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .execCore {
        position: relative;
        display: grid;
        grid-template-columns: minmax(176px, 1fr) minmax(300px, 1.16fr) minmax(176px, 1fr);
        gap: 10px;
        align-items: stretch;
        min-height: 0;
      }

      #${ROOT_ID} .execCoreLower {
        grid-template-columns: minmax(176px, 1fr) minmax(300px, 1.16fr) minmax(176px, 1fr) !important;
        min-height: auto;
      }

      #${ROOT_ID} .execColumn {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 6px;
  min-height: 0;
  min-width: 0;
}

      #${ROOT_ID} .execCenter {
  position: relative;
  min-height: 96px;
  max-height: 96px;
  border: 1px solid rgba(143, 208, 231, 0.10);
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
  background:
    radial-gradient(circle at 50% 50%, rgba(86, 197, 232, 0.028), transparent 28%),
    linear-gradient(180deg, rgba(4, 11, 18, 0.92), rgba(2, 7, 12, 0.98));
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.015),
    inset 0 0 30px rgba(0,0,0,0.24);
}

      #${ROOT_ID} .execCenter::before {
        content: "";
        position: absolute;
        inset: 8px;
        border: 1px solid rgba(136, 203, 228, 0.05);
        clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
        pointer-events: none;
      }

      #${ROOT_ID} .execCenter::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.015), transparent 22%, transparent 78%, rgba(0,0,0,0.20)),
          linear-gradient(90deg, rgba(0,0,0,0.18), transparent 18%, transparent 82%, rgba(0,0,0,0.18));
      }

      #${ROOT_ID} .execCenterTopLabel,
      #${ROOT_ID} .execCenterBottomLabel {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        padding: 0 10px;
        font-size: 6px;
        line-height: 1;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(220, 233, 238, 0.82);
        white-space: nowrap;
        text-shadow: 0 0 8px rgba(150, 220, 243, 0.08);
        pointer-events: none;
      }

      #${ROOT_ID} .execCenterTopLabel { top: 7px; }
      #${ROOT_ID} .execCenterBottomLabel { bottom: 7px; }

      #${ROOT_ID} .execCenterRuleTop,
      #${ROOT_ID} .execCenterRuleBottom {
        position: absolute;
        left: 16%;
        right: 16%;
        height: 1px;
        z-index: 3;
        background:
          linear-gradient(
            90deg,
            transparent 0%,
            rgba(160, 221, 243, 0.08) 18%,
            rgba(240, 180, 94, 0.10) 50%,
            rgba(160, 221, 243, 0.08) 82%,
            transparent 100%
          );
        pointer-events: none;
      }

      #${ROOT_ID} .execCenterRuleTop { top: 11px; }
      #${ROOT_ID} .execCenterRuleBottom { bottom: 11px; }

      #${ROOT_ID} .execCenterAxisX,
      #${ROOT_ID} .execCenterAxisY {
        position: absolute;
        z-index: 2;
        pointer-events: none;
        opacity: 0.16;
      }

      #${ROOT_ID} .execCenterAxisX {
        left: 12%;
        right: 12%;
        bottom: 23%;
        height: 1px;
        background: linear-gradient(90deg, transparent 0%, rgba(150,210,232,0.32) 18%, rgba(150,210,232,0.32) 82%, transparent 100%);
      }

      #${ROOT_ID} .execCenterAxisY {
        top: 18%;
        bottom: 18%;
        left: 50%;
        width: 1px;
        transform: translateX(-50%);
        background: linear-gradient(180deg, transparent 0%, rgba(150,210,232,0.18) 18%, rgba(150,210,232,0.18) 82%, transparent 100%);
      }

      #${ROOT_ID} .execMetricChip {
  min-width: 0;
  border: 1px solid rgba(140, 205, 228, 0.08);
  background: rgba(3,10,16,0.46);
  padding: 5px 7px;
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%, 0 6px);
}

      #${ROOT_ID} .execMetricChip {
        min-width: 0;
        border: 1px solid rgba(140, 205, 228, 0.08);
        background: rgba(3,10,16,0.46);
        padding: 5px 7px;
        clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%, 0 6px);
      }

      #${ROOT_ID} .execMetricChipKicker {
        font-size: 5px;
        line-height: 1;
        letter-spacing: 0.20em;
        text-transform: uppercase;
        color: rgba(160, 186, 196, 0.60);
        margin-bottom: 4px;
      }

      #${ROOT_ID} .execMetricChipVal {
        font-size: 9px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(236,245,248,0.96);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .execMetricChipValAmber { color: rgba(245,186,96,0.98); }
      #${ROOT_ID} .execMetricChipValCyan { color: rgba(125,221,246,0.98); }
      #${ROOT_ID} .execMetricChipValRed { color: rgba(255,127,115,0.98); }

      #${ROOT_ID} .execCanvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
      }

      #${ROOT_ID} .execPanel {
        position: relative;
        min-height: 58px;
        border: 1px solid rgba(137, 204, 228, 0.08);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%, 0 8px);
        background:
          linear-gradient(180deg, rgba(5, 14, 21, 0.86), rgba(3, 9, 14, 0.95));
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.02),
          inset 0 -14px 24px rgba(0,0,0,0.14);
        overflow: hidden;
      }

      #${ROOT_ID} .execPanel::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 1px;
        background: var(--panel-accent, rgba(130, 207, 233, 0.40));
        opacity: 0.92;
      }

      #${ROOT_ID} .execPanel::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(90deg, var(--panel-glow, rgba(130, 207, 233, 0.04)) 0%, transparent 46%, transparent 100%);
      }

      #${ROOT_ID} .execPanelAmber {
        --panel-accent: rgba(240, 180, 94, 0.58);
        --panel-glow: rgba(240, 180, 94, 0.05);
      }

      #${ROOT_ID} .execPanelCyan {
        --panel-accent: rgba(130, 207, 233, 0.54);
        --panel-glow: rgba(130, 207, 233, 0.04);
      }

      #${ROOT_ID} .execPanelGreen {
        --panel-accent: rgba(143, 212, 187, 0.54);
        --panel-glow: rgba(143, 212, 187, 0.04);
      }

      #${ROOT_ID} .execPanelInner {
  position: relative;
  z-index: 1;
  padding: 7px 8px 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

      #${ROOT_ID} .execPanelKicker {
        font-size: 6px;
        line-height: 1;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(182, 207, 217, 0.60);
      }

      #${ROOT_ID} .execPanelTitle {
        font-size: 9px;
        line-height: 1.0;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 800;
        color: rgba(238, 245, 248, 0.96);
      }

      #${ROOT_ID} .execPanelBody {
  font-size: 7px;
  line-height: 1.24;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: rgba(226, 236, 240, 0.90);
  word-break: break-word;
}

      #${ROOT_ID} .execFooter {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding-top: 4px;
        border-top: 1px solid rgba(136, 203, 228, 0.06);
      }

      #${ROOT_ID} .execFooterText {
        font-size: 5px;
        line-height: 1;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(161, 189, 199, 0.42);
        white-space: nowrap;
      }

      #${ROOT_ID} .execIdle {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 8px;
      }

      #${ROOT_ID} .execIdleBody {
        min-height: 112px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(136, 203, 228, 0.08);
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%, 0 8px);
        background: linear-gradient(180deg, rgba(4, 12, 18, 0.92), rgba(3, 8, 13, 0.97));
        font-size: 8px;
        line-height: 1.45;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(200, 218, 225, 0.74);
        padding: 14px;
        text-align: center;
      }

      @media (max-width: 1180px) {
        #${ROOT_ID} {
          min-height: 300px;
          max-height: none;
        }

        #${ROOT_ID} .execShell {
          grid-template-rows: auto auto auto auto auto auto;
        }

        #${ROOT_ID} .execCore,
        #${ROOT_ID} .execCoreLower {
          grid-template-columns: 1fr !important;
        }

        #${ROOT_ID} .execColumn {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: none;
        }

        #${ROOT_ID} .execCenter {
          min-height: 190px;
          order: -1;
        }

        #${ROOT_ID} .execCenterMetricRail {
          top: 28px;
        }

        #${ROOT_ID} .execRegimeRail,
        #${ROOT_ID} .execDoctrineRail {
          grid-template-columns: 1fr;
        }

        #${ROOT_ID} .execRailText,
        #${ROOT_ID} .execDoctrineText {
          white-space: normal;
        }
      }

      @media (max-width: 760px) {
        #${ROOT_ID} {
          min-height: 440px;
        }

        #${ROOT_ID} .execTop {
          grid-template-columns: 1fr;
        }

        #${ROOT_ID} .execColumn {
          grid-template-columns: 1fr;
        }

        #${ROOT_ID} .execFooter {
          flex-direction: column;
          align-items: flex-start;
        }

        #${ROOT_ID} .execFooterText {
          white-space: normal;
          line-height: 1.3;
        }

        #${ROOT_ID} .execCenterMetricRail {
          grid-template-columns: 1fr;
          top: 24px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initHysteresis(canvas, options = {}) {
    if (!canvas) return () => {};

    const gl =
      canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
      canvas.getContext('experimental-webgl', { antialias: true, alpha: true, premultipliedAlpha: true });

    if (!gl) return () => {};

    const cfg = {
      p1x: options.p1x ?? 0.438,
      p1y: options.p1y ?? 0.60,
      p1h: options.p1h ?? 1.9,
      p1s: options.p1s ?? 22.0,
      p2x: options.p2x ?? 0.562,
      p2y: options.p2y ?? 0.545,
      p2h: options.p2h ?? 1.58,
      p2s: options.p2s ?? 22.8,
      saddleX: options.saddleX ?? 0.502,
      saddleY: options.saddleY ?? 0.59,
      saddleH: options.saddleH ?? 0.44,
      saddleS: options.saddleS ?? 12.0,
      amber: options.amber ?? 1.0,
      red: options.red ?? 0.0
    };

    const vertexSrc = `
      attribute vec2 a_pos;
      varying vec2 v_uv;

      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const fragmentSrc = `
      precision mediump float;

      varying vec2 v_uv;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec4 u_peak1;
      uniform vec4 u_peak2;
      uniform vec4 u_saddle;
      uniform float u_amber;
      uniform float u_red;

      float gauss(vec2 p, vec2 c, float h, float spread) {
        float d = distance(p, c);
        return h * exp(-d * spread);
      }

      float lineMask(float v, float width) {
        return smoothstep(width, 0.0, abs(v));
      }

      void main() {
        vec2 uv = v_uv;

        vec2 p = uv;
        p.x = (p.x - 0.5) * 1.48 + 0.5;
        p.y = (p.y - 0.61) * 0.84 + 0.61;

        float t = u_time;

        vec2 c1 = vec2(
          u_peak1.x + sin(t * 0.16) * 0.003,
          u_peak1.y + sin(t * 0.11) * 0.002
        );

        vec2 c2 = vec2(
          u_peak2.x + cos(t * 0.14) * 0.003,
          u_peak2.y + cos(t * 0.09) * 0.002
        );

        float h1 = gauss(p, c1, u_peak1.z, u_peak1.w);
        float h2 = gauss(p, c2, u_peak2.z, u_peak2.w);
        float hs = gauss(p, vec2(u_saddle.x, u_saddle.y), u_saddle.z, u_saddle.w);

        float baseShelf = gauss(p, vec2(0.50, 0.73), 0.28, 4.8);
        float floorTilt = smoothstep(0.95, 0.18, abs(p.y - 0.73)) * 0.05;

        float field = h1 + h2 + hs + baseShelf + floorTilt;

        float contourFreq = 16.0;
        float contourRaw = abs(fract(field * contourFreq) - 0.5);
        float contour = smoothstep(0.492, 0.499, contourRaw);

        float gx = abs(fract((uv.x * 18.0) + (uv.y * 1.5)) - 0.5);
        float gy = abs(fract((uv.y * 11.0)) - 0.5);

        float gridX = smoothstep(0.496, 0.499, gx) * 0.10;
        float gridY = smoothstep(0.496, 0.499, gy) * 0.08;
        float grid = gridX + gridY;

        float axisX = lineMask(uv.y - 0.77, 0.003) * 0.28;
        float axisY = lineMask(uv.x - 0.50, 0.0025) * 0.10;
        float horizon = lineMask(uv.y - 0.30, 0.002) * 0.10;

        float low = smoothstep(0.02, 0.46, field);
        float mid = smoothstep(0.18, 0.98, field);
        float hot = smoothstep(0.88, 1.70, field);

        vec3 deep = vec3(0.00, 0.05, 0.08);
        vec3 cyan = vec3(0.32, 0.88, 0.98);
        vec3 aqua = vec3(0.70, 0.97, 0.94);
        vec3 amber = vec3(1.00, 0.73, 0.22);
        vec3 red = vec3(1.00, 0.48, 0.40);
        vec3 whiteTop = vec3(0.96, 0.99, 1.00);

        vec3 color = mix(deep, cyan, low);
        color = mix(color, aqua, mid * 0.56);
        color = mix(color, amber, hot * 0.84 * u_amber);
        color = mix(color, red, hot * 0.42 * u_red);
        color = mix(color, whiteTop, hot * 0.18);

        color += contour * vec3(0.16, 0.42, 0.54);
        color += contour * hot * vec3(0.50, 0.30, 0.08 + 0.18 * u_red);
        color += grid * vec3(0.10, 0.20, 0.24);
        color += axisX * vec3(0.16, 0.30, 0.34);
        color += axisY * vec3(0.08, 0.18, 0.22);
        color += horizon * vec3(0.10, 0.20, 0.24);

        float fadeX = smoothstep(0.05, 0.17, uv.x) * (1.0 - smoothstep(0.83, 0.95, uv.x));
        float fadeY = smoothstep(0.10, 0.24, uv.y) * (1.0 - smoothstep(0.84, 0.98, uv.y));
        float mask = fadeX * fadeY;

        float floorGlow = smoothstep(0.10, 0.82, field) * 0.10;
        vec3 finalColor = color + floorGlow;
        float alpha = (0.05 + field * 0.24 + contour * 0.10 + grid * 0.06 + axisX * 0.05) * mask;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    function compile(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) return () => {};

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return () => {};
    }

    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
      ]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uPeak1 = gl.getUniformLocation(program, 'u_peak1');
    const uPeak2 = gl.getUniformLocation(program, 'u_peak2');
    const uSaddle = gl.getUniformLocation(program, 'u_saddle');
    const uAmber = gl.getUniformLocation(program, 'u_amber');
    const uRed = gl.getUniformLocation(program, 'u_red');

    let raf = 0;
    let disposed = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function frame(ms) {
      if (disposed) return;

      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, ms * 0.001);
      gl.uniform4f(uPeak1, cfg.p1x, cfg.p1y, cfg.p1h, cfg.p1s);
      gl.uniform4f(uPeak2, cfg.p2x, cfg.p2y, cfg.p2h, cfg.p2s);
      gl.uniform4f(uSaddle, cfg.saddleX, cfg.saddleY, cfg.saddleH, cfg.saddleS);
      gl.uniform1f(uAmber, cfg.amber);
      gl.uniform1f(uRed, cfg.red);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => resize();
    window.addEventListener('resize', onResize, { passive: true });
    raf = requestAnimationFrame(frame);

    return function destroy() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      try {
        gl.deleteBuffer(quad);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
      } catch (_) {}
    };
  }

  let destroyField = null;

  function panel(variant, kicker, title, body) {
    return `
      <div class="execPanel ${variant}">
        <div class="execPanelInner">
          <div class="execPanelKicker">${escapeHtml(kicker)}</div>
          <div class="execPanelTitle">${escapeHtml(title)}</div>
          <div class="execPanelBody">${escapeHtml(body)}</div>
        </div>
      </div>
    `;
  }

  function renderIdle(root) {
    if (destroyField) {
      destroyField();
      destroyField = null;
    }

    root.innerHTML = `
      <div class="execShell">
        <div class="execTop">
          <div class="execTitleWrap">
            <div class="execEyebrow">ChronOS // execution brief</div>
            <div class="execTitle">Street-Level Decision Doctrine</div>
            <div class="execSubtitle">Embedded command view // negotiated pressure synthesis</div>
          </div>
          <div class="execStatus">
            <div class="execStatusDot"></div>
            <div class="execStatusText">Awaiting target lock</div>
          </div>
        </div>

        <div class="execIdle">
          <div class="execIdleBody">
            Resolve subject lock to open live hysteresis field, command rails, and final execution doctrine.
          </div>
        </div>
      </div>
    `;
  }

  function render(payload) {
    const root = byId(ROOT_ID);
    if (!root) return;

    injectStyles();

    const text = safeText(
      payload?.building_consequence?.negotiation_posture ||
      payload?.building?.Negotiation_Posture ||
      payload?.building?.negotiation_posture ||
      ''
    );

    if (!text) {
      renderIdle(root);
      return;
    }

    const s = buildSummary(payload);
    const tone = toneFromMetrics(payload);

    root.innerHTML = `
      <div class="execShell">
        <div class="execTop">
          <div class="execTitleWrap">
            <div class="execEyebrow">ChronOS // execution brief</div>
            <div class="execTitle">Street-Level Decision Doctrine</div>
            <div class="execSubtitle">Embedded command view // negotiated pressure synthesis</div>
          </div>
          <div class="execStatus">
            <div class="execStatusDot"></div>
            <div class="execStatusText">Live doctrine feed // ${escapeHtml(tone.name)}</div>
          </div>
        </div>

        <div class="execRegimeRail">
          <div class="execRailTag">
            <div class="execRailLabel">Operating Regime</div>
          </div>
          <div class="execRailBody">
            <div class="execRailText">LABOR SHOCK REGIME // GEOID: ${escapeHtml(s.geoid)} // PRESSURE: ACTIVE</div>
          </div>
        </div>

        <div class="execCore">
          <div class="execColumn execColumnLeft">
            ${panel('execPanelAmber', s.leftTopHeading, s.leftTopTitle, s.leftTopBody)}
            ${panel('execPanelAmber', s.leftBottomHeading, s.leftBottomTitle, s.leftBottomBody)}
          </div>

          <div class="execCenter">
            <div class="execCenterMetricRail">
              <div class="execMetricChip">
                <div class="execMetricChipKicker">Labor Pressure</div>
                <div class="execMetricChipVal execMetricChipValAmber">${escapeHtml(s.laborScore)}</div>
              </div>
              <div class="execMetricChip">
                <div class="execMetricChipKicker">Clear Pressure</div>
                <div class="execMetricChipVal ${tone.code === 'red' ? 'execMetricChipValRed' : 'execMetricChipValAmber'}">${escapeHtml(s.clearPressureDisplay)}</div>
              </div>
              <div class="execMetricChip">
                <div class="execMetricChipKicker">Execution Window</div>
                <div class="execMetricChipVal execMetricChipValCyan">${escapeHtml(s.execDaysDisplay)}</div>
              </div>
            </div>

            <div class="execCenterRuleTop"></div>
            <div class="execCenterTopLabel">Hysteresis Graph</div>
            <div class="execCenterAxisX"></div>
            <div class="execCenterAxisY"></div>
            <canvas class="execCanvas"></canvas>
            <div class="execCenterBottomLabel">Pressure Surface</div>
            <div class="execCenterRuleBottom"></div>
          </div>

          <div class="execColumn execColumnRight">
            ${panel('execPanelGreen', s.rightTopHeading, s.rightTopTitle, s.rightTopBody)}
            ${panel('execPanelGreen', s.rightBottomHeading, s.rightBottomTitle, s.rightBottomBody)}
          </div>
        </div>

        <div class="execCore execCoreLower">
          <div class="execColumn" style="grid-template-rows:1fr;">
            ${panel('execPanelCyan', s.lowerLeftHeading, s.lowerLeftTitle, s.lowerLeftBody)}
          </div>
          <div></div>
          <div class="execColumn" style="grid-template-rows:1fr;">
            ${panel('execPanelCyan', s.lowerRightHeading, s.lowerRightTitle, s.lowerRightBody)}
          </div>
        </div>

        <div class="execDoctrineRail">
          <div class="execDoctrineTag">
            <div class="execDoctrineKicker">Final Execution</div>
          </div>
          <div class="execDoctrineBody">
            <div class="execDoctrineText">${escapeHtml(s.doctrine)}</div>
          </div>
        </div>

        <div class="execFooter">
          <div class="execFooterText">Street threshold // pressure amplification // reflexive field synthesis</div>
          <div class="execFooterText">Subject lock maintained // doctrine channel open // ${escapeHtml(tone.doctrine)}</div>
        </div>
      </div>
    `;

    if (destroyField) {
      destroyField();
      destroyField = null;
    }

    const canvas = root.querySelector('.execCanvas');

    destroyField = initHysteresis(canvas, {
      p1x: tone.code === 'red' ? 0.428 : 0.438,
      p1y: tone.code === 'red' ? 0.606 : 0.600,
      p1h: tone.code === 'red' ? 2.10 : tone.code === 'amber' ? 1.92 : 1.72,
      p1s: tone.code === 'red' ? 23.8 : 22.2,
      p2x: tone.code === 'red' ? 0.572 : 0.562,
      p2y: tone.code === 'red' ? 0.540 : 0.545,
      p2h: tone.code === 'red' ? 1.78 : tone.code === 'amber' ? 1.58 : 1.38,
      p2s: tone.code === 'red' ? 24.0 : 22.8,
      saddleX: 0.502,
      saddleY: tone.code === 'red' ? 0.582 : 0.590,
      saddleH: tone.code === 'red' ? 0.56 : 0.44,
      saddleS: 12.0,
      amber: tone.code === 'cyan' ? 0.58 : 1.0,
      red: tone.code === 'red' ? 1.0 : 0.0
    });
  }

  function boot() {
    const root = byId(ROOT_ID);
    if (!root) return;

    render(null);

    window.addEventListener('chronos:annihilation-target', (evt) => {
      render(evt?.detail || null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();