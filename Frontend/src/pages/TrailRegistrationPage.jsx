import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import HikeRouteMap from "../components/map/HikeRouteMap.jsx";
import { useAssessment } from "../hooks/useAssessment.js";

const wrap = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const inp  = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl  = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

const verdictMeta = {
  GO:      { emoji: "✅", label: "Go for it",  color: "text-primary", bg: "bg-primary/10",  border: "border-primary/20" },
  CAUTION: { emoji: "⚠️", label: "Caution",    color: "text-amber",   bg: "bg-amber/10",    border: "border-amber/20"   },
  NO_GO:   { emoji: "🚫", label: "Don't Go",   color: "text-red",     bg: "bg-red/10",      border: "border-red/20"     },
};

export default function TrailRegistrationPage() {
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const { assess, loading: checkLoading, error: checkError } = useAssessment();
  const [assessment, setAssessment] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    startLocation:   "",
    endLocation:     "",
    distanceText:    "",
    durationText:    "",
    startDate:       new Date().toISOString().split("T")[0],
    startTime:       "08:00",
    estimatedDuration: "",
    partySize:       1,
    notes:           "",
    startLat: null, startLng: null,
    endLat:   null, endLng:   null,
    path:     null,
  });

  function handleRouteReady({ startName, endName, distanceText, durationText, durationSeconds, startLat, startLng, endLat, endLng, path }) {
    setForm(f => ({
      ...f,
      startLocation:    startName,
      endLocation:      endName,
      distanceText,
      durationText,
      estimatedDuration: (durationSeconds / 3600).toFixed(1),
      startLat, startLng, endLat, endLng, path,
    }));
  }

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
            {form.startLocation && form.endLocation && (
              <p className="text-sm text-primary mb-1">{form.startLocation} → {form.endLocation}</p>
            )}
            {form.distanceText && (
              <p className="text-sm text-muted mb-1">{form.distanceText} · {form.durationText} walking</p>
            )}
            <p className="text-sm text-muted mb-6">Your emergency contacts will be notified if you don&apos;t check in on time.</p>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button
                onClick={() => setSubmitted(false)}
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

  return (
    <div className="flex flex-col min-h-screen relative z-1">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Register for a Hike</h1>
        <p className="text-sm text-muted mb-5">Set your route — we&apos;ll show the walking path and track your check-in</p>

        {/* Map with start/end inputs + route + current location */}
        <HikeRouteMap
          onRouteReady={handleRouteReady}
          onStartChange={(name) => setForm(f => ({ ...f, startLocation: name }))}
          onEndChange={(name)   => setForm(f => ({ ...f, endLocation:   name }))}
          initialStart={routeState?.start}
          initialEnd={routeState?.end}
        />

        {/* Rest of the form */}
        <form
          className="bg-card border border-line rounded-2xl p-6"
          onSubmit={e => {
            e.preventDefault();
            localStorage.setItem("upcomingHike", JSON.stringify({ ...form, registeredAt: Date.now() }));
            setSubmitted(true);
          }}
        >
          <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Hike Details</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-4">
              <label className={lbl}>Start Date</label>
              <div className={wrap}>
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className={inp} />
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Start Time</label>
              <div className={wrap}>
                <input type="time" value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  className={inp} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-4">
              <label className={lbl}>Est. Duration (hrs)</label>
              <div className={wrap}>
                <input type="number" min="0.5" max="24" step="0.1"
                  placeholder={form.durationText ? `~${form.estimatedDuration}` : "e.g. 3.5"}
                  value={form.estimatedDuration}
                  onChange={e => setForm(f => ({ ...f, estimatedDuration: parseFloat(e.target.value) || "" }))}
                  className={inp} />
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Party Size</label>
              <div className={wrap}>
                <input type="number" min="1" max="50" value={form.partySize}
                  onChange={e => setForm(f => ({ ...f, partySize: e.target.value }))}
                  className={inp} />
              </div>
            </div>
          </div>

          <div className="mb-5">
            <label className={lbl}>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Planned route, vehicle parked at, special equipment..."
              rows={2}
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!form.startLocation || checkLoading}
              onClick={async () => {
                const result = await assess({
                  trailId:   form.startLocation
                    ? (form.endLocation
                        ? `${form.startLocation} to ${form.endLocation}`
                        : form.startLocation
                      ).toLowerCase().replace(/\s+/g, "-")
                    : "",
                  trailName: form.startLocation && form.endLocation
                    ? `${form.startLocation} to ${form.endLocation}`
                    : form.startLocation,
                  date:      form.startDate,
                  partySize: Number(form.partySize),
                });
                if (result) setAssessment(result);
              }}
              className="flex-1 py-3 px-4 bg-transparent border border-primary/40 text-primary rounded-full text-[0.95rem] font-semibold flex items-center justify-center gap-2 transition-all hover:bg-primary/10 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:translate-y-0 border-solid cursor-pointer">
              {checkLoading
                ? <><div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Checking…</>
                : <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Check Trail
                  </>
              }
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
              Register Hike
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </form>

        {/* ── INLINE ASSESSMENT ERROR ── */}
        {checkError && (
          <div className="bg-red/10 border border-red/20 rounded-2xl px-4 py-3 mt-4 text-sm text-red">
            {checkError}
          </div>
        )}

        {/* ── INLINE ASSESSMENT RESULT ── */}
        {assessment && (() => {
          const meta = verdictMeta[assessment.verdict] ?? verdictMeta.CAUTION;
          return (
            <div className={`mt-4 rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <p className={`text-base font-bold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-muted">
                    {assessment.trailName ?? `${form.startLocation} → ${form.endLocation}`} · {assessment.date ?? form.startDate}
                  </p>
                </div>
                {assessment.confidence != null && (
                  <div className="ml-auto text-right">
                    <p className="text-xs text-muted mb-1">AI Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${assessment.confidence}%` }} />
                      </div>
                      <span className="text-xs font-mono text-fg">{assessment.confidence}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Key factors */}
              {assessment.reasons?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Key Factors</p>
                  <ul className="flex flex-col gap-1.5">
                    {assessment.reasons.map((r, i) => (
                      <li key={i} className="text-sm text-fg flex items-start gap-2">
                        <span className={`${meta.color} mt-0.5 shrink-0`}>•</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weather strip */}
              {assessment.weather && (
                <div className="bg-white/5 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: "🌡", label: "Temp",     value: `${assessment.weather.temp}°C` },
                    { icon: "💨", label: "Wind",      value: `${assessment.weather.wind} km/h` },
                    { icon: "💧", label: "Humidity",  value: `${assessment.weather.humidity}%` },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="text-lg">{s.icon}</div>
                      <div className="text-[10px] text-muted">{s.label}</div>
                      <div className="text-sm font-semibold text-fg">{s.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
