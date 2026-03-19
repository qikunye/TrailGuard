import { useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL || "http://localhost:8000";

const EXPERIENCE_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "< 5 hikes" },
  { value: "intermediate", label: "Intermediate",  desc: "5–20 hikes" },
  { value: "advanced",     label: "Advanced",      desc: "20–50 hikes" },
  { value: "expert",       label: "Expert",        desc: "50+ hikes" },
];

const DECISION_CONFIG = {
  GO: {
    color:   "#22c55e",
    bg:      "rgba(34,197,94,0.12)",
    border:  "rgba(34,197,94,0.4)",
    icon:    "✦",
    label:   "CLEAR TO GO",
    pulse:   "pulse-green",
  },
  CAUTION: {
    color:   "#f59e0b",
    bg:      "rgba(245,158,11,0.12)",
    border:  "rgba(245,158,11,0.4)",
    icon:    "⚠",
    label:   "PROCEED WITH CAUTION",
    pulse:   "pulse-amber",
  },
  DO_NOT_GO: {
    color:   "#ef4444",
    bg:      "rgba(239,68,68,0.12)",
    border:  "rgba(239,68,68,0.4)",
    icon:    "✕",
    label:   "DO NOT GO",
    pulse:   "pulse-red",
  },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --ink:     #0d1117;
    --panel:   #131920;
    --border:  rgba(255,255,255,0.07);
    --muted:   rgba(255,255,255,0.35);
    --subtle:  rgba(255,255,255,0.55);
    --text:    rgba(255,255,255,0.88);
    --moss:    #3d6b4f;
    --pine:    #2d5a3d;
    --amber:   #c8862a;
    --stone:   #8a8070;
  }

  .tg-wrap {
    min-height: 100vh;
    background: var(--ink);
    font-family: 'DM Sans', sans-serif;
    color: var(--text);
    padding: 0;
  }

  /* Noise grain overlay */
  .tg-wrap::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.6;
  }

  .tg-inner {
    position: relative; z-index: 1;
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* Header */
  .tg-header {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 48px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
  }
  .tg-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(36px, 6vw, 52px);
    letter-spacing: 0.06em;
    color: #fff;
    line-height: 1;
  }
  .tg-logo span { color: var(--amber); }
  .tg-tagline {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }

  /* Step tracker */
  .tg-steps {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 40px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .tg-step {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .tg-step-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    color: var(--muted);
    transition: all 0.3s ease;
    background: var(--panel);
  }
  .tg-step-dot.active {
    border-color: var(--amber);
    color: var(--amber);
    box-shadow: 0 0 0 3px rgba(200,134,42,0.15);
  }
  .tg-step-dot.done {
    background: var(--moss);
    border-color: var(--moss);
    color: #fff;
  }
  .tg-step-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
  }
  .tg-step-label.active { color: var(--amber); }
  .tg-step-line {
    width: 32px; height: 1px;
    background: var(--border);
    flex-shrink: 0;
    margin: 0 4px;
  }

  /* Card */
  .tg-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 32px;
    margin-bottom: 16px;
  }
  .tg-section-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: 0.22em;
    color: var(--stone);
    text-transform: uppercase;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tg-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* Form grid */
  .tg-grid { display: grid; gap: 16px; }
  .tg-grid-2 { grid-template-columns: 1fr 1fr; }
  @media (max-width: 600px) { .tg-grid-2 { grid-template-columns: 1fr; } }

  /* Field */
  .tg-field { display: flex; flex-direction: column; gap: 6px; }
  .tg-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tg-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 11px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: var(--text);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
    -webkit-appearance: none;
  }
  .tg-input:focus {
    border-color: rgba(200,134,42,0.5);
    box-shadow: 0 0 0 3px rgba(200,134,42,0.08);
  }
  .tg-input::placeholder { color: rgba(255,255,255,0.18); }
  .tg-input option { background: #1a2228; }

  /* Experience pill selector */
  .tg-exp-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 500px) {
    .tg-exp-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .tg-exp-pill {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: transparent;
    color: var(--subtle);
  }
  .tg-exp-pill:hover {
    border-color: rgba(200,134,42,0.35);
    background: rgba(200,134,42,0.06);
  }
  .tg-exp-pill.selected {
    border-color: var(--amber);
    background: rgba(200,134,42,0.12);
    color: #fff;
  }
  .tg-exp-pill-label {
    font-size: 13px;
    font-weight: 600;
    display: block;
    margin-bottom: 3px;
  }
  .tg-exp-pill-desc {
    font-size: 10px;
    color: var(--muted);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Submit button */
  .tg-btn {
    width: 100%;
    padding: 16px 24px;
    background: linear-gradient(135deg, #3d6b4f 0%, #2d5a3d 100%);
    border: 1px solid rgba(61,107,79,0.5);
    border-radius: 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px;
    letter-spacing: 0.12em;
    color: #fff;
    cursor: pointer;
    transition: all 0.25s ease;
    margin-top: 8px;
    position: relative;
    overflow: hidden;
  }
  .tg-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
  }
  .tg-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(61,107,79,0.35);
    border-color: rgba(61,107,79,0.8);
  }
  .tg-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Loading state */
  .tg-loading-wrap {
    text-align: center;
    padding: 48px 24px;
  }
  .tg-loading-ring {
    width: 52px; height: 52px;
    border: 2px solid var(--border);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: tg-spin 0.9s linear infinite;
    margin: 0 auto 24px;
  }
  @keyframes tg-spin { to { transform: rotate(360deg); } }
  .tg-loading-steps {
    list-style: none;
    padding: 0; margin: 24px auto 0;
    max-width: 320px;
    text-align: left;
  }
  .tg-loading-step-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 13px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    transition: color 0.3s;
  }
  .tg-loading-step-item.current { color: var(--amber); }
  .tg-loading-step-item.done    { color: #22c55e; }
  .tg-step-indicator {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--border);
    flex-shrink: 0;
  }
  .tg-step-indicator.current {
    background: var(--amber);
    animation: tg-pulse 1.2s ease-in-out infinite;
  }
  .tg-step-indicator.done { background: #22c55e; }
  @keyframes tg-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
  }

  /* Result */
  .tg-result-card {
    border-radius: 12px;
    padding: 32px;
    border: 1px solid;
    margin-bottom: 16px;
    animation: tg-fadeUp 0.5s ease;
  }
  @keyframes tg-fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tg-decision-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .tg-decision-icon {
    width: 56px; height: 56px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
    border: 1.5px solid;
    flex-shrink: 0;
  }
  .tg-decision-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(24px, 5vw, 36px);
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .tg-decision-sub {
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--muted);
    margin-top: 4px;
  }
  .tg-reasoning {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.75);
    margin-bottom: 20px;
  }

  /* Warnings */
  .tg-warnings { display: flex; flex-direction: column; gap: 8px; }
  .tg-warning-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--subtle);
  }
  .tg-warning-icon { flex-shrink: 0; margin-top: 1px; }

  /* Data grid */
  .tg-data-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .tg-data-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .tg-data-key {
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }
  .tg-data-val {
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
  }

  /* Error */
  .tg-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: 10px;
    padding: 16px 20px;
    font-size: 14px;
    color: #fca5a5;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    animation: tg-fadeUp 0.3s ease;
  }

  /* Confidence bar */
  .tg-conf-bar-track {
    height: 4px;
    background: rgba(255,255,255,0.07);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 16px;
  }
  .tg-conf-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.8s ease;
  }

  /* Reset btn */
  .tg-reset-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: all 0.2s;
    margin-top: 8px;
  }
  .tg-reset-btn:hover {
    color: var(--text);
    border-color: rgba(255,255,255,0.2);
  }
`;

// ── Loading Step Tracker ──────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  "Validating hiker profile…",
  "Fetching weather forecast…",
  "Checking trail conditions…",
  "Analysing incident risk…",
  "Estimating completion time…",
  "Running AI safety evaluation…",
];

function LoadingView({ currentStep }) {
  return (
    <div className="tg-loading-wrap">
      <div className="tg-loading-ring" />
      <p style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)", fontFamily: "'Bebas Neue',sans-serif",
                  fontSize: 14 }}>
        Assessing Trail Safety
      </p>
      <ul className="tg-loading-steps">
        {PIPELINE_STEPS.map((step, i) => {
          const state = i < currentStep ? "done" : i === currentStep ? "current" : "pending";
          return (
            <li key={i} className={`tg-loading-step-item ${state}`}>
              <span className={`tg-step-indicator ${state}`} />
              {state === "done" ? "✓ " : ""}{step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Result View ───────────────────────────────────────────────────────────────
function ResultView({ data, onReset }) {
  const cfg = DECISION_CONFIG[data.finalDecision] || DECISION_CONFIG.CAUTION;
  const conf = Math.round((data.completionEstimate?.confidenceScore ?? 0.75) * 100);

  return (
    <>
      {/* Decision card */}
      <div
        className="tg-result-card"
        style={{ background: cfg.bg, borderColor: cfg.border }}
      >
        <div className="tg-decision-header">
          <div
            className="tg-decision-icon"
            style={{ borderColor: cfg.border, color: cfg.color }}
          >
            {cfg.icon}
          </div>
          <div>
            <div className="tg-decision-label" style={{ color: cfg.color }}>
              {cfg.label}
            </div>
            <div className="tg-decision-sub">
              Trail: {data.trailConditions?.name || data.trailId} ·{" "}
              {data.plannedDate} {data.plannedStartTime}
            </div>
          </div>
        </div>

        <p className="tg-reasoning">{data.reasoning}</p>

        {data.warnings?.length > 0 && (
          <>
            <div className="tg-section-title" style={{ marginBottom: 12 }}>
              Active Warnings
            </div>
            <div className="tg-warnings">
              {data.warnings.map((w, i) => (
                <div key={i} className="tg-warning-item">
                  <span className="tg-warning-icon">⚑</span>
                  {w}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Data summary */}
      <div className="tg-card">
        <div className="tg-section-title">Assessment Data</div>

        <div className="tg-data-row">
          <div className="tg-data-item">
            <div className="tg-data-key">Weather</div>
            <div className="tg-data-val">{data.weatherData?.conditions || "—"}</div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Temperature</div>
            <div className="tg-data-val">
              {data.weatherData?.temperatureC != null
                ? `${data.weatherData.temperatureC}°C`
                : "—"}
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Trail Surface</div>
            <div className="tg-data-val" style={{ textTransform: "capitalize" }}>
              {data.trailConditions?.surfaceState || "—"}
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Active Hazards</div>
            <div className="tg-data-val">
              {data.trailConditions?.activeHazards ?? "—"}
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Risk Score</div>
            <div className="tg-data-val">
              {data.incidentRisk?.riskScore ?? "—"} / 100
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Est. Duration</div>
            <div className="tg-data-val">
              {data.completionEstimate?.estimatedDurationHuman || "—"}
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Est. Return</div>
            <div className="tg-data-val">
              {data.completionEstimate?.estimatedReturnTime || "—"}
            </div>
          </div>
          <div className="tg-data-item">
            <div className="tg-data-key">Back Before Dark</div>
            <div
              className="tg-data-val"
              style={{
                color: data.completionEstimate?.returnsBeforeSunset
                  ? "#22c55e"
                  : "#ef4444",
              }}
            >
              {data.completionEstimate?.returnsBeforeSunset ? "Yes ✓" : "No ✕"}
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        fontSize: 11, color: "rgba(255,255,255,0.35)",
                        marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
            <span>AI CONFIDENCE</span>
            <span>{conf}%</span>
          </div>
          <div className="tg-conf-bar-track">
            <div
              className="tg-conf-bar-fill"
              style={{
                width: `${conf}%`,
                background: cfg.color,
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)",
                       fontFamily: "'JetBrains Mono',monospace" }}>
          {data.requestId && `REQ: ${data.requestId.slice(0, 8).toUpperCase()}`}
        </span>
        <button className="tg-reset-btn" onClick={onReset}>
          ← New Assessment
        </button>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SafetyAssessmentForm() {
  const [form, setForm] = useState({
    userId:           "",
    trailId:          "",
    plannedDate:      "",
    plannedStartTime: "06:30",
    declaredExpLevel: "intermediate",
  });
  const [status, setStatus]       = useState("idle"); // idle | loading | success | error
  const [currentStep, setStep]    = useState(0);
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Simulate step progression while waiting
  const startStepSimulation = () => {
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setStep(step);
      if (step >= PIPELINE_STEPS.length - 1) clearInterval(iv);
    }, 700);
    return iv;
  };

  const handleSubmit = async () => {
    // Basic validation
    const missing = Object.entries({
      userId: "User ID",
      trailId: "Trail ID",
      plannedDate: "Planned Date",
      plannedStartTime: "Start Time",
    }).filter(([k]) => !form[k].trim());

    if (missing.length) {
      setErrorMsg(`Please fill in: ${missing.map(([, v]) => v).join(", ")}`);
      return;
    }

    setStatus("loading");
    setStep(0);
    setErrorMsg("");
    const iv = startStepSimulation();

    try {
      const resp = await fetch(`${ORCHESTRATOR_URL}/assess-trail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      clearInterval(iv);
      setStep(PIPELINE_STEPS.length);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setResult(data);
      setStatus("success");
    } catch (err) {
      clearInterval(iv);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setStep(0);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div className="tg-wrap">
        <div className="tg-inner">

          {/* Header */}
          <div className="tg-header">
            <div>
              <div className="tg-logo">TRAIL<span>GUARD</span></div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div className="tg-tagline">Smart Hiking Safety Platform</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                Scenario 1 · Trail Safety Assessment
              </div>
            </div>
          </div>

          {/* Step tracker */}
          <div className="tg-steps">
            {["Profile", "Weather", "Hazards", "Risk", "Time", "AI Eval"].map(
              (label, i) => {
                const state =
                  status === "success" ? "done"
                  : status === "loading" && i <= currentStep ? i < currentStep ? "done" : "active"
                  : "idle";
                return (
                  <div key={i} className="tg-step">
                    {i > 0 && <div className="tg-step-line" />}
                    <div className={`tg-step-dot ${state}`}>{state === "done" ? "✓" : i + 1}</div>
                    <div className={`tg-step-label ${state === "active" ? "active" : ""}`}>
                      {label}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* ── Idle / Form ── */}
          {status === "idle" && (
            <>
              {/* Error banner */}
              {errorMsg && (
                <div className="tg-error" style={{ marginBottom: 16 }}>
                  <span>⚠</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Hiker + Trail info */}
              <div className="tg-card">
                <div className="tg-section-title">Hiker & Trail</div>
                <div className="tg-grid tg-grid-2">
                  <div className="tg-field">
                    <label className="tg-label">User ID</label>
                    <input
                      className="tg-input"
                      name="userId"
                      placeholder="usr_001"
                      value={form.userId}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="tg-field">
                    <label className="tg-label">Trail ID</label>
                    <input
                      className="tg-input"
                      name="trailId"
                      placeholder="trail_mt_kinabalu"
                      value={form.trailId}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Date + Time */}
              <div className="tg-card">
                <div className="tg-section-title">Planned Hike</div>
                <div className="tg-grid tg-grid-2">
                  <div className="tg-field">
                    <label className="tg-label">Planned Date</label>
                    <input
                      className="tg-input"
                      type="date"
                      name="plannedDate"
                      value={form.plannedDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="tg-field">
                    <label className="tg-label">Start Time</label>
                    <input
                      className="tg-input"
                      type="time"
                      name="plannedStartTime"
                      value={form.plannedStartTime}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Experience level */}
              <div className="tg-card">
                <div className="tg-section-title">Experience Level</div>
                <div className="tg-exp-grid">
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      className={`tg-exp-pill ${form.declaredExpLevel === lvl.value ? "selected" : ""}`}
                      onClick={() =>
                        setForm((f) => ({ ...f, declaredExpLevel: lvl.value }))
                      }
                    >
                      <span className="tg-exp-pill-label">{lvl.label}</span>
                      <span className="tg-exp-pill-desc">{lvl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="tg-btn"
                onClick={handleSubmit}
                disabled={status === "loading"}
              >
                Run Safety Assessment →
              </button>
            </>
          )}

          {/* ── Loading ── */}
          {status === "loading" && (
            <div className="tg-card">
              <LoadingView currentStep={currentStep} />
            </div>
          )}

          {/* ── Error (post-submit) ── */}
          {status === "error" && (
            <>
              <div className="tg-error">
                <span>⚠</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Assessment Failed</div>
                  <div style={{ fontSize: 13 }}>{errorMsg}</div>
                </div>
              </div>
              <button className="tg-reset-btn" onClick={handleReset}
                      style={{ marginTop: 12 }}>
                ← Try Again
              </button>
            </>
          )}

          {/* ── Success ── */}
          {status === "success" && result && (
            <ResultView data={result} onReset={handleReset} />
          )}

        </div>
      </div>
    </>
  );
}
