import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Navbar from "../components/shared/Navbar.jsx";
import { useProfile } from "../hooks/useProfile.js";
import { kongFetch } from "../lib/kongClient.js";

const HIKE_URL             = import.meta.env.VITE_HIKE_URL             ?? "http://localhost:8080/api/completed";
const INCIDENT_URL         = import.meta.env.VITE_INCIDENT_URL         ?? "http://localhost:8080/api/incident";
const TRAIL_CONDITION_URL  = import.meta.env.VITE_TRAIL_CONDITION_URL  ?? "http://localhost:8080/api/trail";

const SEVERITY_LABELS = { 1: "Minor", 2: "Moderate", 3: "Serious", 4: "Critical", 5: "Fatal" };
const SEVERITY_COLOR  = (s) => s >= 4 ? "text-red bg-red/10 border-red/20" : s >= 3 ? "text-amber bg-amber/10 border-amber/20" : "text-primary bg-primary/10 border-primary/20";

// ── Active trail incidents (last 24 h from Firebase) ─────────────────────────
function TrailIncidents({ trailId }) {
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!trailId) return;
    setLoading(true);
    setError(null);
    kongFetch(`${INCIDENT_URL}/incidents/trail/${trailId}/active`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        setIncidents((data.incidents ?? []).filter(
          inc => inc.reportedAt && new Date(inc.reportedAt).getTime() >= cutoff
        ));
      })
      .catch(err => { console.error("[TrailIncidents]", err); setError(err.message); })
      .finally(() => setLoading(false));
  }, [trailId]);

  if (!trailId) return null;
  if (loading) return (
    <div className="mt-6 flex items-center gap-2 text-xs text-muted px-1">
      <div className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
      Loading trail incidents…
    </div>
  );

  return (
    <div className="mt-6">
      <p className="text-xs text-muted uppercase tracking-widest mb-3">Active Hike Incidents on This Trail</p>
      {error ? (
        <p className="text-xs text-muted px-1">Could not load — {error}</p>
      ) : incidents.length === 0 ? (
        <p className="text-xs text-muted px-1">No incidents reported in the last 24 hours.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {incidents.map((inc) => (
            <div key={inc.incidentId ?? inc.id} className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-fg">{inc.injuryType}</p>
                    {inc.severity && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SEVERITY_COLOR(inc.severity)}`}>
                        {SEVERITY_LABELS[inc.severity] ?? `Severity ${inc.severity}`}
                      </span>
                    )}
                  </div>
                  {inc.description && <p className="text-xs text-muted truncate mb-1">{inc.description}</p>}
                  <p className="text-xs text-muted font-mono">
                    {inc.reportedAt ? new Date(inc.reportedAt).toLocaleString("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-red block shrink-0 mt-0.5" title="Incident" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Severity label/colour for the string severities the condition API returns
const COND_SEV_COLOR = (s = "") => {
  const v = s.toLowerCase();
  if (v === "critical" || v === "severe") return "text-red bg-red/10 border-red/20";
  if (v === "moderate")                   return "text-amber bg-amber/10 border-amber/20";
  return "text-primary bg-primary/10 border-primary/20";
};

// ── Active trail hazards (from Trail Condition Service /Condition/{id}) ────────
function TrailHazards({ trailId }) {
  const [condition, setCondition] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!trailId) return;
    setLoading(true);
    setError(null);
    kongFetch(`${TRAIL_CONDITION_URL}/Condition/${trailId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setCondition(data))
      .catch(err => { console.error("[TrailHazards]", err); setError(err.message); })
      .finally(() => setLoading(false));
  }, [trailId]);

  if (!trailId) return null;
  if (loading) return (
    <div className="mt-6 flex items-center gap-2 text-xs text-muted px-1">
      <div className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
      Loading trail hazards…
    </div>
  );

  const activeCount  = condition?.activeHazardCounts ?? 0;
  const highestSev   = condition?.highestSeverity ?? "none";
  const hazardTypes  = condition?.hazardTypes ?? [];
  const opStatus     = condition?.operationalStatus ?? "";

  return (
    <div className="mt-6">
      <p className="text-xs text-muted uppercase tracking-widest mb-3">Active Hazards on This Trail</p>
      {error ? (
        <p className="text-xs text-muted px-1">Could not load — {error}</p>
      ) : !condition || activeCount === 0 ? (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          <p className="text-sm text-muted">No active hazards on this trail.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-amber/20 rounded-2xl px-4 py-3.5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-fg">{activeCount} active hazard{activeCount !== 1 ? "s" : ""}</span>
              {highestSev !== "none" && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${COND_SEV_COLOR(highestSev)}`}>
                  Highest: {highestSev}
                </span>
              )}
              {opStatus && opStatus !== "open" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber bg-amber/10 border-amber/20 uppercase">
                  {opStatus}
                </span>
              )}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          {hazardTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hazardTypes.map((t, i) => (
                <span key={i} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted capitalize">
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
function TrackMap({ plannedPath, trackedPath, currentPos, hazardPos, altOriginalPath, altPath }) {
  const center = currentPos
    || (plannedPath.length > 0 ? plannedPath[0] : null)
    || [1.3521, 103.8198];

  const hasAlt    = altPath && altPath.length > 1;
  const planStart = plannedPath[0] ?? null;
  const planEnd   = plannedPath[plannedPath.length - 1] ?? null;

  // Fit bounds to alt paths when alternative route is active
  const fitPath = hasAlt
    ? [...(altOriginalPath ?? []), ...altPath]
    : plannedPath;

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

      {/* Fit the whole route into view on first render */}
      {fitPath.length > 1 && <FitBounds path={fitPath} />}

      {/* ── Alternative route mode ── */}
      {hasAlt ? (
        <>
          {/* Original route — faint green */}
          {altOriginalPath && altOriginalPath.length > 1 && (
            <Polyline
              positions={altOriginalPath}
              pathOptions={{ color: "#4ade80", opacity: 0.35, weight: 3, dashArray: "6 6" }}
            />
          )}
          {/* Alternative route — solid cyan */}
          <Polyline
            positions={altPath}
            pathOptions={{ color: "#22d3ee", opacity: 0.9, weight: 5 }}
          />
          {/* Start marker */}
          {altPath[0] && (
            <CircleMarker
              center={altPath[0]}
              radius={7}
              pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1, weight: 2 }}
            />
          )}
          {/* End marker */}
          {altPath[altPath.length - 1] && (
            <CircleMarker
              center={altPath[altPath.length - 1]}
              radius={7}
              pathOptions={{ color: "#f87171", fillColor: "#f87171", fillOpacity: 1, weight: 2 }}
            />
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {/* Tracked path – always shown (green) */}
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

      {/* Hazard marker — amber circle */}
      {hazardPos && (
        <>
          <CircleMarker
            center={hazardPos}
            radius={12}
            pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15, weight: 0 }}
          />
          <CircleMarker
            center={hazardPos}
            radius={6}
            pathOptions={{ color: "#fff", fillColor: "#f59e0b", fillOpacity: 1, weight: 2 }}
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
  const { profile, uid } = useProfile();

  // UID-scoped localStorage keys
  const registeredKey  = uid ? `registeredHikes_${uid}`  : null;
  const hikeHistoryKey = uid ? `hikeHistory_${uid}`       : null;
  const activeTrackKey = uid ? `activeTrack_${uid}`       : null;
  const upcomingKey    = uid ? `upcomingHike_${uid}` : null;

  // All registered hikes (from localStorage)
  const [registeredHikes, setRegisteredHikes] = useState([]);
  const [selectedHike, setSelectedHike] = useState(null);

  const plannedPath = selectedHike?.path?.map((p) => [p[0], p[1]]) ?? [];

  // Alternative route (set when user accepts a reroute after reporting a hazard)
  const altRoute = (() => {
    if (!uid) return null;
    try { return JSON.parse(localStorage.getItem(`altRoute_${uid}`)); } catch { return null; }
  })();
  const hasAltRoute = !!(altRoute && selectedHike &&
    String(altRoute.trailId) === String(selectedHike?.selectedTrailId));
  const hazardPos = hasAltRoute && altRoute.hazardLat && altRoute.hazardLng
    ? [altRoute.hazardLat, altRoute.hazardLng]
    : null;
  const altOriginalPath = hasAltRoute && altRoute.originalRoute?.path?.length
    ? altRoute.originalRoute.path.map(p => [p[0], p[1]])
    : null;
  const altMapPath = hasAltRoute && altRoute.alternativeRoute?.path?.length
    ? altRoute.alternativeRoute.path.map(p => [p[0], p[1]])
    : null;

  // Tracking state
  const [status, setStatus]           = useState("idle");   // idle | tracking | done
  const [trackedPath, setTrackedPath] = useState([]);
  const [currentPos, setCurrentPos]   = useState(null);
  const [elapsed, setElapsed]         = useState(0);
  const [startedAt, setStartedAt]     = useState(null);
  const [geoError, setGeoError]       = useState(null);
  const [hikeId, setHikeId]           = useState(null);   // OutSystems hikeId for current session
  const [hikeCtx, setHikeCtx]         = useState(null);   // { hikerProfileId, trailId, startDate, startTime }
  const [syncErr, setSyncErr]         = useState(null);   // non-blocking sync error

  // Past logs
  const [history, setHistory] = useState([]);

  const watchIdRef   = useRef(null);
  const intervalRef  = useRef(null);
  const trackedRef   = useRef(trackedPath);
  trackedRef.current = trackedPath;
  const elapsedRef   = useRef(elapsed);
  elapsedRef.current = elapsed;
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;
  const hikeIdRef    = useRef(hikeId);
  hikeIdRef.current  = hikeId;
  const hikeCtxRef   = useRef(hikeCtx);
  hikeCtxRef.current = hikeCtx;

  // Load registered hikes for this user
  useEffect(() => {
    if (!registeredKey) return;
    try { setRegisteredHikes(JSON.parse(localStorage.getItem(registeredKey)) ?? []); } catch { setRegisteredHikes([]); }
  }, [registeredKey]);

  // Load hike history for this user
  useEffect(() => {
    if (!hikeHistoryKey) return;
    try { setHistory(JSON.parse(localStorage.getItem(hikeHistoryKey)) || []); } catch { setHistory([]); }
  }, [hikeHistoryKey]);

  // Resume in-progress session on mount (once uid is known)
  useEffect(() => {
    if (!activeTrackKey) return;
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(activeTrackKey)); } catch { return null; }
    })();
    if (saved?.status === "tracking") {
      const secsElapsed = Math.floor((Date.now() - new Date(saved.startedAt)) / 1000);
      setTrackedPath(saved.path || []);
      setElapsed(secsElapsed);
      setStartedAt(saved.startedAt);
      setStatus("tracking");
      if (saved.hikeId)       setHikeId(saved.hikeId);
      if (saved.hikeCtx)      setHikeCtx(saved.hikeCtx);
      if (saved.selectedHike) setSelectedHike(saved.selectedHike);
    }
  }, [activeTrackKey]);

  // Start timer when tracking
  useEffect(() => {
    if (status === "tracking") {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [status]);

  // Persist active track (so page refresh resumes correctly)
  useEffect(() => {
    if (status === "tracking" && activeTrackKey) {
      localStorage.setItem(activeTrackKey, JSON.stringify({
        status: "tracking",
        startedAt,
        hikeId,
        hikeCtx,
        selectedHike,
        path: trackedPath,
      }));
    }
  }, [trackedPath, status, startedAt, hikeId, hikeCtx, selectedHike, activeTrackKey]);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoError(null);
    setSyncErr(null);

    const now       = new Date();
    const nowIso    = now.toISOString();
    const startDate = now.toISOString().slice(0, 10);           // YYYY-MM-DD
    const startTime = now.toTimeString().slice(0, 8);           // HH:MM:SS

    setStartedAt(nowIso);
    setTrackedPath([]);
    setElapsed(0);
    setHikeId(null);
    setHikeCtx(null);
    setStatus("tracking");

    // POST to OutSystems to mark user as hiking (isHiking=True → appears in GetNearby)
    const hikerProfileId = profile.userId ? Number(profile.userId) : null;
    const trailId        = selectedHike?.selectedTrailId ? Number(selectedHike.selectedTrailId) : null;
    if (hikerProfileId && trailId) {
      const ctx = { hikerProfileId, trailId, startDate, startTime };
      try {
        const res = await kongFetch(`${HIKE_URL}/hikes/start`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(ctx),
        });
        if (res.ok) {
          const data = await res.json();
          const id = data.hikeId ?? data.HikeId ?? null;
          setHikeId(id);
          setHikeCtx(ctx);
          hikeIdRef.current  = id;
          hikeCtxRef.current = ctx;
        } else {
          setSyncErr("Could not register hike start with server — tracking locally.");
        }
      } catch {
        setSyncErr("Server unreachable — tracking locally only.");
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(pt);
        setTrackedPath((prev) => {
          if (prev.length === 0 || haversine(prev[prev.length - 1], pt) > 5) {
            return [...prev, pt];
          }
          return prev;
        });
      },
      (err) => setGeoError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, [profile.userId, selectedHike]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    clearInterval(intervalRef.current);

    const path     = trackedRef.current;
    const distM    = totalDistance(path);
    const distKm   = distM / 1000;
    const secs     = elapsedRef.current;
    const at       = startedAtRef.current;
    const endTime  = new Date().toTimeString().slice(0, 8);      // HH:MM:SS

    // PUT to OutSystems to mark hike as completed (isHiking=False)
    const currentHikeId = hikeIdRef.current;
    const ctx           = hikeCtxRef.current;
    if (currentHikeId && ctx) {
      try {
        await kongFetch(`${HIKE_URL}/hikes/${currentHikeId}/end`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            hikerProfileId: ctx.hikerProfileId,
            trailId:        ctx.trailId,
            startDate:      ctx.startDate,
            startTime:      ctx.startTime,
            endTime,
            distance: Math.round(distKm * 1000) / 1000,
          }),
        });
      } catch {
        // Non-critical — hike is saved locally regardless
      }
    }

    const entry = {
      id:           Date.now(),
      trailName:    selectedHike
        ? `${selectedHike.startLocation} → ${selectedHike.endLocation}`
        : "Free Hike",
      startedAt:    at,
      durationSecs: secs,
      distanceM:    distM,
      path,
    };

    const updated = [entry, ...history];
    if (hikeHistoryKey) localStorage.setItem(hikeHistoryKey, JSON.stringify(updated));
    if (activeTrackKey) localStorage.removeItem(activeTrackKey);
    if (upcomingKey)    localStorage.removeItem(upcomingKey);
    if (uid)            localStorage.removeItem(`altRoute_${uid}`);

    // Remove the completed hike from the registered hikes list so it can't be selected again
    if (registeredKey && selectedHike) {
      const remaining = registeredHikes.filter(h => h.registeredAt !== selectedHike.registeredAt);
      localStorage.setItem(registeredKey, JSON.stringify(remaining));
      setRegisteredHikes(remaining);
    }

    setHistory(updated);
    setHikeId(null);
    setSelectedHike(null);
    setStatus("done");
  }, [history, selectedHike, registeredHikes, hikeHistoryKey, activeTrackKey, upcomingKey, registeredKey]);

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
            {selectedHike
              ? `${selectedHike.startLocation} → ${selectedHike.endLocation}`
              : "Select a registered hike to begin"}
          </p>
        </div>

        {/* ── HIKE PICKER (idle only) ── */}
        {status === "idle" && (
          <div className="mb-5">
            {registeredHikes.length === 0 ? (
              <div className="bg-white/[0.03] border border-white/5 border-dashed rounded-2xl px-4 py-6 text-center">
                <p className="text-sm text-muted mb-1">No registered hikes</p>
                <a href="/register-trail" className="text-xs text-primary no-underline hover:underline">
                  Register a trail first →
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted uppercase tracking-widest mb-1">Select a hike to track</p>
                {registeredHikes.map((hike, i) => {
                  const isSelected = selectedHike === hike;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedHike(hike)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer bg-transparent ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? "bg-primary" : "bg-white/20"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">
                          {hike.startLocation} → {hike.endLocation}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          Trail #{hike.selectedTrailId}
                          {hike.startDate && ` · ${new Date(hike.startDate).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`}
                          {hike.distanceText && ` · ${hike.distanceText}`}
                        </p>
                      </div>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE HIKE INFO CARD ── */}
        {status === "tracking" && selectedHike && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3.5 mb-4 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg truncate">
                {selectedHike.startLocation} → {selectedHike.endLocation}
              </p>
              <p className="text-xs text-muted mt-0.5">
                Trail #{selectedHike.selectedTrailId}
                {selectedHike.distanceText && ` · ${selectedHike.distanceText}`}
              </p>
            </div>
          </div>
        )}

        {/* ── ALTERNATIVE ROUTE BANNER ── */}
        {hasAltRoute && (
          <div className="bg-amber/10 border border-amber/20 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber">Alternative Route Active</p>
              <p className="text-xs text-muted mt-0.5">
                Hazard detected — your trail has been rerouted. Amber marker shows hazard location.
                {altRoute?.alternativeRoute?.distanceText ? ` New distance: ${altRoute.alternativeRoute.distanceText}.` : ""}
              </p>
            </div>
          </div>
        )}

        {/* ── MAP ── */}
        <div className="rounded-2xl overflow-hidden border border-white/5 mb-4" style={{ height: 340 }}>
          <TrackMap
            plannedPath={plannedPath}
            trackedPath={trackedPath}
            currentPos={currentPos}
            hazardPos={hazardPos}
            altOriginalPath={altOriginalPath}
            altPath={altMapPath}
          />
        </div>

        {/* ── MAP LEGEND ── */}
        <div className="flex items-center gap-4 mb-5 px-1 flex-wrap">
          {hasAltRoute ? (
            <>
              <div className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#4ade80" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.5"/></svg>
                <span className="text-xs text-muted">Original</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#22d3ee" strokeWidth="4" strokeOpacity="0.9"/></svg>
                <span className="text-xs text-muted">Safer route</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#4ade80" strokeWidth="3" strokeOpacity="0.9"/></svg>
            <span className="text-xs text-muted">Your path</span>
          </div>
          {hazardPos && (
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#f59e0b" stroke="white" strokeWidth="1.5"/></svg>
              <span className="text-xs text-muted">Hazard</span>
            </div>
          )}
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

        {/* ── SYNC WARNING (non-blocking) ── */}
        {syncErr && (
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-400">
            ⚠ {syncErr}
          </div>
        )}

        {/* ── ACTIVE TRAIL INCIDENTS & HAZARDS (shown while tracking) ── */}
        {status === "tracking" && selectedHike?.selectedTrailId && (
          <>
            <TrailIncidents trailId={selectedHike.selectedTrailId} />
            <TrailHazards   trailId={selectedHike.selectedTrailId} />
          </>
        )}

        {/* ── ACTION BUTTONS ── */}
        <div className="flex gap-3 mb-10">
          {status === "idle" && (
            <button
              onClick={startTracking}
              disabled={!selectedHike}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-black font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-all border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {selectedHike ? "Start Hike" : "Select a hike first"}
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
