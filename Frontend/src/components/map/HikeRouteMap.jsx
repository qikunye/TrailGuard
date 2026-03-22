import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";

const WRAPPER = import.meta.env.VITE_MAPS_WRAPPER_URL || "/api";
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

// ── FitBounds helper ──────────────────────────────────────────────────────
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) map.fitBounds(positions, { padding: [40, 40] });
  }, [positions, map]);
  return null;
}

// ── Single autocomplete input ─────────────────────────────────────────────
function LocationInput({ placeholder, color, onSelect, defaultValue }) {
  const [query,       setQuery]       = useState(defaultValue || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const debounce = useRef(null);
  const wrapRef  = useRef(null);

  // Auto-geocode a preset default value
  useEffect(() => {
    if (!defaultValue) return;
    fetch(`${WRAPPER}/geocode?address=${encodeURIComponent(defaultValue)}`)
      .then(r => r.json())
      .then(data => {
        const name = defaultValue.split(",")[0].trim();
        onSelect({ name, lat: data.lat, lng: data.lng, formatted: defaultValue });
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
      const res  = await fetch(`${WRAPPER}/autocomplete?input=${encodeURIComponent(val)}`);
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
      const res  = await fetch(`${WRAPPER}/geocode?address=${encodeURIComponent(p.description)}`);
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
export default function HikeRouteMap({ onRouteReady, onStartChange, onEndChange, initialStart, initialEnd }) {
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
    if (!start || !end) return;
    setStatus("loading");
    setRoute(null);

    (async () => {
      try {
        const res  = await fetch(
          `${WRAPPER}/directions?origin_lat=${start.lat}&origin_lng=${start.lng}&dest_lat=${end.lat}&dest_lng=${end.lng}&mode=walking`
        );
        const data = await res.json();
        if (!res.ok || !data.path?.length) { setStatus("error"); return; }

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
      } catch { setStatus("error"); }
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

  const mapCenter = start ? [start.lat, start.lng] : currentPos ?? SG;

  return (
    <div className="border border-line rounded-2xl mb-5">

      {/* ── Inputs ── */}
      <div className="bg-card rounded-t-2xl border-b border-line p-4 flex flex-col gap-3" style={{ position: "relative", zIndex: 500 }}>
        <LocationInput placeholder="Start location (e.g. MacRitchie Reservoir)" color="#4ade80" onSelect={handleStart} defaultValue={initialStart} />

        {/* Connector dots */}
        <div className="flex items-center gap-3 pl-[5px] -my-1">
          <div className="flex flex-col gap-[3px] items-center w-3">
            {[0,1,2].map(i => <span key={i} className="w-[3px] h-[3px] rounded-full bg-line" />)}
          </div>
        </div>

        <LocationInput placeholder="End location (e.g. Bukit Timah Summit)" color="#f87171" onSelect={handleEnd} defaultValue={initialEnd} />

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
          <p className="text-xs text-red text-center pt-1">Could not find a walking route. Try more specific locations.</p>
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

          {currentPos && <Marker position={currentPos} icon={currentIcon} />}
          {start      && <Marker position={[start.lat, start.lng]} icon={startIcon} />}
          {end        && <Marker position={[end.lat,   end.lng]}   icon={endIcon}   />}

          {route && (
            <>
              <Polyline positions={route} pathOptions={{ color: "#4ade80", weight: 5, opacity: 0.9 }} />
              <FitBounds positions={route} />
            </>
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
