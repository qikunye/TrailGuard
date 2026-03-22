import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Navbar from "../components/shared/Navbar.jsx";

// ── Haversine distance in metres ──────────────────────────────────────────────
function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversine(path[i - 1], path[i]);
  return d;
}

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function fmtElapsed(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Fit bounds to show the full planned route on mount ────────────────────────
function FitBounds({ path }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 1) {
      map.fitBounds(path, { padding: [32, 32], animate: false });
    }
  }, []); // only on mount
  return null;
}

// ── Auto-pan map to current position ─────────────────────────────────────────
function AutoPan({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, map.getZoom(), { animate: true });
  }, [pos, map]);
  return null;
}

// ── Map component ──────────────────────────────────────────────────────────────
function TrackMap({ plannedPath, trackedPath, currentPos }) {
  const center = currentPos
    || (plannedPath.length > 0 ? plannedPath[0] : null)
    || [1.3521, 103.8198];

  const planStart = plannedPath[0] ?? null;
  const planEnd   = plannedPath[plannedPath.length - 1] ?? null;

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution=""
      />

      {/* Fit the whole planned route into view on first render */}
      {plannedPath.length > 1 && <FitBounds path={plannedPath} />}

      {/* Planned route – faint dashed */}
      {plannedPath.length > 1 && (
        <Polyline
          positions={plannedPath}
          pathOptions={{ color: "#ffffff", opacity: 0.25, weight: 3, dashArray: "6 6" }}
        />
      )}

      {/* Planned start marker – white ring */}
      {planStart && (
        <CircleMarker
          center={planStart}
          radius={6}
          pathOptions={{ color: "#fff", fillColor: "#fff", fillOpacity: 0.9, weight: 2 }}
        />
      )}

      {/* Planned end marker – white filled */}
      {planEnd && planEnd !== planStart && (
        <CircleMarker
          center={planEnd}
          radius={6}
          pathOptions={{ color: "#fff", fillColor: "#333", fillOpacity: 1, weight: 2 }}
        />
      )}

      {/* Tracked path – bright green */}
      {trackedPath.length > 1 && (
        <Polyline
          positions={trackedPath}
          pathOptions={{ color: "#4ade80", opacity: 0.9, weight: 4 }}
        />
      )}

      {/* Tracked start dot */}
      {trackedPath.length > 0 && (
        <CircleMarker
          center={trackedPath[0]}
          radius={6}
          pathOptions={{ color: "#4ade80", fillColor: "#4ade80", fillOpacity: 1, weight: 2 }}
        />
      )}

      {/* Current position – pulsing */}
      {currentPos && (
        <>
          <CircleMarker
            center={currentPos}
            radius={14}
            pathOptions={{ color: "#4ade80", fillColor: "#4ade80", fillOpacity: 0.15, weight: 0 }}
          />
          <CircleMarker
            center={currentPos}
            radius={7}
            pathOptions={{ color: "#fff", fillColor: "#4ade80", fillOpacity: 1, weight: 2 }}
          />
        </>
      )}

      {currentPos && <AutoPan pos={currentPos} />}
    </MapContainer>
  );
}

// ── Past hike card ─────────────────────────────────────────────────────────────
function PastHikeCard({ hike }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-4 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{hike.trailName}</p>
          <p className="text-xs text-muted mt-0.5">{fmtDate(hike.startedAt)}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-mono text-primary">{fmtElapsed(hike.durationSecs)}</p>
            <p className="text-xs text-muted">{fmtDist(hike.distanceM)}</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Duration", value: fmtElapsed(hike.durationSecs) },
              { label: "Distance", value: fmtDist(hike.distanceM) },
              { label: "Avg Pace", value: hike.distanceM > 0 ? `${((hike.durationSecs / 60) / (hike.distanceM / 1000)).toFixed(1)} min/km` : "–" },
              { label: "Points", value: `${hike.path.length} GPS pts` },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className="text-sm font-semibold text-fg font-mono">{s.value}</p>
              </div>
            ))}
          </div>

          {hike.path.length > 1 && (
            <div className="rounded-xl overflow-hidden" style={{ height: 200 }}>
              <MapContainer
                center={hike.path[0]}
                zoom={14}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
                attributionControl={false}
                scrollWheelZoom={false}
                dragging={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Polyline
                  positions={hike.path}
                  pathOptions={{ color: "#4ade80", opacity: 0.85, weight: 3 }}
                />
                <CircleMarker
                  center={hike.path[0]}
                  radius={5}
                  pathOptions={{ color: "#4ade80", fillColor: "#4ade80", fillOpacity: 1, weight: 2 }}
                />
                <CircleMarker
                  center={hike.path[hike.path.length - 1]}
                  radius={5}
                  pathOptions={{ color: "#f87171", fillColor: "#f87171", fillOpacity: 1, weight: 2 }}
                />
              </MapContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TrackHikePage() {
  const upcomingHike = (() => {
    try { return JSON.parse(localStorage.getItem("upcomingHike")); } catch { return null; }
  })();

  const plannedPath = upcomingHike?.path?.map((p) => [p[0], p[1]]) ?? [];

  // Tracking state
  const [status, setStatus]         = useState("idle");   // idle | tracking | done
  const [trackedPath, setTrackedPath] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [elapsed, setElapsed]       = useState(0);
  const [startedAt, setStartedAt]   = useState(null);
  const [geoError, setGeoError]     = useState(null);

  // Past logs
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hikeHistory")) || []; } catch { return []; }
  });

  const watchIdRef   = useRef(null);
  const intervalRef  = useRef(null);
  const trackedRef   = useRef(trackedPath); // keep ref for stop handler
  trackedRef.current = trackedPath;
  const elapsedRef   = useRef(elapsed);
  elapsedRef.current = elapsed;
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;

  // Resume in-progress session on mount
  useEffect(() => {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem("activeTrack")); } catch { return null; }
    })();
    if (saved?.status === "tracking") {
      const secsElapsed = Math.floor((Date.now() - new Date(saved.startedAt)) / 1000);
      setTrackedPath(saved.path || []);
      setElapsed(secsElapsed);
      setStartedAt(saved.startedAt);
      setStatus("tracking");
    }
  }, []);

  // Start timer when tracking
  useEffect(() => {
    if (status === "tracking") {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [status]);

  // Persist active track
  useEffect(() => {
    if (status === "tracking") {
      localStorage.setItem("activeTrack", JSON.stringify({
        status: "tracking",
        startedAt,
        path: trackedPath,
      }));
    }
  }, [trackedPath, status, startedAt]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoError(null);
    const now = new Date().toISOString();
    setStartedAt(now);
    setTrackedPath([]);
    setElapsed(0);
    setStatus("tracking");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(pt);
        setTrackedPath((prev) => {
          // Deduplicate – only add if moved > 5m
          if (prev.length === 0 || haversine(prev[prev.length - 1], pt) > 5) {
            return [...prev, pt];
          }
          return prev;
        });
      },
      (err) => setGeoError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    clearInterval(intervalRef.current);

    const path = trackedRef.current;
    const dist = totalDistance(path);
    const secs = elapsedRef.current;
    const at   = startedAtRef.current;

    const entry = {
      id:           Date.now(),
      trailName:    upcomingHike
        ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
        : "Free Hike",
      startedAt:    at,
      durationSecs: secs,
      distanceM:    dist,
      path,
    };

    const updated = [entry, ...history];
    localStorage.setItem("hikeHistory", JSON.stringify(updated));
    localStorage.removeItem("activeTrack");
    setHistory(updated);
    setStatus("done");
  }, [history, upcomingHike]);

  const resetTracking = useCallback(() => {
    setStatus("idle");
    setTrackedPath([]);
    setCurrentPos(null);
    setElapsed(0);
    setStartedAt(null);
  }, []);

  const distCovered = totalDistance(trackedPath);

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-12">

        <div className="pt-7 pb-5">
          <h1 className="text-2xl font-bold text-fg">Track Hike</h1>
          <p className="text-sm text-muted mt-0.5">
            {upcomingHike
              ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
              : "Start tracking your GPS trail"}
          </p>
        </div>

        {/* ── MAP ── */}
        <div className="rounded-2xl overflow-hidden border border-white/5 mb-4" style={{ height: 340 }}>
          <TrackMap
            plannedPath={plannedPath}
            trackedPath={trackedPath}
            currentPos={currentPos}
          />
        </div>

        {/* ── MAP LEGEND ── */}
        <div className="flex items-center gap-4 mb-5 px-1 flex-wrap">
          {plannedPath.length > 1 && (
            <div className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="white" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.35"/></svg>
              <span className="text-xs text-muted">Planned route</span>
            </div>
          )}
          {plannedPath.length > 0 && (
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="white" fillOpacity="0.9"/></svg>
              <span className="text-xs text-muted">Start</span>
            </div>
          )}
          {plannedPath.length > 1 && (
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#333" stroke="white" strokeWidth="1.5"/></svg>
              <span className="text-xs text-muted">End</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#4ade80" strokeWidth="3" strokeOpacity="0.9"/></svg>
            <span className="text-xs text-muted">Your path</span>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: "Elapsed",
              value: fmtElapsed(elapsed),
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
            },
            {
              label: "Distance",
              value: fmtDist(distCovered),
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>,
            },
            {
              label: "Avg Pace",
              value: distCovered > 0 && elapsed > 0
                ? `${((elapsed / 60) / (distCovered / 1000)).toFixed(1)} min/km`
                : "–",
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
            },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-4">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">{s.icon}<span className="text-[10px] uppercase tracking-widest">{s.label}</span></div>
              <p className={`text-xl font-bold font-mono ${status === "tracking" ? "text-primary" : "text-fg"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── GPS ERROR ── */}
        {geoError && (
          <div className="bg-red/10 border border-red/20 rounded-2xl px-4 py-3 mb-4 text-sm text-red">
            {geoError}
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
        <div className="flex gap-3 mb-10">
          {status === "idle" && (
            <button
              onClick={startTracking}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-black font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-all border-none cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Hike
            </button>
          )}

          {status === "tracking" && (
            <button
              onClick={stopTracking}
              className="flex-1 flex items-center justify-center gap-2 bg-red/90 text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-all border-none cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              Stop Hike
            </button>
          )}

          {status === "done" && (
            <>
              <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="text-sm font-semibold text-fg">Hike complete!</p>
                  <p className="text-xs text-muted">{fmtElapsed(history[0]?.durationSecs ?? 0)} · {fmtDist(history[0]?.distanceM ?? 0)}</p>
                </div>
              </div>
              <button
                onClick={resetTracking}
                className="px-6 bg-white/[0.05] border border-white/10 text-fg font-semibold rounded-2xl hover:bg-white/[0.08] transition-all border-solid cursor-pointer"
              >
                New
              </button>
            </>
          )}
        </div>

        {/* ── TRACKING INDICATOR ── */}
        {status === "tracking" && (
          <div className="flex items-center gap-2 mb-6 px-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-xs text-muted">Tracking your GPS path…</span>
            <span className="text-xs text-muted ml-auto">{trackedPath.length} points recorded</span>
          </div>
        )}

        {/* ── HIKE HISTORY ── */}
        {history.length > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-3">Past Hikes</p>
            <div className="flex flex-col gap-3">
              {history.map((h) => (
                <PastHikeCard key={h.id} hike={h} />
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && status === "idle" && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
              </svg>
            </div>
            <p className="text-sm text-muted">No hikes recorded yet.</p>
            <p className="text-xs text-muted mt-1">Hit Start Hike to begin tracking your trail.</p>
          </div>
        )}

      </main>
    </div>
  );
}
