(() => {
  "use strict";

  if (window.__CHRONOS_FIELD_PANEL_RUNNING__) return;
  window.__CHRONOS_FIELD_PANEL_RUNNING__ = true;

  const ROOT_ID = "fieldIntelMount";
  const STYLE_ID = "chronosFieldIntelPanelStyles";

  function byId(id) {
    return document.getElementById(id);
  }

  function safe(v, fallback = "") {
    const s = String(v ?? "").trim();
    return s || fallback;
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function num(v, fallback = null) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "")
      .replace(/,/g, "")
      .replace(/\$/g, "")
      .replace(/%/g, "")
      .trim();
    if (!s) return fallback;
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmt(v, fallback = "—") {
    const n = num(v, null);
    if (n == null) return fallback;
    return String(Math.round(n));
  }

  function clip(text, max = 220) {
    const s = safe(text);
    if (!s || s.length <= max) return s;
    const cut = s.slice(0, max);
    const last = cut.lastIndexOf(" ");
    return `${(last > 80 ? cut.slice(0, last) : cut).trim()}…`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        height: 100%;
        overflow: auto;
      }

      #${ROOT_ID} .fiCard {
        border: 1px solid rgba(114,243,255,.08);
        border-radius: 14px;
        padding: 10px 11px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.020), rgba(255,255,255,.010)),
          rgba(4,10,16,.32);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.02),
          0 0 0 1px rgba(0,0,0,.08);
      }

      #${ROOT_ID} .fiCardHero {
        padding: 12px 12px 11px;
        background:
          radial-gradient(circle at top right, rgba(114,243,255,.05), transparent 30%),
          linear-gradient(180deg, rgba(255,255,255,.024), rgba(255,255,255,.010)),
          rgba(4,10,16,.38);
      }

      #${ROOT_ID} .fiLabel {
        font-size: 8px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: #88a6b1;
        margin-bottom: 7px;
      }

      #${ROOT_ID} .fiHeroText {
        font-size: 11px;
        line-height: 1.42;
        color: #dff9ff;
        white-space: normal;
      }

      #${ROOT_ID} .fiSignalGrid {
        display: grid;
        grid-template-columns: 1fr 72px;
        gap: 8px;
        align-items: stretch;
      }

      #${ROOT_ID} .fiSignalName {
        font-size: 16px;
        line-height: .98;
        font-weight: 900;
        letter-spacing: .02em;
        text-transform: uppercase;
        color: #ecfeff;
        margin-bottom: 6px;
      }

      #${ROOT_ID} .fiSignalSub {
        font-size: 10px;
        line-height: 1.2;
        color: #dff9ff;
        opacity: .78;
      }

      #${ROOT_ID} .fiSignalScore {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid rgba(114,243,255,.08);
        background:
          radial-gradient(circle at 50% 50%, rgba(255,179,71,.08), transparent 60%),
          rgba(255,255,255,.02);
        font-size: 18px;
        font-weight: 900;
        color: #ffb347;
        text-shadow: 0 0 12px rgba(255,179,71,.18);
      }

      #${ROOT_ID} .fiMetricBlock {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      #${ROOT_ID} .fiMetricRow {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: start;
      }

      #${ROOT_ID} .fiMetricKeyWrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      #${ROOT_ID} .fiMetricKey {
        font-size: 8px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: #88a6b1;
      }

      #${ROOT_ID} .fiMetricSub {
        font-size: 9px;
        line-height: 1.2;
        color: #dff9ff;
        opacity: .82;
      }

      #${ROOT_ID} .fiMetricVal {
        font-size: 12px;
        line-height: 1;
        font-weight: 900;
        color: #ecfeff;
        text-align: right;
      }

      #${ROOT_ID} .fiMetricValAmber { color: #ffb347; }
      #${ROOT_ID} .fiMetricValCyan { color: #72f3ff; }

      #${ROOT_ID} .fiWorkGrid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      #${ROOT_ID} .fiMini {
        padding: 8px 9px;
        border-radius: 11px;
        border: 1px solid rgba(114,243,255,.06);
        background: rgba(255,255,255,.015);
      }

      #${ROOT_ID} .fiMiniKey {
        font-size: 8px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: #88a6b1;
        margin-bottom: 6px;
      }

      #${ROOT_ID} .fiMiniVal {
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        color: #ecfeff;
      }

      #${ROOT_ID} .fiIndustryStack {
        display: grid;
        gap: 6px;
      }

      #${ROOT_ID} .fiIndustry {
        display: grid;
        grid-template-columns: 26px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 11px;
        border: 1px solid rgba(255,255,255,.05);
        font-size: 10px;
        line-height: 1.1;
        font-weight: 900;
        text-transform: uppercase;
      }

      #${ROOT_ID} .fiIndustry.i1 {
        color: #f3e46b;
        background: linear-gradient(180deg, rgba(243,228,107,.10), rgba(243,228,107,.04));
      }

      #${ROOT_ID} .fiIndustry.i2 {
        color: #7dff7a;
        background: linear-gradient(180deg, rgba(125,255,122,.10), rgba(125,255,122,.04));
      }

      #${ROOT_ID} .fiIndustry.i3 {
        color: #72f3ff;
        background: linear-gradient(180deg, rgba(114,243,255,.10), rgba(114,243,255,.04));
      }

      #${ROOT_ID} .fiRank {
        opacity: .95;
      }

      #${ROOT_ID} .fiIndustryLabel {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .fiIndustryScore {
        color: #ecfeff;
      }
    `;
    document.head.appendChild(style);
  }

  function renderEmpty(root) {
    root.innerHTML = `
      <div class="fiCard fiCardHero">
        <div class="fiLabel">Field Brief</div>
        <div class="fiHeroText">Awaiting tract intelligence feed.</div>
      </div>
      <div class="fiCard">
        <div class="fiLabel">Signal Regime</div>
      </div>
      <div class="fiCard">
        <div class="fiLabel">Market Physics</div>
      </div>
      <div class="fiCard">
        <div class="fiLabel">Workforce Composition</div>
      </div>
      <div class="fiCard">
        <div class="fiLabel">Top 3 Industries</div>
      </div>
    `;
  }

  function render(payload) {
    const root = byId(ROOT_ID);
    if (!root) return;

    injectStyles();

    const tract = payload?.tract_intelligence || null;

    if (!tract) {
      renderEmpty(root);
      return;
    }

    const brief = clip(tract.tract_brief || "No tract narrative available.", 260);
    const signalRegime = safe(tract.signal_regime, "Awaiting resolve");

    const labor = fmt(tract.labor_physics_pressure);
    const talent = fmt(tract.talent_gravity);
    const market = fmt(tract.market_physics);
    const macro = fmt(tract.macro_demand_pulse);

    const knowledge = fmt(tract.knowledge_work_score);
    const decision = fmt(tract.decision_class_score);
    const transit = fmt(tract.transit_access_score);
    const commute = fmt(tract.commute_access_score);
    const remote = fmt(tract.remote_flex_score);
    const temporal = fmt(tract.temporal_pressure);

    const topIndustries = Array.isArray(tract.top_industries) ? tract.top_industries.slice(0, 3) : [];

    root.innerHTML = `
      <div class="fiCard fiCardHero">
        <div class="fiLabel">Field Brief</div>
        <div class="fiHeroText">${escapeHtml(brief)}</div>
      </div>

      <div class="fiCard">
        <div class="fiLabel">Signal Regime</div>
        <div class="fiSignalGrid">
          <div>
            <div class="fiSignalName">${escapeHtml(signalRegime)}</div>
            <div class="fiSignalSub">${escapeHtml(signalRegime)}</div>
          </div>
          <div class="fiSignalScore">${escapeHtml(labor)}</div>
        </div>
      </div>

      <div class="fiCard">
        <div class="fiLabel">Market Physics</div>
        <div class="fiMetricBlock">
          <div class="fiMetricRow">
            <div class="fiMetricKeyWrap">
              <div class="fiMetricKey">Labor Physics Pressure</div>
              <div class="fiMetricSub">Elevated</div>
            </div>
            <div class="fiMetricVal fiMetricValAmber">${escapeHtml(labor)}</div>
          </div>

          <div class="fiMetricRow">
            <div class="fiMetricKeyWrap">
              <div class="fiMetricKey">Talent Gravity</div>
              <div class="fiMetricSub">workforce pull / concentration</div>
            </div>
            <div class="fiMetricVal fiMetricValAmber">${escapeHtml(talent)}</div>
          </div>

          <div class="fiMetricRow">
            <div class="fiMetricKeyWrap">
              <div class="fiMetricKey">Market Physics</div>
              <div class="fiMetricSub">demand posture / market structure</div>
            </div>
            <div class="fiMetricVal fiMetricValCyan">${escapeHtml(market)}</div>
          </div>

          <div class="fiMetricRow">
            <div class="fiMetricKeyWrap">
              <div class="fiMetricKey">Macro Demand Pulse</div>
              <div class="fiMetricSub">upstream demand conditioning</div>
            </div>
            <div class="fiMetricVal fiMetricValAmber">${escapeHtml(macro)}</div>
          </div>
        </div>
      </div>

      <div class="fiCard">
        <div class="fiLabel">Workforce Composition</div>
        <div class="fiWorkGrid">
          <div class="fiMini">
            <div class="fiMiniKey">Knowledge Work</div>
            <div class="fiMiniVal">${escapeHtml(knowledge)}</div>
          </div>
          <div class="fiMini">
            <div class="fiMiniKey">Decision Class</div>
            <div class="fiMiniVal">${escapeHtml(decision)}</div>
          </div>
          <div class="fiMini">
            <div class="fiMiniKey">Transit</div>
            <div class="fiMiniVal">${escapeHtml(transit)}</div>
          </div>
          <div class="fiMini">
            <div class="fiMiniKey">Commute</div>
            <div class="fiMiniVal">${escapeHtml(commute)}</div>
          </div>
          <div class="fiMini">
            <div class="fiMiniKey">Remote Flex</div>
            <div class="fiMiniVal">${escapeHtml(remote)}</div>
          </div>
          <div class="fiMini">
            <div class="fiMiniKey">Temporal Pressure</div>
            <div class="fiMiniVal">${escapeHtml(temporal)}</div>
          </div>
        </div>
      </div>

      <div class="fiCard">
        <div class="fiLabel">Top 3 Industries</div>
        <div class="fiIndustryStack">
          ${topIndustries.map((item, i) => `
            <div class="fiIndustry i${i + 1}">
              <div class="fiRank">#${i + 1}</div>
              <div class="fiIndustryLabel">${escapeHtml(item.label || "—")}</div>
              <div class="fiIndustryScore">${escapeHtml(String(item.score100 ?? "—"))}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function boot() {
    const root = byId(ROOT_ID);
    if (!root) return;

    renderEmpty(root);

    window.addEventListener("chronos:tract-bar-update", (evt) => {
      render(evt?.detail || null);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();