import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import HikeRouteMap from "../components/map/HikeRouteMap.jsx";
import { useAssessment, deriveExpLevel } from "../hooks/useAssessment.js";

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const wrap = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const inp  = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl  = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

// ── Static fallback if backend is unreachable ─────────────────────────────────
const FALLBACK_TRAILS = [
  { trailId: "1", trailName: "Southern Ridges Loop",       difficulty: "Easy",     operationalStatus: "OPEN",
    startPoint: "1.2742, 103.8089", endPoint: "1.2618, 103.8232" },
  { trailId: "2", trailName: "MacRitchie Reservoir Trail", difficulty: "Moderate", operationalStatus: "OPEN",
    startPoint: "1.3441, 103.8198", endPoint: "1.3602, 103.8326" },
];

// ── Decision styling ──────────────────────────────────────────────────────────
const DECISION_META = {
  GO: {
    emoji: "✅", label: "Clear to Go",
    color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/30",
    barColor: "#4ade80",
  },
  CAUTION: {
    emoji: "⚠️", label: "Proceed with Caution",
    color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30",
    barColor: "#fbbf24",
  },
  NO_GO: {
    emoji: "🚫", label: "Do Not Go",
    color: "text-red-400",   bg: "bg-red-400/10",   border: "border-red-400/30",
    barColor: "#f87171",
  },
};

// ── Severity badge colour ─────────────────────────────────────────────────────
const SEV_COLOR = {
  none:     "text-muted",
  minor:    "text-green-400",
  moderate: "text-amber-400",
  severe:   "text-red-400",
  critical: "text-red-600",
};

// ── Assessment result modal ───────────────────────────────────────────────────
function AssessmentModal({ assessment, onClose, onRegister }) {
  const meta = DECISION_META[assessment.verdict] ?? DECISION_META.CAUTION;

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-card border border-line rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className={`p-6 pb-4 rounded-t-3xl sm:rounded-t-2xl border-b border-line ${meta.bg}`}>
          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{meta.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-xl font-bold ${meta.color}`}>{meta.label}</div>
              <div className="text-sm text-muted mt-0.5 truncate">
                {assessment.trailName} · {assessment.date}
                {assessment.startTime && ` · ${assessment.startTime}`}
              </div>
            </div>
            <button onClick={onClose}
              className="text-muted hover:text-fg transition-colors bg-transparent border-none cursor-pointer text-xl leading-none mt-0.5 shrink-0">
              ✕
            </button>
          </div>

          {/* Confidence bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
              <span>AI CONFIDENCE</span>
              <span>{assessment.confidence}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${assessment.confidence}%`, background: meta.barColor }} />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 flex flex-col gap-4">

          {/* AI Assessment narrative */}
          {assessment.reasoning && (
            <section>
              <div className={`text-[10px] uppercase tracking-widest font-mono text-muted mb-2`}>AI Assessment</div>
              <p className="text-sm text-fg/80 leading-relaxed">{assessment.reasoning}</p>
            </section>
          )}

          {/* Key Reasons */}
          {assessment.keyReasons?.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Key Factors</div>
              <ul className="flex flex-col gap-1.5">
                {assessment.keyReasons.map((r, i) => (
                  <li key={i} className="text-sm text-fg flex items-start gap-2">
                    <span className={`${meta.color} mt-0.5 shrink-0`}>•</span>{r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trail Conditions */}
          <section className="bg-surface rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-3">Trail Conditions</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className={`font-semibold capitalize ${
                  assessment.trailStatus?.operationalStatus === "open" ? "text-primary" : "text-red-400"
                }`}>{assessment.trailStatus?.operationalStatus ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Difficulty</span>
                <span className="font-semibold text-fg">{assessment.trailStatus?.difficulty ?? "—"} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Active Hazards</span>
                <span className="font-semibold text-fg">{assessment.trailStatus?.activeHazardCounts ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Highest Severity</span>
                <span className={`font-semibold capitalize ${SEV_COLOR[assessment.trailStatus?.highestSeverity] ?? "text-fg"}`}>
                  {assessment.trailStatus?.highestSeverity ?? "none"}
                </span>
              </div>
              {assessment.trailStatus?.hazardTypes?.length > 0 && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-muted">Hazard Types</span>
                  <span className="font-semibold text-fg text-right max-w-[60%] text-xs">
                    {assessment.trailStatus.hazardTypes.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Weather */}
          {assessment.weather && (
            <section className="bg-surface rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-3">
                Weather at Start Time
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                {[
                  { icon: "🌡", label: "Temp",     value: assessment.weather.temp != null ? `${assessment.weather.temp}°C` : "—" },
                  { icon: "💨", label: "Wind",      value: assessment.weather.wind != null ? `${assessment.weather.wind} km/h` : "—" },
                  { icon: "💧", label: "Humidity",  value: assessment.weather.humidity != null ? `${assessment.weather.humidity}%` : "—" },
                  { icon: "🔆", label: "UV",        value: assessment.weather.uvIndex != null ? assessment.weather.uvIndex : "—" },
                  { icon: "☁️", label: "Conditions",value: assessment.weather.conditions || "—" },
                  { icon: "👁", label: "Severity",  value: assessment.weather.severity || "—" },
                ].map(s => (
                  <div key={s.label} className="bg-card rounded-lg py-2 px-1">
                    <div className="text-base leading-none mb-1">{s.icon}</div>
                    <div className="text-[9px] text-muted uppercase tracking-wide">{s.label}</div>
                    <div className="text-xs font-semibold text-fg mt-0.5 capitalize">{s.value}</div>
                  </div>
                ))}
              </div>
              {assessment.weather.safetyFlags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assessment.weather.safetyFlags.map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 font-mono">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Incident summary */}
          <section className="bg-surface rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Recent Incidents</div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted">Last 30 days </span>
                <span className="font-bold text-fg">{assessment.incidents?.count30Days ?? 0}</span>
              </div>
              <div>
                <span className="text-muted">Last 90 days </span>
                <span className="font-bold text-fg">{assessment.incidents?.count90Days ?? 0}</span>
              </div>
            </div>
          </section>

          {/* Completion estimate */}
          {assessment.completion?.estimatedDuration && (
            <section className="bg-surface rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Completion Estimate</div>
              <div className="flex gap-4 text-sm flex-wrap">
                <div>
                  <span className="text-muted">Duration </span>
                  <span className="font-bold text-fg">{assessment.completion.estimatedDuration}</span>
                </div>
                {assessment.completion.estimatedReturn && (
                  <div>
                    <span className="text-muted">Return </span>
                    <span className="font-bold text-fg">{assessment.completion.estimatedReturn}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted">Before dark </span>
                  <span className={`font-bold ${assessment.completion.returnsBeforeSunset ? "text-primary" : "text-red-400"}`}>
                    {assessment.completion.returnsBeforeSunset ? "Yes ✓" : "No ✕"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Warnings / precautions */}
          {assessment.warnings?.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Recommended Precautions</div>
              <ul className="flex flex-col gap-1.5">
                {assessment.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-fg/80 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">⚑</span>{w}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="p-5 pt-0 flex gap-3 sticky bottom-0 bg-card border-t border-line">
          <button onClick={onClose}
            className="flex-1 py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer hover:border-primary hover:text-fg transition-colors">
            Close
          </button>
          <button onClick={onRegister}
            className="flex-1 py-3 px-4 bg-primary text-bg rounded-full text-sm font-bold cursor-pointer hover:opacity-90 transition-all border-none">
            Register Hike →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrailRegistrationPage() {
  const { assess, loading: checkLoading, error: checkError } = useAssessment();
  const [assessment,  setAssessment]  = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  // ── Trail list from GET /trails (proxied from TrailDBAPI/GetAllTrails) ──────
  const [trails, setTrails] = useState(FALLBACK_TRAILS);
  useEffect(() => {
    fetch(`${ORCHESTRATOR_URL}/trails`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (data.trails?.length) setTrails(data.trails); })
      .catch(() => { /* keep FALLBACK_TRAILS silently */ });
  }, []);

  const [form, setForm] = useState({
    // Trail selection — must map to a known trailId for the evaluator to work
    selectedTrailId:   "",
    // Map route (visualization only)
    startLocation:     "",
    endLocation:       "",
    distanceText:      "",
    durationText:      "",
    // Hike details
    startDate:         new Date().toISOString().split("T")[0],
    startTime:         "08:00",
    estimatedDuration: "",
    partySize:         1,
    notes:             "",
    // Coords from map (visualization, not sent to evaluator)
    startLat: null, startLng: null, endLat: null, endLng: null, path: null,
  });

  // ── Read profile from localStorage ────────────────────────────────────────
  const [hikerProfile, setHikerProfile] = useState({});
  useEffect(() => {
    const stored = localStorage.getItem("tg_profile");
    if (stored) { try { setHikerProfile(JSON.parse(stored)); } catch (_) {} }
  }, []);

  const userId        = hikerProfile.userId       || "usr_001";    // fallback to demo user
  const declaredExp   = deriveExpLevel(Number(hikerProfile.totalHikesCompleted) || 0);
  const selectedTrail = trails.find(t => t.trailId === form.selectedTrailId);

  function handleRouteReady({ startName, endName, distanceText, durationText, durationSeconds, startLat, startLng, endLat, endLng, path }) {
    setForm(f => ({
      ...f, startLocation: startName, endLocation: endName,
      distanceText, durationText,
      estimatedDuration: (durationSeconds / 3600).toFixed(1),
      startLat, startLng, endLat, endLng, path,
    }));
  }

  // ── Check Trail ────────────────────────────────────────────────────────────
  async function handleCheckTrail() {
    if (!form.selectedTrailId) return;

    const result = await assess({
      userId:           userId,
      trailId:          form.selectedTrailId,
      plannedDate:      form.startDate,
      plannedStartTime: form.startTime,
      declaredExpLevel: declaredExp,
    });

    if (result) {
      setAssessment(result);
      setShowModal(true);
    }
  }

  // ── Register Hike ─────────────────────────────────────────────────────────
  function handleRegister() {
    localStorage.setItem("upcomingHike", JSON.stringify({
      ...form, registeredAt: Date.now(),
      assessment: assessment?._raw ?? null,
    }));
    setShowModal(false);
    setSubmitted(true);
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen relative z-1">
        <Navbar />
        <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
          <div className="bg-card border border-line rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-fg mb-1">Hike Registered!</h2>
            {selectedTrail && <p className="text-sm text-primary mb-1">{selectedTrail.trailName}</p>}
            {form.distanceText && <p className="text-sm text-muted mb-1">{form.distanceText} · {form.durationText} walking</p>}
            <p className="text-sm text-muted mb-6">Your emergency contacts will be notified if you don&apos;t check in on time.</p>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button onClick={() => setSubmitted(false)}
                className="flex-1 py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
                Register Another
              </button>
              <Link to="/dashboard" className="flex-1 no-underline">
                <button className="w-full py-3 px-4 bg-primary text-bg rounded-full text-sm font-bold cursor-pointer transition-all hover:opacity-90 border-none">
                  Dashboard
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen relative z-1">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Register for a Hike</h1>
        <p className="text-sm text-muted mb-5">Select a trail, review the route, then check safety before registering</p>

        <form onSubmit={e => { e.preventDefault(); handleRegister(); }}>

          {/* ── Step 1: Trail Selection ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.82rem] font-semibold tracking-[0.08em] uppercase font-mono text-muted mb-4">
              Step 1 · Select Trail
            </h2>

            <label className={lbl}>
              Trail <span className="text-red-400/70 font-normal">(required)</span>
            </label>
            <div className={`${wrap} pr-4 mb-3`}>
              <select value={form.selectedTrailId}
                onChange={e => setForm(f => ({ ...f, selectedTrailId: e.target.value }))}
                className="flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 cursor-pointer">
                <option value="" className="bg-card">— Choose a trail —</option>
                {trails.map(t => (
                  <option key={t.trailId} value={t.trailId} className="bg-card">
                    {t.trailName} · {t.difficulty}
                    {t.operationalStatus === "CLOSED" ? " · CLOSED" : t.operationalStatus === "CAUTION" ? " · CAUTION" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Trail detail chips + hiker context — shown after selection */}
            {selectedTrail && (
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-mono ${
                  selectedTrail.operationalStatus === "OPEN"
                    ? "text-primary bg-primary/10 border-primary/20"
                    : selectedTrail.operationalStatus === "CAUTION"
                    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                    : "text-red-400 bg-red-400/10 border-red-400/20"
                }`}>
                  {selectedTrail.operationalStatus}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full border text-muted bg-surface border-line font-mono">
                  {selectedTrail.difficulty}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full border text-muted bg-surface border-line font-mono capitalize">
                  Your level: {declaredExp}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full border text-muted bg-surface border-line font-mono">
                  Hiker: {userId}
                </span>
              </div>
            )}

            {!form.selectedTrailId && (
              <p className="text-xs text-muted mt-1">Select a trail to see the route and enable the safety check</p>
            )}
          </div>

          {/* ── Step 2: Route Map — only shown after trail selected ── */}
          {form.selectedTrailId && (
            <div className="mb-4">
              <div className="text-[0.82rem] font-semibold tracking-[0.08em] uppercase font-mono text-muted mb-2 px-1">
                Step 2 · Route Preview
              </div>
              {/* key forces map to remount (and re-geocode locations) when trail changes */}
              <HikeRouteMap
                key={form.selectedTrailId}
                initialStart={selectedTrail?.startPoint}
                initialEnd={selectedTrail?.endPoint}
                startLabel={selectedTrail ? `${selectedTrail.trailName} · Start` : undefined}
                endLabel={selectedTrail ? `${selectedTrail.trailName} · End` : undefined}
                onRouteReady={handleRouteReady}
                onStartChange={name => setForm(f => ({ ...f, startLocation: name }))}
                onEndChange={name   => setForm(f => ({ ...f, endLocation:   name }))}
              />
            </div>
          )}

          {/* ── Step 3: Hike Details ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.82rem] font-semibold tracking-[0.08em] uppercase font-mono text-muted mb-4">
              Step 3 · Hike Details
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className={lbl}>Start Date</label>
                <div className={wrap}>
                  <input type="date" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Start Time</label>
                <div className={wrap}>
                  <input type="time" value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={inp} />
                </div>
              </div>
            </div>

            <div>
              <label className={lbl}>Additional Notes <span className="text-muted font-normal">(optional)</span></label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Vehicle parked at, special equipment, planned sub-route..."
                rows={2}
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary" />
            </div>
          </div>

          {/* Error banner */}
          {checkError && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-400">
              {checkError}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3">
            <button type="button"
              disabled={!form.selectedTrailId || checkLoading}
              onClick={handleCheckTrail}
              className="flex-1 py-3 px-4 bg-transparent border border-primary/40 text-primary rounded-full text-[0.95rem] font-semibold flex items-center justify-center gap-2 transition-all hover:bg-primary/10 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:translate-y-0 border-solid cursor-pointer">
              {checkLoading
                ? <><div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Checking…</>
                : <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Check Trail
                  </>}
            </button>
            <button type="submit"
              className="flex-1 py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
              Register Hike
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </form>
      </main>

      {/* Assessment result modal */}
      {showModal && assessment && (
        <AssessmentModal
          assessment={assessment}
          onClose={() => setShowModal(false)}
          onRegister={handleRegister}
        />
      )}
    </div>
  );
}
