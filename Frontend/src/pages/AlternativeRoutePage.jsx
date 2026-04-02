import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylineoffset";
import Navbar from "../components/shared/Navbar.jsx";
import { getAlternativeRoutes } from "../services/hazardService.js";
import { useProfile } from "../hooks/useProfile.js";

// ── Trail DB (mirrors backend — used for client-side fallback) ──────────────
const TRAIL_DB = {
  "1":  { name: "Southern Ridges Loop",         difficulty: "Easy",     startLat: 1.2644, startLng: 103.8208, endLat: 1.2895, endLng: 103.8043 },
  "2":  { name: "MacRitchie Reservoir Trail",    difficulty: "Moderate", startLat: 1.3442, startLng: 103.8197, endLat: 1.3592, endLng: 103.8320 },
  "3":  { name: "Bukit Timah Summit Trail",      difficulty: "Hard",     startLat: 1.3511, startLng: 103.7761, endLat: 1.3468, endLng: 103.7738 },
  "4":  { name: "Labrador Nature Reserve Trail", difficulty: "Easy",     startLat: 1.2627, startLng: 103.8030, endLat: 1.2706, endLng: 103.8083 },
  "5":  { name: "Sungei Buloh Wetland Walk",     difficulty: "Easy",     startLat: 1.4467, startLng: 103.7240, endLat: 1.4514, endLng: 103.7304 },
  "6":  { name: "Bukit Batok Nature Park Loop",  difficulty: "Easy",     startLat: 1.3479, startLng: 103.7601, endLat: 1.3504, endLng: 103.7635 },
  "7":  { name: "Pulau Ubin Chek Jawa Trail",   difficulty: "Easy",     startLat: 1.4044, startLng: 103.9592, endLat: 1.4002, endLng: 103.9671 },
  "8":  { name: "Kent Ridge Park Trail",         difficulty: "Moderate", startLat: 1.2960, startLng: 103.7836, endLat: 1.2875, endLng: 103.7880 },
  "9":  { name: "Admiralty Park Mangrove Trail",  difficulty: "Easy",    startLat: 1.4406, startLng: 103.7990, endLat: 1.4451, endLng: 103.8032 },
  "10": { name: "Clementi Forest Trail",         difficulty: "Moderate", startLat: 1.3243, startLng: 103.7682, endLat: 1.3299, endLng: 103.7748 },
};

// ── Polyline simplification & smoothing ─────────────────────────────────────

// Perpendicular distance from point p to line segment a→b (in degrees, fine for small areas)
function _perpDist(p, a, b) {
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  let t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projLat = a[0] + t * dy, projLng = a[1] + t * dx;
  return Math.sqrt((p[0] - projLat) ** 2 + (p[1] - projLng) ** 2);
}

// Ramer-Douglas-Peucker — removes unnecessary points
function simplifyPath(pts, epsilon = 0.0003) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = _perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = simplifyPath(pts.slice(0, idx + 1), epsilon);
    const right = simplifyPath(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

// Chaikin corner-cutting — produces smooth curves from simplified polyline
function smoothPath(pts, iterations = 3) {
  let result = pts;
  for (let iter = 0; iter < iterations; iter++) {
    if (result.length < 3) return result;
    const next = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const [aLat, aLng] = result[i];
      const [bLat, bLng] = result[i + 1];
      next.push([aLat * 0.75 + bLat * 0.25, aLng * 0.75 + bLng * 0.25]);
      next.push([aLat * 0.25 + bLat * 0.75, aLng * 0.25 + bLng * 0.75]);
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

// Simplify then smooth for a clean, aesthetic polyline
function cleanPath(pts) {
  if (pts.length <= 2) return pts;
  return smoothPath(simplifyPath(pts, 0.0003), 3);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function fmtDuration(s) {
  if (s >= 3600) { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return `${h} hr ${m} min`; }
  return `${Math.round(s / 60)} min`;
}
function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function minDistToPath(lat, lng, path) {
  if (!path.length) return Infinity;
  return Math.min(...path.map(p => haversineDist(lat, lng, p[0], p[1])));
}

async function osrmAlternatives(sLat, sLng, eLat, eLng) {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&alternatives=3`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) return [];
  return data.routes.map(r => ({
    path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceMetres: r.distance,
    durationSeconds: r.duration,
  }));
}
async function osrmViaRoute(coords) {
  // coords: array of [lat, lng] waypoints (2 or more)
  const waypointStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${waypointStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) return null;
  const r = data.routes[0];
  return { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distanceMetres: r.distance, durationSeconds: r.duration };
}

// Minimum safe distance from hazard (metres) — routes closer than this are rejected
const HAZARD_BUFFER_M = 150;

function computeDetourWaypoints(sLat, sLng, eLat, eLng, hLat, hLng, offset) {
  // Returns TWO via-waypoints: one before and one after the hazard along the trail,
  // both offset perpendicular to the trail on the opposite side of the hazard.
  const trailDlat = eLat - sLat, trailDlng = eLng - sLng;
  const trailLen = Math.sqrt(trailDlat ** 2 + trailDlng ** 2);
  if (trailLen < 1e-7) return [[hLat + offset, hLng + offset]];

  const tHatLat = trailDlat / trailLen, tHatLng = trailDlng / trailLen;
  const perpLat = -tHatLng, perpLng = tHatLat;

  const hazDlat = hLat - sLat, hazDlng = hLng - sLng;
  const cross = trailDlat * hazDlng - trailDlng * hazDlat;
  const sign = cross > 0 ? 1 : -1;

  // Project hazard onto trail line (clamped)
  const projT = (hazDlat * tHatLat + hazDlng * tHatLng) / trailLen;

  // Two waypoints: ~30% of trail length before and after the hazard projection
  const spread = 0.20;
  const t1 = Math.max(0.10, projT - spread);
  const t2 = Math.min(0.90, projT + spread);

  const wp1Lat = sLat + t1 * trailDlat + sign * offset * perpLat;
  const wp1Lng = sLng + t1 * trailDlng + sign * offset * perpLng;
  const wp2Lat = sLat + t2 * trailDlat + sign * offset * perpLat;
  const wp2Lng = sLng + t2 * trailDlng + sign * offset * perpLng;

  return [[wp1Lat, wp1Lng], [wp2Lat, wp2Lng]];
}

async function computeClientSide(trailId, hazardLat, hazardLng) {
  const t = TRAIL_DB[trailId];
  if (!t) throw new Error(`Unknown trail ID: ${trailId}`);

  // Fetch OSRM alternatives for the original route
  let routes = await osrmAlternatives(t.startLat, t.startLng, t.endLat, t.endLng);
  if (!routes.length) throw new Error("Could not compute any route for this trail.");
  const original = routes[0];

  // Try progressively larger offsets until we get a route that avoids the hazard
  const offsets = [0.015, 0.025, 0.04];
  for (const off of offsets) {
    const waypoints = computeDetourWaypoints(
      t.startLat, t.startLng, t.endLat, t.endLng, hazardLat, hazardLng, off
    );
    const viaRoute = await osrmViaRoute([
      [t.startLat, t.startLng], ...waypoints, [t.endLat, t.endLng],
    ]);
    if (viaRoute) routes.push(viaRoute);
  }

  // Filter candidates: only keep routes whose closest point to hazard > HAZARD_BUFFER_M
  const safe = routes.filter(
    (r, i) => i === 0 || minDistToPath(hazardLat, hazardLng, r.path) > HAZARD_BUFFER_M
  );

  // Among safe alternatives (index > 0), pick the one farthest from hazard
  let alt = original;
  let bestDist = -1;
  const candidates = safe.length > 1 ? safe : routes; // fallback to all if none are safe
  for (let i = 1; i < candidates.length; i++) {
    const d = minDistToPath(hazardLat, hazardLng, candidates[i].path);
    if (d > bestDist) { bestDist = d; alt = candidates[i]; }
  }

  return {
    status: "ok",
    trailId, trailName: t.name, trailDifficulty: t.difficulty,
    startLat: t.startLat, startLng: t.startLng, endLat: t.endLat, endLng: t.endLng,
    originalRoute: { path: original.path, distanceMetres: original.distanceMetres, durationSeconds: original.durationSeconds, distanceText: fmtDist(original.distanceMetres), durationText: fmtDuration(original.durationSeconds) },
    alternativeRoute: { path: alt.path, distanceMetres: alt.distanceMetres, durationSeconds: alt.durationSeconds, distanceText: fmtDist(alt.distanceMetres), durationText: fmtDuration(alt.durationSeconds) },
    hazardLat, hazardLng,
  };
}

// ── Map icons ────────────────────────────────────────────────────────────────
const hazardIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#f59e0b;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #f59e0b80;font-size:11px;color:#000;font-weight:bold">!</div>`,
  className: "", iconAnchor: [10, 10],
});
const startIcon = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="background:#111;color:#4ade80;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1.5px solid #4ade80;margin-bottom:4px;white-space:nowrap;letter-spacing:0.5px">START</div>
    <div style="width:18px;height:18px;background:#4ade80;border:3px solid white;border-radius:50%;box-shadow:0 0 12px #4ade8080"></div>
  </div>`,
  className: "", iconAnchor: [22, 36], iconSize: [44, 36],
});
const endIcon = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="background:#111;color:#f87171;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1.5px solid #f87171;margin-bottom:4px;white-space:nowrap;letter-spacing:0.5px">END</div>
    <div style="width:18px;height:18px;background:#f87171;border:3px solid white;border-radius:50%;box-shadow:0 0 12px #f8717180"></div>
  </div>`,
  className: "", iconAnchor: [18, 36], iconSize: [36, 36],
});

// ── FitBounds ────────────────────────────────────────────────────────────────
function FitAll({ paths }) {
  const map = useMap();
  useEffect(() => {
    const all = paths.flat();
    if (all.length > 1) map.fitBounds(all, { padding: [40, 40], animate: false });
  }, [paths, map]);
  return null;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, oldValue, newValue, icon, improved }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-4">
      <div className="flex items-center gap-1.5 text-muted mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-lg font-bold font-mono text-fg line-through opacity-40">{oldValue}</p>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <p className={`text-lg font-bold font-mono ${improved ? "text-cyan-400" : "text-amber-400"}`}>{newValue}</p>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AlternativeRoutePage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const { uid } = useProfile();
  const navigate = useNavigate();

  function handleAcceptRoute() {
    if (!data) { navigate("/dashboard"); return; }

    const newPath    = data.alternativeRoute?.path ?? [];
    const altDistText = data.alternativeRoute?.distanceText;

    if (uid) {
      // 1. Save alt route record for banner display on dashboard + track hike
      localStorage.setItem(`altRoute_${uid}`, JSON.stringify({
        ...data,
        acceptedAt: new Date().toISOString(),
      }));

      // 2. Update upcomingHike path so dashboard map shows the new route
      try {
        const upcoming = JSON.parse(localStorage.getItem(`upcomingHike_${uid}`));
        if (upcoming) {
          upcoming.path = newPath;
          if (altDistText) upcoming.distanceText = altDistText;
          localStorage.setItem(`upcomingHike_${uid}`, JSON.stringify(upcoming));
        }
      } catch { /* ignore */ }

      // 3. Update the matching registered hike so TrackHike uses the new path
      try {
        const hikes = JSON.parse(localStorage.getItem(`registeredHikes_${uid}`)) ?? [];
        const updated = hikes.map(h =>
          String(h.selectedTrailId) === String(data.trailId)
            ? { ...h, path: newPath, ...(altDistText ? { distanceText: altDistText } : {}) }
            : h
        );
        localStorage.setItem(`registeredHikes_${uid}`, JSON.stringify(updated));
      } catch { /* ignore */ }

      // 4. Update active track if hike is currently in progress
      try {
        const active = JSON.parse(localStorage.getItem(`activeTrack_${uid}`));
        if (active?.selectedHike && String(active.selectedHike.selectedTrailId) === String(data.trailId)) {
          active.selectedHike = { ...active.selectedHike, path: newPath };
          localStorage.setItem(`activeTrack_${uid}`, JSON.stringify(active));
        }
      } catch { /* ignore */ }
    }

    navigate("/dashboard");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 1. Check backend rerouting result from sessionStorage
      const stored = sessionStorage.getItem("altRouteData");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.status === "ok" && parsed.alternativeRoute) {
            if (!cancelled) { setData(parsed); setLoading(false); }
            return;
          }
        } catch { /* fall through */ }
      }

      // 2. Get hazard payload
      const payloadRaw = sessionStorage.getItem("hazardPayload");
      let payload = null;
      if (payloadRaw) try { payload = JSON.parse(payloadRaw); } catch { /* empty */ }

      if (!payload) {
        const upcomingKey = uid ? `upcomingHike_${uid}` : "upcomingHike";
        let hike = {};
        try { hike = JSON.parse(localStorage.getItem(upcomingKey)) ?? {}; } catch { /* empty */ }
        if (hike.selectedTrailId) {
          const t = TRAIL_DB[hike.selectedTrailId];
          payload = { trailId: hike.selectedTrailId, hazardLat: t?.startLat ?? 0, hazardLng: t?.startLng ?? 0, mountainId: "sg", hikerId: "usr_001" };
        }
      }

      if (!payload?.trailId) {
        if (!cancelled) { setError("No active hike found. Register a hike and report a hazard first."); setLoading(false); }
        return;
      }

      // 3. Try calling Alternative Route Service
      try {
        const res = await getAlternativeRoutes({
          hikerId: payload.hikerId ?? "usr_001", trailId: payload.trailId, mountainId: payload.mountainId ?? "sg",
          hazardLat: payload.hazardLat, hazardLng: payload.hazardLng,
          currentLat: payload.currentLat ?? payload.hazardLat, currentLng: payload.currentLng ?? payload.hazardLng,
        });
        if (res?.status === "ok" && res?.alternativeRoute) {
          if (!cancelled) { setData(res); setLoading(false); }
          return;
        }
      } catch { /* fall through */ }

      // 4. Client-side fallback using OSRM
      try {
        const result = await computeClientSide(payload.trailId, payload.hazardLat, payload.hazardLng);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [uid]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen relative z-[1]">
        <Navbar />
        <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            Computing alternative route...
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen relative z-[1]">
        <Navbar />
        <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
          <h1 className="text-[1.4rem] font-bold text-fg mb-1">Alternative Route</h1>
          <div className="bg-red-400/10 border border-red-400/20 rounded-2xl px-5 py-4 mt-4 text-sm text-red-400">
            {error || "No alternative route data available."}
          </div>
          <Link to="/hazard" className="no-underline">
            <button className="mt-4 py-3 px-6 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer hover:border-primary hover:text-fg transition-colors">
              Back to Hazard Report
            </button>
          </Link>
        </main>
      </div>
    );
  }

  // ── Extract data ───────────────────────────────────────────────────────────
  const orig = data.originalRoute ?? {};
  const alt  = data.alternativeRoute ?? {};

  const originalPath = cleanPath((orig.path ?? []).map(p => [p[0], p[1]]));
  const altPath      = cleanPath((alt.path ?? []).map(p => [p[0], p[1]]));

  const origDistText = orig.distanceText ?? fmtDist(orig.distanceMetres ?? 0);
  const origTimeText = orig.durationText ?? fmtDuration(orig.durationSeconds ?? 0);
  const altDistText  = alt.distanceText ?? fmtDist(alt.distanceMetres ?? 0);
  const altTimeText  = alt.durationText ?? fmtDuration(alt.durationSeconds ?? 0);
  const origDist     = orig.distanceMetres ?? 0;
  const altDist      = alt.distanceMetres ?? 0;
  const origTime     = orig.durationSeconds ?? 0;
  const altTime      = alt.durationSeconds ?? 0;

  const hazardPos = data.hazardLat && data.hazardLng ? [data.hazardLat, data.hazardLng] : null;
  const startPos  = data.startLat && data.startLng ? [data.startLat, data.startLng] : originalPath[0];
  const endPos    = data.endLat && data.endLng ? [data.endLat, data.endLng] : originalPath[originalPath.length - 1];

  const allPaths = [originalPath, altPath, hazardPos ? [hazardPos] : []].filter(p => p.length > 0);
  const trailName = data.trailName ?? `Trail #${data.trailId}`;

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-12">

        <div className="pt-7 pb-2">
          <h1 className="text-2xl font-bold text-fg">Alternative Route</h1>
          <p className="text-sm text-muted mt-0.5">
            Hazard detected on <span className="text-fg font-semibold">{trailName}</span> — showing a safer path with the same start and end
          </p>
        </div>

        {/* ── Route cards ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              <p className="text-[10px] text-muted uppercase tracking-widest">Original Route</p>
            </div>
            <p className="text-sm font-semibold text-fg truncate">{trailName}</p>
            <p className="text-xs text-muted mt-0.5">{origDistText} · {origTimeText}</p>
          </div>
          <div className="bg-cyan-400/10 border border-cyan-400/20 rounded-2xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
              <p className="text-[10px] text-muted uppercase tracking-widest">Safer Route</p>
            </div>
            <p className="text-sm font-semibold text-fg truncate">{trailName}</p>
            <p className="text-xs text-muted mt-0.5">{altDistText} · {altTimeText}</p>
          </div>
        </div>

        {/* ── Map ── */}
        <div className="rounded-2xl overflow-hidden border border-white/5 mb-3" style={{ height: 400 }}>
          <MapContainer
            center={startPos ?? [1.3521, 103.8198]}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            attributionControl={false}
            scrollWheelZoom={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <FitAll paths={allPaths} />

            {/* Original route — solid green, offset left */}
            {originalPath.length > 1 && (
              <Polyline positions={originalPath} pathOptions={{ color: "#4ade80", opacity: 0.9, weight: 3, offset: -3 }} />
            )}

            {/* Alternative route — dotted cyan, offset right */}
            {altPath.length > 1 && (
              <Polyline positions={altPath} pathOptions={{ color: "#22d3ee", opacity: 0.85, weight: 3, offset: 3 }} />
            )}

            {/* Start marker — green */}
            {startPos && <Marker position={startPos} icon={startIcon} />}

            {/* End marker — red */}
            {endPos && <Marker position={endPos} icon={endIcon} />}

            {/* Hazard marker — amber */}
            {hazardPos && <Marker position={hazardPos} icon={hazardIcon} />}
          </MapContainer>
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center gap-5 mb-5 px-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-[#4ade80] border-2 border-white" />
            <span className="text-xs text-muted">Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-[#f87171] border-2 border-white" />
            <span className="text-xs text-muted">End</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#4ade80" strokeWidth="3" strokeOpacity="0.9" /></svg>
            <span className="text-xs text-muted">Original</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#22d3ee" strokeWidth="3" strokeOpacity="0.85" /></svg>
            <span className="text-xs text-muted">Safer route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white" />
            <span className="text-xs text-muted">Hazard</span>
          </div>
        </div>

        {/* ── Comparison Stats ── */}
        <p className="text-xs text-muted uppercase tracking-widest mb-3 px-1">Route Comparison</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Total Distance"
            oldValue={origDistText}
            newValue={altDistText}
            improved={altDist <= origDist * 1.5}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /></svg>}
          />
          <StatCard
            label="Estimated Time"
            oldValue={origTimeText}
            newValue={altTimeText}
            improved={altTime <= origTime * 1.5}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
          />
        </div>

        {/* ── Info banner ── */}
        <div className="bg-cyan-400/10 border border-cyan-400/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-cyan-400">
            The safer route avoids the hazard zone and follows a different path between the same start and end points of {trailName}.
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button onClick={handleAcceptRoute}
            className="flex-1 py-3.5 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer transition-all hover:opacity-90 border-none">
            Accept Route
          </button>
          <Link to="/hazard" className="flex-1 no-underline">
            <button className="w-full py-3.5 px-4 bg-transparent border border-line text-muted rounded-full text-[0.95rem] font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
              Back
            </button>
          </Link>
        </div>

      </main>
    </div>
  );
}
