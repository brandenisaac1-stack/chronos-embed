// plane_overlay.js — QAGE CINEMATIC TAKEOFF/RETURN (GUARANTEED ATTACH TO breathing.js MAP)
// - Uses the SAME map instance created by breathing.js: window.__QAGE_MB_MAP
// - Model layer auto-rebuilds after style reloads
// - Forward-locked yaw (no backwards flips), no jitter, no pauses
// - DC runway default (Reagan / DCA-ish). You can change RUNWAY only.

(() => {
  "use strict";

  if (window.__QAGE_PLANE_RUNNING) return;
  window.__QAGE_PLANE_RUNNING = true;

  const MODEL_URI = "https://docs.mapbox.com/mapbox-gl-js/assets/airplane.glb";
  const SRC_ID = "qage-plane-src";
  const LAYER_ID = "qage-plane-layer";

  // ✅ DC runway default (edit if you want)
  const RUNWAY = { lng: -77.0392, lat: 38.8501 };
  const RUN_LEN_LAT = 0.18; // path length in latitude degrees (keep cinematic)

  const UPDATE_MS = 33;

const FLIGHT_MODE = "LOW"; // "LOW", "MED", "HIGH"

const FLIGHT_PRESETS = {
  LOW:  { altMax: 180, scaleGround: 5.2, scaleAir: 4.9 },
  MED:  { altMax: 420, scaleGround: 5.2, scaleAir: 4.5 },
  HIGH: { altMax: 2200, scaleGround: 5.2, scaleAir: 3.6 }
};

const ALT_MAX = FLIGHT_PRESETS[FLIGHT_MODE].altMax;
const SCALE_GROUND = FLIGHT_PRESETS[FLIGHT_MODE].scaleGround;
const SCALE_AIR = FLIGHT_PRESETS[FLIGHT_MODE].scaleAir;

  // ✅ yaw offset: use 90 or -90 ONCE (depends on model forward axis)
  const YAW_OFFSET = 90;

  // ✅ forward-lock: prevents 179° → -179° flips
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap180 = (deg) => {
    let d = deg;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };
  const lerpAngle = (a, b, t) => a + wrap180(b - a) * t;

  function waitForMap() {
  const map =
    window.__CHRONOS_MAP ||
    window.__QAGE_MB_MAP ||
    window.map;

  if (!map) return requestAnimationFrame(waitForMap);

  if (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) {
    init(map);
  } else {
    map.once("load", () => init(map));
  }
}
waitForMap();

  function init(map) {
    // ---- Ensure layer always exists (style reload safe) ----
    function ensureLayer() {
      try {
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, {
            type: "model",
            models: {
              plane: {
                uri: MODEL_URI,
                position: [RUNWAY.lng, RUNWAY.lat],
                orientation: [0, 0, 0]
              }
            }
          });
        }
      } catch (_) {}

      try {
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: "model",
            source: SRC_ID,
            slot: "top",
            paint: {
              "model-scale": ["literal", [SCALE_GROUND, SCALE_GROUND, SCALE_GROUND]],
              "model-opacity": 0.0,
              "model-translation": ["literal", [0, 0, 0]]
            }
          });
        }
      } catch (_) {}
    }

    ensureLayer();

    // Style reload events differ per Mapbox GL build; listen broadly.
    try { map.on("styledata", ensureLayer); } catch (_) {}
    try { map.on("style.load", ensureLayer); } catch (_) {}
    try { map.on("load", ensureLayer); } catch (_) {}

    // ---- Motion state ----
    let state = "TAKEOFF";
    let t0 = performance.now();
    let lastTick = 0;

    // Yaw smoothing / forward-lock state
    let lastPos = { lng: RUNWAY.lng, lat: RUNWAY.lat };
    let yawSmoothed = 0; // degrees

    function computeYawDeg(current) {
      const dx = current.lng - lastPos.lng;
      const dy = current.lat - lastPos.lat;

      // if barely moved, keep yaw (prevents micro jitter)
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 1e-8) return yawSmoothed;

      const ang = Math.atan2(dx, dy) * (180 / Math.PI); // N-up convention
      lastPos = { ...current };
      return ang;
    }

    function setPlane(lng, lat, roll, pitch, z, opacity, scale) {
      const src = map.getSource(SRC_ID);
      if (!src) return;

      // desired yaw based on motion vector + offset
      const yawTarget = computeYawDeg({ lng, lat }) + YAW_OFFSET;

      // smooth yaw; no flips
      yawSmoothed = lerpAngle(yawSmoothed, yawTarget, 0.18);

      try {
        src.setModels({
          plane: {
            uri: MODEL_URI,
            position: [lng, lat],
            orientation: [roll, pitch, yawSmoothed]
          }
        });
      } catch (_) {}

      try { map.setPaintProperty(LAYER_ID, "model-translation", [0, 0, z]); } catch (_) {}
      try { map.setPaintProperty(LAYER_ID, "model-opacity", opacity); } catch (_) {}
      try { map.setPaintProperty(LAYER_ID, "model-scale", ["literal", [scale, scale, scale]]); } catch (_) {}
    }

    function nextTakeoff() { state = "TAKEOFF"; t0 = performance.now(); }
    function nextLanding() { state = "LANDING"; t0 = performance.now(); }

    function tick(now) {
      const u = now - t0;

      // Ensure layer exists even if style just reloaded
      if (!map.getLayer(LAYER_ID) || !map.getSource(SRC_ID)) ensureLayer();

      if (state === "TAKEOFF") {
        const dur = 14000;
        const t = clamp01(u / dur);

        const z = lerp(0, ALT_MAX, t);
        const scale = lerp(SCALE_GROUND, SCALE_AIR, t);

        const lat = RUNWAY.lat + t * RUN_LEN_LAT;
        const lng = RUNWAY.lng;

        // subtle pitch up with altitude (cinematic)
        const pitch = 2 + (z / ALT_MAX) * 6;

        setPlane(lng, lat, 0, pitch, z, 0.95, scale);

        if (u > dur) nextLanding();
        return;
      }

      if (state === "LANDING") {
        const dur = 14000;
        const t = clamp01(u / dur);

        const z = lerp(ALT_MAX, 0, t);
        const scale = lerp(SCALE_AIR, SCALE_GROUND, t);

        const lat = RUNWAY.lat + (1 - t) * RUN_LEN_LAT;
        const lng = RUNWAY.lng;

        // pitch down on approach
        const pitch = 2 * (1 - t);

        setPlane(lng, lat, 0, pitch, z, 0.95, scale);

        if (u > dur) nextTakeoff();
      }
    }

    function animate() {
      const now = performance.now();
      if (now - lastTick > UPDATE_MS) {
        lastTick = now;
        tick(now);
      }
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }
})();