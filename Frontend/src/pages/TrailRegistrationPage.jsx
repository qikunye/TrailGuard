import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import HikeRouteMap from "../components/map/HikeRouteMap.jsx";
import { useAssessment, deriveExpLevel } from "../hooks/useAssessment.js";
import { useProfile } from "../hooks/useProfile.js";
import AssessmentModal from "../components/assessment/AssessmentModal.jsx";
import { kongFetch } from "../lib/kongClient.js";

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8080/api/orchestrator";

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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrailRegistrationPage() {
  const { assess, loading: checkLoading, error: checkError } = useAssessment();
  const [assessment,  setAssessment]  = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  // ── Trail list from GET /trails (proxied from TrailDBAPI/GetAllTrails) ──────
  const [trails, setTrails] = useState(FALLBACK_TRAILS);
  useEffect(() => {
    kongFetch(`${ORCHESTRATOR_URL}/trails`)
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

  // ── Read profile (scoped to current Firebase user) ────────────────────────
  const { profile: hikerProfile, uid } = useProfile();

  const userId      = hikerProfile.userId || "usr_001";
  const declaredExp = deriveExpLevel(Number(hikerProfile.totalHikesCompleted) || 0);
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
    const hike = { ...form, registeredAt: Date.now(), assessment: assessment?._raw ?? null };

    const upcomingKey    = uid ? `upcomingHike_${uid}`    : "upcomingHike";
    const registeredKey  = uid ? `registeredHikes_${uid}` : "registeredHikes";

    // Keep upcomingHike for dashboard compat
    localStorage.setItem(upcomingKey, JSON.stringify(hike));

    // Also append to registeredHikes list used by Track Hike page
    const existing = (() => { try { return JSON.parse(localStorage.getItem(registeredKey)) ?? []; } catch { return []; } })();
    // Avoid duplicates by trailId+startDate
    const deduped = existing.filter(h => !(h.selectedTrailId === hike.selectedTrailId && h.startDate === hike.startDate));
    localStorage.setItem(registeredKey, JSON.stringify([hike, ...deduped]));

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
