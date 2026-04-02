import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { kongFetch } from "../../lib/kongClient.js";

const WRAPPER = import.meta.env.VITE_MAPS_WRAPPER_URL || "http://localhost:8080/api/maps";
const SG      = [1.3521, 103.8198];

// ── Icons ──────────────────────────────────────────────────────────────────
const makeIcon = (color, size = 14) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 0 8px ${color}80"></div>`,
    className: "",
    iconAnchor: [size / 2, size / 2],
  });

const startIcon   = makeIcon("#4ade80");
const endIcon     = makeIcon("#f87171");
const currentIcon = makeIcon("#3b82f6");

// ── Coordinate guard ──────────────────────────────────────────────────────
const validCoord = (p) => p != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

// ── OSRM fallback (free, no API key needed) ──────────────────────────────
async function fetchOSRMRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) return null;
  const route = data.routes[0];
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  return {
    path: coords,
    distanceMetres: route.distance,
    distanceText: route.distance >= 1000 ? `${(route.distance / 1000).toFixed(1)} km` : `${Math.round(route.distance)} m`,
    durationSeconds: route.duration,
    durationText: route.duration >= 3600
      ? `${Math.floor(route.duration / 3600)} hr ${Math.round((route.duration % 3600) / 60)} min`
      : `${Math.round(route.duration / 60)} min`,
  };
}

// ── Map view helper — fits to route when available, else to markers ────────
function MapView({ start, end, route }) {
  const map = useMap();
  useEffect(() => {
    if (route?.length > 1) {
      map.fitBounds(route, { padding: [40, 40] });
      return;
    }
    const pts = [
      validCoord(start) ? [start.lat, start.lng] : null,
      validCoord(end)   ? [end.lat,   end.lng]   : null,
    ].filter(Boolean);
    if (pts.length === 2) map.fitBounds(pts, { padding: [60, 60] });
    else if (pts.length === 1) map.setView(pts[0], 14);
  }, [start, end, route, map]);
  return null;
}

// ── Single autocomplete input ─────────────────────────────────────────────
function LocationInput({ placeholder, color, onSelect, defaultValue, label }) {
  const [query,       setQuery]       = useState(label || defaultValue || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const debounce = useRef(null);
  const wrapRef  = useRef(null);

  // Auto-populate from defaultValue — parses "lat, lng" strings directly,
  // falls back to geocode API for human-readable address strings.
  useEffect(() => {
    if (!defaultValue) return;
    // If defaultValue is a coordinate string like "1.2742, 103.8089", use it directly.
    const coordMatch = defaultValue.match(/^\s*([-\d.]+)\s*,\s*([-\d.]+)\s*$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        onSelect({ name: label || defaultValue.trim(), lat, lng, formatted: defaultValue });
        return;
      }
    }
    // Otherwise geocode the address string via the Maps wrapper.
    kongFetch(`${WRAPPER}/geocode?address=${encodeURIComponent(defaultValue)}`)
      .then(r => r.json())
      .then(data => {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const name = defaultValue.split(",")[0].trim();
        onSelect({ name, lat, lng, formatted: defaultValue });
      })
      .catch(() => {});
  }, [defaultValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function fetchSuggestions(val) {
    if (val.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await kongFetch(`${WRAPPER}/autocomplete?input=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSuggestions(data.predictions || []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggestions(val), 300);
  }

  async function handleSelect(p) {
    setQuery(p.description);
    setSuggestions([]);
    setOpen(false);
    try {
      const res  = await kongFetch(`${WRAPPER}/geocode?address=${encodeURIComponent(p.description)}`);
      const data = await res.json();
      onSelect({ name: p.mainText, lat: data.lat, lng: data.lng, formatted: p.description });
    } catch {
      onSelect(null);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-surface border border-line rounded-full px-4 py-2.5 text-fg text-sm outline-none focus:border-primary transition-colors placeholder:text-muted"
        />
        {loading && <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-6 right-0 bg-[#121815] border border-line rounded-xl mt-1 shadow-2xl overflow-hidden" style={{ zIndex: 9999 }}>
          {suggestions.map((p) => (
            <button
              key={p.placeId}
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-line last:border-b-0 cursor-pointer bg-transparent"
            >
              <div className="text-sm font-medium text-fg truncate">{p.mainText}</div>
              {p.secondaryText && <div className="text-xs text-muted truncate">{p.secondaryText}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function HikeRouteMap({ onRouteReady, onStartChange, onEndChange, initialStart, initialEnd, startLabel, endLabel }) {
  const [start,      setStart]      = useState(null);
  const [end,        setEnd]        = useState(null);
  const [route,      setRoute]      = useState(null);
  const [routeInfo,  setRouteInfo]  = useState(null);
  const [status,     setStatus]     = useState("idle");
  const [currentPos, setCurrentPos] = useState(null);

  // Get current location once
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCurrentPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true },
    );
  }, []);

  // Fetch walking route from Google Maps Directions via wrapper
  useEffect(() => {
    if (!validCoord(start) || !validCoord(end)) return;
    setStatus("loading");
    setRoute(null);

    (async () => {
      let data = null;

      // Try Google Maps wrapper first
      try {
        const res = await kongFetch(
          `${WRAPPER}/directions?origin_lat=${start.lat}&origin_lng=${start.lng}&dest_lat=${end.lat}&dest_lng=${end.lng}&mode=walking`
        );
        const json = await res.json();
        if (res.ok && json.path?.length) data = json;
      } catch { /* fall through to OSRM */ }

      // Fallback to OSRM if wrapper failed
      if (!data) {
        try {
          data = await fetchOSRMRoute(start, end);
        } catch { /* give up */ }
      }

      if (!data?.path?.length) { setStatus("error"); return; }

      const info = {
        startName:       start.name,
        endName:         end.name,
        distanceText:    data.distanceText,
        durationText:    data.durationText,
        distanceMetres:  data.distanceMetres,
        durationSeconds: data.durationSeconds,
        startLat: start.lat, startLng: start.lng,
        endLat:   end.lat,   endLng:   end.lng,
        path:     data.path,
      };
      setRoute(data.path);
      setRouteInfo(info);
      setStatus("ok");
      onRouteReady?.(info);
    })();
  }, [start, end]);

  const handleStart = useCallback((place) => {
    setStart(place);
    onStartChange?.(place?.name || "");
    setStatus("idle");
  }, []);

  const handleEnd = useCallback((place) => {
    setEnd(place);
    onEndChange?.(place?.name || "");
    setStatus("idle");
  }, []);

  const mapCenter = validCoord(start) ? [start.lat, start.lng] : currentPos ?? SG;

  return (
    <div className="border border-line rounded-2xl mb-5">

      {/* ── Inputs ── */}
      <div className="bg-card rounded-t-2xl border-b border-line p-4 flex flex-col gap-3" style={{ position: "relative", zIndex: 500 }}>
        <LocationInput placeholder="Start location (e.g. MacRitchie Reservoir)" color="#4ade80" onSelect={handleStart} defaultValue={initialStart} label={startLabel} />

        {/* Connector dots */}
        <div className="flex items-center gap-3 pl-[5px] -my-1">
          <div className="flex flex-col gap-[3px] items-center w-3">
            {[0,1,2].map(i => <span key={i} className="w-[3px] h-[3px] rounded-full bg-line" />)}
          </div>
        </div>

        <LocationInput placeholder="End location (e.g. Bukit Timah Summit)" color="#f87171" onSelect={handleEnd} defaultValue={initialEnd} label={endLabel} />

        {/* Status strip */}
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted pt-1">
            <div className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
            Finding walking route…
          </div>
        )}
        {status === "ok" && routeInfo && (
          <div className="flex items-center justify-center gap-6 pt-1">
            <span className="flex items-center gap-1.5 text-xs text-primary font-semibold">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
              {routeInfo.distanceText}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary font-semibold">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {routeInfo.durationText} walking
            </span>
          </div>
        )}
        {status === "error" && (
          <p className="text-xs text-muted text-center pt-1">Walking route unavailable — showing straight-line path between trailheads.</p>
        )}
      </div>

      {/* ── Map ── */}
      <div style={{ height: 400, position: "relative", zIndex: 1 }}>
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%", background: "#0a0f0d" }}
          zoomControl={true}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          {currentPos && Number.isFinite(currentPos[0]) && Number.isFinite(currentPos[1]) && (
            <Marker position={currentPos} icon={currentIcon} />
          )}
          {validCoord(start) && <Marker position={[start.lat, start.lng]} icon={startIcon} />}
          {validCoord(end)   && <Marker position={[end.lat,   end.lng]}   icon={endIcon}   />}

          <MapView start={start} end={end} route={route} />

          {route && (
            <Polyline positions={route} pathOptions={{ color: "#4ade80", weight: 5, opacity: 0.9 }} />
          )}

          {/* Fallback dashed line when routing fails but both markers are placed */}
          {!route && status === "error" && validCoord(start) && validCoord(end) && (
            <Polyline
              positions={[[start.lat, start.lng], [end.lat, end.lng]]}
              pathOptions={{ color: "#4ade80", weight: 2, opacity: 0.45, dashArray: "8 6" }}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Legend ── */}
      <div className="bg-card rounded-b-2xl border-t border-line px-4 py-2 flex items-center gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Start</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red inline-block" /> End</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> You</span>
        <span className="ml-auto flex items-center gap-1 opacity-60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/></svg>
          Route via Google Maps
        </span>
      </div>
    </div>
  );
}
