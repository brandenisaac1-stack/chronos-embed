/* =========================================================================
   dc_intelligence.js — CHRONOS COMMAND RAIL (CHROMED) + TRUE PRESSURE SPECTRUM
   Reads ONLY: ./state.json  →  plaque["Relo 5 Lon"]

   Layout (dominance):
     LEFT:  CLEAR PACKAGE (TODAY → EXEC)  (HERO + SUBHERO + BODY)  ✅ dominant
     MID:   NOW → EXEC WINDOW (de-emphasized)                      ✅ least relevant
     RIGHT: KPIs (ΔNPV | DAYS→EXEC | DECISION PRESSURE) + mini     ✅ dominant

   GUARANTEE:
     ✅ Does NOT change your parsing / mechanics / state wiring
     ✅ Enhances VISUALS ONLY (spacing + readable text + right panel discipline)
     ✅ Decision Pressure drives ALL color logic (cyan → amber → red, continuous)
========================================================================= */

/* global fetch */
(() => {
  "use strict";
  if (window.__QAGE_DC_INTEL_RUNNING) return;
  window.__QAGE_DC_INTEL_RUNNING = true;

  const STATE_URL = "./state.json";
  const KEY = "Relo 5 Lon";

  /* ================= POSITION ================= */
  const USE_TOP = false;
  const POS_TOP = 72;
  const POS_BOTTOM = 5;

  const BAR_HEIGHT = 272;
  const Z = 2147483646;
  const POLL_MS = 1200;
  /* =========================================== */

  /* ================= UTIL ================= */
  const clean = (s) => String(s ?? "").trim();

  function norm(raw) {
    return String(raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u2206/g, "\u0394")
      .replace(/[‐-‒–—]/g, "-")
      .replace(/[→➝➞➟➠➡]/g, "->")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ");
  }

  function pickFirstMatch(txt, res) {
    for (const re of res) {
      const m = txt.match(re);
      if (m && m[1] != null) return String(m[1]).trim();
    }
    return "";
  }

  function isMissing(v) {
    const s = String(v ?? "").trim();
    if (!s || s === "—") return true;
    const z = s.replace(/[\s,$]/g, "");
    return z === "0" || z === "0.0" || z === "0.00";
  }

  function clampStr(s, n) {
    const t = String(s || "");
    return t.length > n ? t.slice(0, Math.max(0, n - 1)) + "…" : t;
  }

  function stripNum(s) {
    const t = String(s ?? "").replace(/[^\d+\-.,]/g, "").replace(/,/g, "");
    const v = Number(t);
    return Number.isFinite(v) ? v : NaN;
  }

  function intStr(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    if (v === 0) return "";
    return `${Math.trunc(v)}`;
  }

  function moneyInt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    if (v === 0) return "";
    const sign = v < 0 ? "-" : "";
    return `${sign}$${Math.abs(Math.trunc(v)).toLocaleString("en-US")}`;
  }

  function fmtMoneyDigits(digitsMaybeSigned) {
    const s = String(digitsMaybeSigned ?? "").trim();
    if (!s) return "";
    const v = Number(s);
    if (!Number.isFinite(v)) return "";
    const sign = v < 0 ? "-" : "";
    return `${sign}$${Math.abs(Math.trunc(v)).toLocaleString("en-US")}`;
  }

  function whenReady(fn) {
    if (document.body) return fn();
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (document.body) { clearInterval(iv); fn(); }
      if (Date.now() - t0 > 8000) clearInterval(iv);
    }, 50);
  }

  function kpiFontPx(txt) {
    const t = String(txt ?? "").trim();
    if (!t) return 40;
    const n = t.length;
    if (n <= 3) return 54;
    if (n <= 6) return 46;
    if (n <= 10) return 40;
    if (n <= 14) return 36;
    return 32;
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function hexToRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length !== 6) return { r: 0, g: 255, b: 240 };
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return { r: 0, g: 255, b: 240 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const to2 = (v) => {
      const h = clamp(Math.round(v), 0, 255).toString(16);
      return h.length === 1 ? "0" + h : h;
    };
    return "#" + to2(r) + to2(g) + to2(b);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function blendHex(c1, c2, t) {
    const A = hexToRgb(c1), B = hexToRgb(c2);
    return rgbToHex(
      lerp(A.r, B.r, t),
      lerp(A.g, B.g, t),
      lerp(A.b, B.b, t)
    );
  }

  /* ================= PRESSURE COLOR (TRUE SPECTRUM) ================= */
  const C_CYAN  = "#00fff0";
  const C_AMBER = "#ffb030";
  const C_RED   = "#ff505f";

  function dpTo01(dpN) {
    const x = Number(dpN);
    if (!Number.isFinite(x)) return NaN;
    const v = (x <= 1.2) ? x : (x / 100);
    return clamp(v, 0, 1);
  }

  function colorByDP01(dp01) {
    const x = Number(dp01);
    if (!Number.isFinite(x)) {
      return { base: C_CYAN, edge: "rgba(0,255,240,0.22)", glow: "rgba(0,255,240,0.18)" };
    }
    const base = (x <= 0.5)
      ? blendHex(C_CYAN, C_AMBER, x / 0.5)
      : blendHex(C_AMBER, C_RED, (x - 0.5) / 0.5);

    const rgb = hexToRgb(base);
    const g = 0.16 + 0.22 * x;
    const e = 0.10 + 0.18 * x;
    return {
      base,
      edge: `rgba(${rgb.r},${rgb.g},${rgb.b},${e})`,
      glow: `rgba(${rgb.r},${rgb.g},${rgb.b},${g})`
    };
  }

  /* ================= PARSE (UNCHANGED) ================= */
  function parseChronOS(raw) {
    const full = norm(raw);
    const lines = full.split("\n").map(clean).filter(Boolean);
    const header = lines[0] || "QAGE ChronOS™ — REFLEXIVE EXECUTION ORDER";

    const upi = pickFirstMatch(full, [/\bUPI\s*:\s*([0-9.]+)/i]);
    const decisionPressure = pickFirstMatch(full, [/\bDECISION\s*PRESSURE\s*:\s*([0-9.]+)/i]);

    const gfToday = pickFirstMatch(full, [/\bGF\s*:\s*([0-9.]+)/i]);
    const gfExec  = pickFirstMatch(full, [/\bGF\s*:\s*[0-9.]+\s*(?:->|to|-)\s*([0-9.]+)/i]);
    const dgf     = pickFirstMatch(full, [/\b(?:\u0394GF|ΔGF|DGF)\s*:\s*([+\-]?[0-9.]+)/i]);

    const execDate = pickFirstMatch(full, [/\bEXEC\s*:\s*([0-9/\\-]+)/i]);
    const daysToExec = pickFirstMatch(full, [
      /\bDAYS\s*(?:->|-)?\s*EXEC\s*:\s*([0-9]+)/i,
      /\bDAYS\s*[^:]*:\s*([0-9]+)/i
    ]);
    const sovCycles = pickFirstMatch(full, [/\bSOV\s*CYCLES\b[^\d]*\s*([0-9]+)/i]);
    const nodeDate  = pickFirstMatch(full, [/\bNODE\s*:\s*([0-9/\\-]+)/i]);

    const sizeSF  = pickFirstMatch(full, [/\bSIZE\s*:\s*([0-9,]+)\s*SF/i]);
    const termY   = pickFirstMatch(full, [/\bTERM\s*:\s*([0-9.]+)\s*Y/i]);
    const discPct = pickFirstMatch(full, [/\br\s*:\s*([0-9.]+)\s*%/i]);

    const rentToday = pickFirstMatch(full, [/\bRENT\s*:\s*\$?\s*([0-9.]+)/i]);
    const rentExec  = pickFirstMatch(full, [/\bRENT\s*:\s*\$?\s*[0-9.]+\s*(?:->|to|-)\s*\$?\s*([0-9.]+)/i]);

    const tiPsf  = pickFirstMatch(full, [/\bTI\s*:\s*\$?\s*([0-9.]+)/i]);
    const freeMo = pickFirstMatch(full, [/\bFREE\s*:\s*([0-9.]+)\s*MO/i]);

    const effToday = pickFirstMatch(full, [/\bEFF\s*:\s*\$?\s*([0-9.]+)/i]);
    const effExec  = pickFirstMatch(full, [/\bEFF\s*:\s*\$?\s*[0-9.]+\s*(?:->|to|-)\s*\$?\s*([0-9.]+)/i]);

    function moneyFromLine(line) {
      const s = String(line || "")
        .replace(/\u2206/g, "\u0394")
        .replace(/[‐-‒–—]/g, "-")
        .replace(/[→➝➞➟➠➡]/g, "->");
      const m = s.match(/([+\-]?\s*\$?\s*\d[\d,\s]*)/);
      if (!m) return "";
      const rawNum = m[1].replace(/\s+/g, "").replace(/\$/g, "").replace(/,/g, "");
      if (!rawNum) return "";
      const sign = rawNum.startsWith("-") ? "-" : (rawNum.startsWith("+") ? "+" : "");
      const digits = rawNum.replace(/[+\-]/g, "");
      if (!digits || !/^\d+$/.test(digits)) return "";
      return `${sign}${digits}`;
    }

    let npvNow = "", npvWait = "", dnpv = "";
    for (const L of lines) {
      const U = L.toUpperCase().replace(/\u2206/g, "\u0394");
      if (!npvNow && U.includes("NPV") && U.includes("NOW"))   { npvNow = moneyFromLine(L); continue; }
      if (!npvWait && U.includes("NPV") && U.includes("WAIT")) { npvWait = moneyFromLine(L); continue; }
      if (!dnpv && (U.includes("ΔNPV") || U.includes("DNPV"))) { dnpv = moneyFromLine(L); continue; }
    }

    const order      = pickFirstMatch(full, [/\bORDER\s*:\s*([^\n]+)/i]);
    const confidence = pickFirstMatch(full, [/\bCONFIDENCE\s*:\s*([^\n]+)/i]);

    const upiN = stripNum(upi);
    const decisionPressureN = stripNum(decisionPressure);
    const daysN = stripNum(daysToExec);
    const dnpvN = stripNum(dnpv);

    return {
      header,
      upi, upiN: Number.isFinite(upiN) ? upiN : NaN,
      decisionPressure,
      decisionPressureN: Number.isFinite(decisionPressureN) ? decisionPressureN : NaN,
      gfToday, gfExec, dgf,
      execDate, daysToExec, daysN: Number.isFinite(daysN) ? daysN : NaN,
      sovCycles, nodeDate,
      sizeSF, termY, discPct,
      rentToday, rentExec,
      tiPsf, freeMo,
      effToday, effExec,
      npvNow, npvWait, dnpv, dnpvN: Number.isFinite(dnpvN) ? dnpvN : NaN,
      order, confidence
    };
  }

  /* ================= UI (SPACING + READABILITY FIX) ================= */
  whenReady(() => {
    const mount = document.getElementById("uiPins") || document.body;
    const prev = document.getElementById("qage-space-hero");
    if (prev) prev.remove();

    if (!document.getElementById("qage-dcintel-style")) {
      const st = document.createElement("style");
      st.id = "qage-dcintel-style";
      st.textContent = `
        @keyframes qageBleedDrift { 0%{background-position:0% 0%} 100%{background-position:200% 0%} }
        @keyframes qageScanShimmer { 0%{transform:translateX(-35%);opacity:0} 18%{opacity:.28} 60%{opacity:.24} 100%{transform:translateX(135%);opacity:0} }

        .qage-crt::before{
          content:"";
          position:absolute; inset:0;
          pointer-events:none;
          opacity:.065;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.02),
            rgba(255,255,255,0.02) 1px,
            rgba(0,0,0,0.0) 3px,
            rgba(0,0,0,0.0) 6px
          );
          mix-blend-mode: overlay;
        }

        .qage-tabnums{
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "ss01" 1;
        }
      `;
      document.head.appendChild(st);
    }

    const bar = document.createElement("div");
    bar.id = "qage-space-hero";
    bar.className = "qage-crt";
    Object.assign(bar.style, {
      position: "fixed",
      left: "0px",
      right: "0px",
      height: `${BAR_HEIGHT}px`,
      zIndex: String(Z),
      pointerEvents: "none",
      boxSizing: "border-box",
      padding: "22px 26px",
      backdropFilter: "blur(14px)",
      background: "linear-gradient(to top, rgba(5,10,18,0.96), rgba(5,10,18,0.78))",
      borderTop: "1px solid rgba(0,255,240,0.18)",
      borderBottom: "1px solid rgba(0,255,240,0.08)",
      overflow: "hidden",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    });

    if (USE_TOP) {
      bar.style.top = `${POS_TOP}px`;
      bar.style.bottom = "";
    } else {
      bar.style.bottom = `${POS_BOTTOM}px`;
      bar.style.top = "";
    }

    const bleed = document.createElement("div");
    Object.assign(bleed.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      opacity: "0.88",
      mixBlendMode: "screen",
      backgroundSize: "200% 100%",
      animation: "qageBleedDrift 14s linear infinite"
    });

    const vignette = document.createElement("div");
    Object.assign(vignette.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      background: "radial-gradient(120% 140% at 50% 45%, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.46) 100%)",
      opacity: "0.95"
    });

    const topLine = document.createElement("div");
    Object.assign(topLine.style, {
      position: "absolute",
      left: "0",
      right: "0",
      top: "0",
      height: "3px",
      opacity: "0.95"
    });

    const topLine2 = document.createElement("div");
    Object.assign(topLine2.style, {
      position: "absolute",
      left: "0",
      right: "0",
      top: "3px",
      height: "1px",
      background: "rgba(0,255,240,0.20)",
      opacity: "0.9"
    });

    const scan = document.createElement("div");
    Object.assign(scan.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: "0",
      width: "32%",
      pointerEvents: "none",
      background: "linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.06), rgba(255,255,255,0.0))",
      animation: "qageScanShimmer 8.6s linear infinite",
      mixBlendMode: "overlay"
    });

    // CONTENT GRID: give RIGHT more real estate (fixes “skinny can’t see shit”)
    const content = document.createElement("div");
    Object.assign(content.style, {
      position: "relative",
      zIndex: "2",
      height: "100%",
      display: "grid",
      gridTemplateColumns: "1.20fr 0.78fr 2.02fr",
      gap: "18px",
      alignItems: "stretch"
    });

    bar.appendChild(bleed);
    bar.appendChild(vignette);
    bar.appendChild(scan);
    bar.appendChild(topLine);
    bar.appendChild(topLine2);
    bar.appendChild(content);
    mount.appendChild(bar);

    /* LEFT */
    const left = document.createElement("div");
    Object.assign(left.style, {
      minWidth: "0",
      paddingRight: "18px",
      boxSizing: "border-box",
      borderRight: "1px solid rgba(0,255,240,0.14)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-evenly",
      gap: "8px"
    });

    const leftTitle = document.createElement("div");
    leftTitle.textContent = "CLEAR PACKAGE (TODAY → EXEC)";
    Object.assign(leftTitle.style, {
      fontSize: "18px",
      letterSpacing: "2.2px",
      color: "rgba(0,255,240,0.95)",
      fontWeight: "520",
      lineHeight: ".75",
      textShadow: "0 0 16px rgba(0,255,240,0.16)"
    });

    const leftSub = document.createElement("div");
    Object.assign(leftSub.style, {
      fontSize: "20px",
      color: "rgba(230,245,255,0.98)",
      fontWeight: "860",
      lineHeight: ".70",
      whiteSpace: "normal",
      overflow: "visible"
    });

    const leftBody = document.createElement("div");
    Object.assign(leftBody.style, {
      fontSize: "19px",
      lineHeight: "1.73",
      color: "rgba(230,245,255,0.99)",
      whiteSpace: "pre-wrap",
      overflow: "visible"
    });

    left.appendChild(leftTitle);
    left.appendChild(leftSub);
    left.appendChild(leftBody);
    content.appendChild(left);

    /* MID */
    const mid = document.createElement("div");
    Object.assign(mid.style, {
      minWidth: "0",
      padding: "4px 10px",
      boxSizing: "border-box",
      borderRight: "1px solid rgba(0,255,240,0.08)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-evenly",
      gap: "4px",
      opacity: "0.80"
    });

    const h1 = document.createElement("div");
    Object.assign(h1.style, {
      fontSize: "18px",
      letterSpacing: "2.0px",
      color: "rgba(0,255,240,0.52)",
      fontWeight: "1650",
      lineHeight: ".75"
    });
    h1.textContent = "NOW → EXEC WINDOW";

    const h2 = document.createElement("div");
    Object.assign(h2.style, {
      fontSize: "14px",
      color: "rgba(230,245,255,0.70)",
      lineHeight: "1.52",
      whiteSpace: "pre-wrap",
      overflow: "visible"
    });
    h2.textContent = "";

    mid.appendChild(h1);
    mid.appendChild(h2);
    content.appendChild(mid);

    /* RIGHT */
    const right = document.createElement("div");
    Object.assign(right.style, {
      minWidth: "0",
      paddingLeft: "14px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "8px"
    });
    content.appendChild(right);

    // KPI ROW: spread hard across full width + DP forced to far right
    const kpis = document.createElement("div");
    Object.assign(kpis.style, {
      display: "flex",
      alignItems: "stretch",
      gap: "18px",
      flexWrap: "nowrap",
      justifyContent: "space-between",
      width: "100%",
      height: "112px"
    });

    function kpiBlock(label) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        flex: "1 1 0",
        minWidth: "240px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "8px",
        padding: "10px 12px 10px 12px",
        boxSizing: "border-box",
        borderRadius: "12px",
        border: "1px solid rgba(0,255,240,0.10)",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.46), rgba(0,0,0,0.26))",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
        position: "relative",
        overflow: "hidden"
      });

      const inner = document.createElement("div");
      Object.assign(inner.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "12px",
        boxShadow: "inset 0 0 0 1px rgba(0,255,240,0.06)",
        pointerEvents: "none"
      });

      const l = document.createElement("div");
      Object.assign(l.style, {
        fontSize: "11px",
        color: "rgba(0,255,240,0.50)",
        letterSpacing: "1.35px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      });
      l.textContent = label;

      const v = document.createElement("div");
      v.className = "qage-tabnums";
      Object.assign(v.style, {
        fontSize: "40px",
        fontWeight: "320",
        lineHeight: "1.00",
        transition: "font-size .18s ease, text-shadow .18s ease, color .18s ease",
        alignSelf: "flex-start",
        whiteSpace: "nowrap"
      });

      // SMALL TEXT: NO ELLIPSIS, WRAPS, SHOWS EVERYTHING
      const s = document.createElement("div");
      s.className = "qage-tabnums";
      Object.assign(s.style, {
        fontSize: "10px",
        color: "rgba(230,245,255,0.72)",
        lineHeight: "1.18",
        whiteSpace: "normal",
        overflow: "visible",
        textOverflow: "clip",
        wordBreak: "break-word"
      });

      wrap.appendChild(inner);
      wrap.appendChild(l);
      wrap.appendChild(v);
      wrap.appendChild(s);
      return { wrap, v, s, l, inner };
    }

    const K1 = kpiBlock("ΔNPV (ACT NOW)");
    const K2 = kpiBlock("DAYS → EXEC");
    const K3 = kpiBlock("DECISION PRESSURE");

    // Force DP block to the far right + give it a touch more width
    K3.wrap.style.marginLeft = "auto";
    K3.wrap.style.flex = "1.15 1 0";
    K1.wrap.style.flex = "1 1 0";
    K2.wrap.style.flex = "1 1 0";

    kpis.appendChild(K1.wrap);
    kpis.appendChild(K2.wrap);
    kpis.appendChild(K3.wrap);
    right.appendChild(kpis);

    // MINI (padding string FIXED; was broken)
    const mini = document.createElement("div");
    mini.className = "qage-tabnums";
    Object.assign(mini.style, {
      width: "100%",
      padding: "8px 10px",
      borderRadius: "25px",
      border: "1px solid rgba(0,255,240,0.30)",
      background: "linear-gradient(to bottom, rgba(0,0,0,0.56), rgba(0,0,0,0.34))",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
      fontSize: "11.25px",
      color: "rgba(230,245,255,0.90)",
      lineHeight: "1.22",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
      position: "relative"
    });

    const miniHdr = document.createElement("div");
    Object.assign(miniHdr.style, {
      fontSize: "11px",
      letterSpacing: "1.35px",
      textTransform: "uppercase",
      color: "rgba(0,255,240,0.52)",
      marginBottom: "6px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    });
    miniHdr.textContent = "DOCTRINE / EXECUTION BIAS";

    const miniTxt = document.createElement("div");
    Object.assign(miniTxt.style, {
      fontSize: "12px",
      color: "rgba(230,245,255,0.88)",
      lineHeight: "1.22",
      whiteSpace: "pre-wrap",
      overflow: "visible"
    });

    mini.appendChild(miniHdr);
    mini.appendChild(miniTxt);
    right.appendChild(mini);

    function setKPI(K, bigText, smallText, colorObj, emphasize = false) {
      const missing = isMissing(bigText);
      const t = missing ? "" : String(bigText);

      K.v.textContent = t;
      K.s.textContent = missing ? "" : String(smallText || "");
      K.v.style.display = missing ? "none" : "block";
      K.s.style.display = missing ? "none" : "block";

      if (!missing) {
        const px = kpiFontPx(t);
        K.v.style.fontSize = `${px}px`;
        K.v.style.color = colorObj.base;
        K.v.style.textShadow = emphasize
          ? `0 0 46px ${colorObj.glow}, 0 0 18px ${colorObj.edge}, 0 0 8px ${colorObj.edge}`
          : `0 0 28px ${colorObj.glow}, 0 0 12px ${colorObj.edge}`;
      }

      K.wrap.style.borderColor = colorObj.edge;
      K.inner.style.boxShadow = `inset 0 0 0 1px ${colorObj.edge}`;
      K.l.style.color = "rgba(0,255,240,0.50)";
    }

    /* ================= DATA LOOP ================= */
    let last = parseChronOS("");

    async function fetchState() {
      try {
        const r = await fetch(`${STATE_URL}?v=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const raw = j?.plaque?.[KEY];
        if (raw != null) last = parseChronOS(raw);
      } catch (_) {}
    }

    fetchState();
    setInterval(fetchState, POLL_MS);

    let phase = 0;

    function render() {
      const dp01 = dpTo01(last.decisionPressureN);
      const c = colorByDP01(dp01);

      const gfBits = [];
      if (!isMissing(last.upi)) gfBits.push(`UPI: ${last.upi}`);
      if (!isMissing(last.gfToday) || !isMissing(last.gfExec)) gfBits.push(`GF: ${last.gfToday || "—"} -> ${last.gfExec || "—"}`);
      if (!isMissing(last.dgf)) gfBits.push(`ΔGF: ${last.dgf}`);

      const execBits = [];
      if (!isMissing(last.execDate)) execBits.push(`EXEC: ${last.execDate}`);
      if (!isMissing(last.daysToExec)) execBits.push(`DAYS->EXEC: ${last.daysToExec}`);
      if (!isMissing(last.sovCycles)) execBits.push(`SOV CYCLES: ${last.sovCycles}`);
      if (!isMissing(last.nodeDate)) execBits.push(`NODE: ${last.nodeDate}`);

      h2.textContent = []
        .concat(gfBits.length ? [gfBits.join("  |  ")] : [])
        .concat(execBits.length ? [execBits.join("  |  ")] : [])
        .join("  •  ") || "";

      const a = [];
      if (!isMissing(last.sizeSF)) a.push(`SIZE: ${last.sizeSF} SF`);
      if (!isMissing(last.termY)) a.push(`TERM: ${last.termY}Y`);
      if (!isMissing(last.discPct)) a.push(`r: ${last.discPct}%`);
      leftSub.textContent = a.length ? a.join(" | ") : "";

      const L = [];
      if (!isMissing(last.rentToday) || !isMissing(last.rentExec)) {
        const rt = isMissing(last.rentToday) ? "" : `$${last.rentToday}`;
        const re = isMissing(last.rentExec) ? "" : `$${last.rentExec}`;
        if (rt && re) L.push(`RENT: ${rt} -> ${re} /SF/YR`);
        else if (rt) L.push(`RENT: ${rt} /SF/YR`);
        else if (re) L.push(`RENT: ${re} /SF/YR`);
      }

      const tiBits = [];
      if (!isMissing(last.tiPsf)) tiBits.push(`TI: $${last.tiPsf}/SF`);
      if (!isMissing(last.freeMo)) tiBits.push(`FREE: ${last.freeMo} MO`);
      if (tiBits.length) L.push(tiBits.join(" | "));

      if (!isMissing(last.effToday) || !isMissing(last.effExec)) {
        const et = isMissing(last.effToday) ? "" : `$${last.effToday}`;
        const ee = isMissing(last.effExec) ? "" : `$${last.effExec}`;
        if (et && ee) L.push(`EFF: ${et} -> ${ee} /SF/YR`);
        else if (et) L.push(`EFF: ${et} /SF/YR`);
        else if (ee) L.push(`EFF: ${ee} /SF/YR`);
      }
      leftBody.textContent = L.join("\n");

      const dnpvShow = Number.isFinite(last.dnpvN) ? moneyInt(last.dnpvN) : fmtMoneyDigits(last.dnpv);
      setKPI(
        K1,
        dnpvShow,
        (!isMissing(last.npvNow) || !isMissing(last.npvWait))
          ? `NPV now: ${fmtMoneyDigits(last.npvNow) || "—"} | wait->exec: ${fmtMoneyDigits(last.npvWait) || "—"}`
          : "",
        c,
        false
      );

      const daysShow = !isMissing(last.daysToExec) ? `${intStr(last.daysN)}d` : "";
      setKPI(
        K2,
        daysShow,
        !isMissing(last.execDate) ? `Exec date: ${last.execDate}` : "",
        c,
        false
      );

      let dpShow = "";
      if (Number.isFinite(last.decisionPressureN)) {
        const raw = last.decisionPressureN;
        dpShow = String((raw <= 1.2) ? Math.round(raw * 100) : Math.round(raw));
      }
      setKPI(K3, dpShow, dpShow ? "Pressure (0–100)" : "", c, true);

      const M = [];
      if (!isMissing(last.order)) M.push(clampStr(last.order, 110));
      if (!isMissing(last.confidence)) M.push(`CONFIDENCE: ${clampStr(last.confidence, 60)}`);
      if (!isMissing(last.npvNow) || !isMissing(last.npvWait) || !isMissing(dnpvShow)) {
        M.push("");
        if (!isMissing(last.npvNow))  M.push(`NPV NOW: ${fmtMoneyDigits(last.npvNow)}`);
        if (!isMissing(last.npvWait)) M.push(`NPV WAIT->EXEC: ${fmtMoneyDigits(last.npvWait)}`);
        if (!isMissing(dnpvShow))     M.push(`ΔNPV (ACT NOW): ${dnpvShow}`);
      }
      miniTxt.textContent = M.join("\n");

      bar.style.borderTopColor = c.edge;
      bar.style.boxShadow = `0 14px 50px ${c.glow}`;

      topLine.style.background = c.base;
      topLine.style.boxShadow = `0 0 22px ${c.glow}, 0 0 10px ${c.edge}`;

      left.style.borderRight = `1px solid ${c.edge}`;
      mid.style.borderRight  = `1px solid rgba(255,255,255,0.06)`;
      mini.style.borderColor = c.edge;

      const rgb = hexToRgb(c.base);
      phase = (phase + 0.0026) % 1;
      const wob = 0.34 + 0.22 * Math.sin(phase * Math.PI * 2);
      const a1 = 0.10 + wob * 0.10;
      const a2 = 0.07 + wob * 0.08;

      bleed.style.backgroundImage =
        `linear-gradient(90deg,
          rgba(${rgb.r},${rgb.g},${rgb.b},0.00) 0%,
          rgba(${rgb.r},${rgb.g},${rgb.b},${a1}) 20%,
          rgba(255,255,255,0.05) 38%,
          rgba(${rgb.r},${rgb.g},${rgb.b},${a2}) 56%,
          rgba(${rgb.r},${rgb.g},${rgb.b},0.00) 100%)`;

      requestAnimationFrame(render);
    }

    render();
  });
})();