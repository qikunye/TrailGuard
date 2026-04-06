import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
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

// ── Hardcoded trail distance / duration (matches Recommended Trails on dashboard) ─
const TRAIL_META = {
  "1":  { distanceText: "9 km",    durationText: "3 hr",       estimatedDuration: "3.0" },
  "2":  { distanceText: "11 km",   durationText: "3 hr 30 min", estimatedDuration: "3.5" },
  "3":  { distanceText: "6 km",    durationText: "2 hr 30 min", estimatedDuration: "2.5" },
  "4":  { distanceText: "3.5 km",  durationText: "1 hr 30 min", estimatedDuration: "1.5" },
  "5":  { distanceText: "7 km",    durationText: "2 hr 30 min", estimatedDuration: "2.5" },
  "6":  { distanceText: "3 km",    durationText: "1 hr 30 min", estimatedDuration: "1.5" },
  "7":  { distanceText: "5 km",    durationText: "2 hr",       estimatedDuration: "2.0" },
  "8":  { distanceText: "4.5 km",  durationText: "1 hr 45 min", estimatedDuration: "1.75" },
  "9":  { distanceText: "4 km",    durationText: "1 hr 30 min", estimatedDuration: "1.5" },
  "10": { distanceText: "5.5 km",  durationText: "2 hr",       estimatedDuration: "2.0" },
};

// ── Static fallback if backend is unreachable ─────────────────────────────────
const FALLBACK_TRAILS = [
  { trailId: "1",  trailName: "Southern Ridges Loop",          difficulty: "Easy",     operationalStatus: "OPEN",    startPoint: "1.2644, 103.8208", endPoint: "1.2895, 103.8043" },
  { trailId: "2",  trailName: "MacRitchie Reservoir Trail",    difficulty: "Moderate", operationalStatus: "OPEN",    startPoint: "1.3442, 103.8197", endPoint: "1.3592, 103.8320" },
  { trailId: "3",  trailName: "Bukit Timah Summit Trail",      difficulty: "Hard",     operationalStatus: "OPEN",    startPoint: "1.3511, 103.7761", endPoint: "1.3468, 103.7738" },
  { trailId: "4",  trailName: "Labrador Nature Reserve Trail", difficulty: "Easy",     operationalStatus: "OPEN",    startPoint: "1.2627, 103.8030", endPoint: "1.2706, 103.8083" },
  { trailId: "5",  trailName: "Sungei Buloh Wetland Walk",     difficulty: "Easy",     operationalStatus: "OPEN",    startPoint: "1.4467, 103.7240", endPoint: "1.4514, 103.7304" },
  { trailId: "6",  trailName: "Bukit Batok Nature Park Loop",  difficulty: "Easy",     operationalStatus: "OPEN",    startPoint: "1.3479, 103.7601", endPoint: "1.3504, 103.7635" },
  { trailId: "7",  trailName: "Pulau Ubin Chek Jawa Trail",    difficulty: "Easy",     operationalStatus: "OPEN",    startPoint: "1.4044, 103.9592", endPoint: "1.4002, 103.9671" },
  { trailId: "8",  trailName: "Kent Ridge Park Trail",         difficulty: "Moderate", operationalStatus: "OPEN",    startPoint: "1.2960, 103.7836", endPoint: "1.2875, 103.7880" },
  { trailId: "9",  trailName: "Admiralty Park Mangrove Trail", difficulty: "Easy",     operationalStatus: "CAUTION", startPoint: "1.4406, 103.7990", endPoint: "1.4451, 103.8032" },
  { trailId: "10", trailName: "Clementi Forest Trail",         difficulty: "Moderate", operationalStatus: "OPEN",    startPoint: "1.3243, 103.7682", endPoint: "1.3299, 103.7748" },
];

// ── Difficulty + status badges ────────────────────────────────────────────────
function DiffBadge({ difficulty }) {
  const map = {
    Easy:     "text-primary bg-primary/10 border-primary/20",
    Moderate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    Hard:     "text-red-400 bg-red-400/10 border-red-400/20",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${map[difficulty] ?? "text-muted bg-white/5 border-white/10"}`}>
      {difficulty}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = (status ?? "").toUpperCase();
  if (s === "CLOSED")  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-red-400 bg-red-400/10 border-red-400/20 shrink-0">CLOSED</span>;
  if (s === "CAUTION") return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-400 bg-amber-400/10 border-amber-400/20 shrink-0">CAUTION</span>;
  return null; // OPEN — no badge needed
}

// ── Custom trail dropdown ─────────────────────────────────────────────────────
function TrailDropdown({ trails, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef    = useRef(null);
  const selected = trails.find(t => t.trailId === value);

  // Recalculate trigger position whenever the list opens
  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    const h = (e) => {
      // Close only when clicking outside BOTH the trigger and the floating list
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Keep rect in sync on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <div>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 bg-surface border rounded-2xl px-4 py-3.5 text-left transition-all cursor-pointer outline-none ${
          open ? "border-primary ring-2 ring-primary/20" : "border-line hover:border-white/20"
        }`}
      >
        {selected ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{selected.trailName}</p>
            </div>
            <DiffBadge difficulty={selected.difficulty} />
            <StatusBadge status={selected.operationalStatus} />
          </>
        ) : (
          <span className="text-sm text-muted flex-1">— Choose a trail —</span>
        )}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-muted shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Options list — fixed so it escapes any parent stacking context */}
      {open && rect && (
        <div
          ref={listRef}
          style={{
            position: "fixed",
            top: rect.bottom + 6,
            left: rect.left,
            width: rect.width,
            maxHeight: 320,
            overflowY: "auto",
            zIndex: 9999,
          }}
          className="bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {trails.map((t, i) => {
            const isSelected = t.trailId === value;
            return (
              <button
                type="button"
                key={t.trailId}
                onClick={() => { onChange(t.trailId); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-none outline-none ${
                  isSelected ? "bg-primary/10" : "bg-transparent hover:bg-white/5"
                } ${i !== 0 ? "border-t border-white/[0.04]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? "text-primary" : "text-fg"}`}>
                    {t.trailName}
                  </p>
                </div>
                <DiffBadge difficulty={t.difficulty} />
                <StatusBadge status={t.operationalStatus} />
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrailRegistrationPage() {
  const location = useLocation();
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
    selectedTrailId:   location.state?.trailId ?? "",
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

  const userId      = String(hikerProfile.userId || "usr_001");
  const declaredExp = deriveExpLevel(Number(hikerProfile.totalHikesCompleted) || 0);
  const selectedTrail = trails.find(t => t.trailId === form.selectedTrailId);

  function handleRouteReady({ startName, endName, distanceText, durationText, durationSeconds, startLat, startLng, endLat, endLng, path }) {
    const meta = TRAIL_META[form.selectedTrailId];
    setForm(f => ({
      ...f, startLocation: startName, endLocation: endName,
      distanceText:      meta?.distanceText      ?? distanceText,
      durationText:      meta?.durationText      ?? durationText,
      estimatedDuration: meta?.estimatedDuration ?? (durationSeconds / 3600).toFixed(1),
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
            <div className="mb-3">
              <TrailDropdown
                trails={trails}
                value={form.selectedTrailId}
                onChange={id => setForm(f => ({ ...f, selectedTrailId: id }))}
              />
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
                distanceText={TRAIL_META[form.selectedTrailId]?.distanceText}
                durationText={TRAIL_META[form.selectedTrailId]?.durationText}
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
