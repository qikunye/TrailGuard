import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import UpcomingHikeMap from "../components/map/UpcomingHikeMap.jsx";
import { useAuth } from "../hooks/useAuth.js";

// ── WMO code → icon + label (Open-Meteo fallback) ────────────────────────
function wmoInfo(code) {
  if (code === 0)              return { icon: "☀️",  label: "Clear Sky" };
  if (code <= 2)               return { icon: "⛅",  label: "Partly Cloudy" };
  if (code === 3)              return { icon: "☁️",  label: "Overcast" };
  if (code <= 48)              return { icon: "🌫",  label: "Foggy" };
  if (code <= 55)              return { icon: "🌦",  label: "Drizzle" };
  if (code <= 65)              return { icon: "🌧",  label: "Rain" };
  if (code <= 77)              return { icon: "❄️",  label: "Snow" };
  if (code <= 82)              return { icon: "🌦",  label: "Rain Showers" };
  if (code === 95)             return { icon: "⛈",  label: "Thunderstorm" };
  if (code >= 96)              return { icon: "⛈",  label: "Thunderstorm + Hail" };
  return { icon: "🌤", label: "Unknown" };
}

// ── Google Weather type → icon + label ───────────────────────────────────
function googleConditionInfo(type = "") {
  const t = type.toUpperCase();
  if (t.includes("THUNDER"))                               return { icon: "⛈",  label: "Thunderstorm" };
  if (t.includes("HEAVY_RAIN") || t.includes("SHOWERS"))  return { icon: "🌧",  label: "Heavy Rain" };
  if (t.includes("RAIN") || t.includes("DRIZZLE"))        return { icon: "🌦",  label: "Rain" };
  if (t.includes("FOG") || t.includes("MIST"))            return { icon: "🌫",  label: "Foggy" };
  if (t.includes("OVERCAST"))                             return { icon: "☁️",  label: "Overcast" };
  if (t.includes("CLOUDY"))                               return { icon: "☁️",  label: "Cloudy" };
  if (t.includes("PARTLY") || t.includes("MOSTLY_CLEAR")) return { icon: "⛅",  label: "Partly Cloudy" };
  if (t.includes("CLEAR") || t.includes("SUNNY"))         return { icon: "☀️",  label: "Clear" };
  return { icon: "🌤", label: type.replace(/_/g, " ") };
}

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

async function resolveCoords(hike) {
  if (hike.startLat && hike.startLng) return { lat: hike.startLat, lng: hike.startLng };
  if (!hike.startLocation) return null;
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(hike.startLocation)}&region=SG&key=${GMAPS_KEY}`
    );
    const d = await r.json();
    const loc = d.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch { return null; }
}

// ── Weather widget ─────────────────────────────────────────────────────────
function HikeWeatherWidget({ hike }) {
  const [data,   setData]   = useState(null);  // { temp, feels, rain, humid, wind, icon, label, source }
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const coords = await resolveCoords(hike);
      if (!coords) { if (!cancelled) setStatus("error"); return; }

      const hikeTime   = new Date(`${hike.startDate}T${hike.startTime}`);
      const now        = new Date();
      const hoursUntil = Math.ceil((hikeTime - now) / 3_600_000);

      if (hoursUntil > 240) { if (!cancelled) setStatus("far"); return; }
      const hours = Math.max(hoursUntil + 3, 3);

      // ① Try Google Weather API (via Vercel serverless function)
      try {
        const res  = await fetch(`/api/weather?lat=${coords.lat}&lng=${coords.lng}&hours=${hours}`);
        const json = await res.json();
        const forecasts = json.forecastHours || [];
        let closest = null, minDiff = Infinity;
        for (const f of forecasts) {
          const diff = Math.abs(new Date(f.interval?.startTime) - hikeTime);
          if (diff < minDiff) { minDiff = diff; closest = f; }
        }
        if (closest && !cancelled) {
          const cond = googleConditionInfo(closest.weatherCondition?.type || "");
          setData({
            temp:   closest.temperature?.degrees,
            feels:  closest.feelsLikeTemperature?.degrees,
            rain:   closest.precipitation?.probability?.percent,
            humid:  closest.relativeHumidity,
            wind:   closest.wind?.speed?.value,
            windU:  "km/h",
            icon:   cond.icon,
            label:  closest.weatherCondition?.description?.text || cond.label,
            source: "Google Weather",
          });
          setStatus("ok");
          return;
        }
      } catch { /* fall through */ }

      // ② Fallback: Open-Meteo (free, no key, always works)
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=auto&forecast_days=10`;
        const res  = await fetch(url);
        const json = await res.json();
        const times = json.hourly?.time || [];
        let idx = 0, minDiff = Infinity;
        times.forEach((t, i) => {
          const diff = Math.abs(new Date(t) - hikeTime);
          if (diff < minDiff) { minDiff = diff; idx = i; }
        });
        const h = json.hourly;
        const cond = wmoInfo(h.weather_code?.[idx]);
        if (!cancelled) {
          setData({
            temp:   h.temperature_2m?.[idx],
            feels:  h.apparent_temperature?.[idx],
            rain:   h.precipitation_probability?.[idx],
            humid:  h.relative_humidity_2m?.[idx],
            wind:   h.wind_speed_10m?.[idx],
            windU:  "km/h",
            icon:   cond.icon,
            label:  cond.label,
            source: "Open-Meteo",
          });
          setStatus("ok");
        }
      } catch { if (!cancelled) setStatus("error"); }
    })();
    return () => { cancelled = true; };
  }, [hike]);

  if (status === "far") return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6 text-xs text-muted text-center">
      Weather forecast available within 10 days of your hike.
    </div>
  );
  if (status === "error") return null;
  if (status === "loading") return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6 flex items-center gap-2 text-xs text-muted">
      <div className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
      Loading weather forecast…
    </div>
  );

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6">
      <p className="text-xs text-muted uppercase tracking-widest mb-3">Weather at hike time</p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-4xl leading-none">{data.icon}</span>
          <div>
            <p className="text-2xl font-bold text-fg leading-none">
              {data.temp != null ? `${Math.round(data.temp)}°C` : "–"}
            </p>
            {data.feels != null && <p className="text-xs text-muted mt-0.5">Feels {Math.round(data.feels)}°C</p>}
          </div>
        </div>

        <div className="w-px h-10 bg-white/10 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg mb-2">{data.label}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.rain  != null && <span className="text-xs text-muted">💧 {data.rain}% rain</span>}
            {data.humid != null && <span className="text-xs text-muted">💦 {data.humid}% humidity</span>}
            {data.wind  != null && <span className="text-xs text-muted">💨 {Math.round(data.wind)} {data.windU}</span>}
          </div>
        </div>

        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-xs text-muted truncate max-w-[140px]">{hike.startLocation}</p>
          <p className="text-xs text-muted">{hike.startDate} · {hike.startTime}</p>
        </div>
      </div>
    </div>
  );
}

const quickActions = [
  {
    to: "/register-trail",
    label: "Register",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20 hover:border-blue-400/50", glowColor: "#60a5fa",
  },
  {
    to: "/track-hike",
    label: "Track Hike",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/></svg>,
    color: "text-primary", bg: "bg-primary/10", border: "border-primary/20 hover:border-primary/50", glowColor: "#4ade80",
  },
  {
    to: "/emergency",
    label: "Emergency",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    color: "text-red", bg: "bg-red/10", border: "border-red/20 hover:border-red/50", glowColor: "#f87171",
  },
  {
    to: "/hazard",
    label: "Hazard",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    color: "text-amber", bg: "bg-amber/10", border: "border-amber/20 hover:border-amber/50", glowColor: "#fbbf24",
  },
];

function formatDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
    + " · " + d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const firstName = currentUser?.displayName?.split(" ")[0];

  const upcomingHike = (() => {
    try { return JSON.parse(localStorage.getItem("upcomingHike")); } catch { return null; }
  })();

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12">

        {/* Greeting */}
        <div className="pt-7 pb-6">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">{greeting}, {firstName ?? "Hiker"}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">
            {upcomingHike
              ? <>Your next hike is coming up</>
              : <>What do you need today?</>
            }
          </h1>
        </div>

        {/* ── MAP SECTION ── */}
        <div className="relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5 mb-4" style={{ height: 280 }}>
          <UpcomingHikeMap hike={upcomingHike} height={280} />

          {/* Overlay pill – route label */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-xs font-medium text-fg">
              {upcomingHike?.startLocation && upcomingHike?.endLocation
                ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
                : "Singapore Trails"}
            </span>
          </div>

          {/* Register hike CTA if no upcoming hike */}
          {!upcomingHike && (
            <div className="absolute inset-0 z-[400] flex items-end p-4 pointer-events-none">
              <Link to="/register-trail" className="pointer-events-auto">
                <div className="inline-flex items-center gap-2 bg-primary/90 backdrop-blur text-black text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-primary transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Register a hike to see your trail
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* ── UPCOMING HIKE CARD ── */}
        {upcomingHike ? (
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted mb-0.5">Upcoming hike</p>
              <p className="font-semibold text-fg truncate">
                {upcomingHike.startLocation} → {upcomingHike.endLocation}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {formatDate(upcomingHike.startDate, upcomingHike.startTime)}
                {upcomingHike.estimatedDuration && ` · ${upcomingHike.estimatedDuration}h`}
                {upcomingHike.partySize > 1 && ` · ${upcomingHike.partySize} people`}
                {upcomingHike.distanceText && ` · ${upcomingHike.distanceText}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate("/trail-assessment", { state: {
                  trailName:  `${upcomingHike.startLocation} to ${upcomingHike.endLocation}`,
                  date:       upcomingHike.startDate,
                  partySize:  upcomingHike.partySize,
                }})}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors cursor-pointer border-solid"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Check Trail
              </button>
              <button
                onClick={() => { localStorage.removeItem("upcomingHike"); window.location.reload(); }}
                className="text-muted hover:text-red transition-colors bg-transparent border-none cursor-pointer p-1"
                title="Clear hike"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6" />
        )}

        {/* ── WEATHER ── */}
        {upcomingHike && <HikeWeatherWidget hike={upcomingHike} />}

        {/* ── QUICK ACTIONS ── */}
        <p className="text-xs text-muted uppercase tracking-widest mb-3">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to} className="no-underline group">
              <div className={`relative overflow-hidden flex items-center gap-3 bg-white/[0.03] border rounded-xl px-4 py-3.5 transition-all hover:bg-white/[0.06] active:scale-[0.97] ${a.border}`}>
                {/* Corner glow */}
                <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-25 blur-xl pointer-events-none" style={{ background: a.glowColor }} />
                <span className={`${a.bg} ${a.color} w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative z-10`}>
                  {a.icon}
                </span>
                <span className="text-sm font-medium text-fg relative z-10">{a.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── RECOMMENDED TRAILS ── */}
        <div className="mt-8">
          <p className="text-xs text-muted uppercase tracking-widest mb-3">Recommended Trails</p>
          <div className="flex flex-col gap-3">
            {[
              {
                name: "MacRitchie Reservoir Loop",
                start: "MacRitchie Reservoir Park, Singapore",
                end: "HSBC TreeTop Walk, Singapore",
                distance: "11 km", duration: "3–4 h",
                difficulty: "Moderate", diffColor: "text-amber", diffBg: "bg-amber/10",
                tags: ["Forest", "Boardwalk"],
                desc: "Scenic loop around the reservoir with a treetop walk viewpoint.",
              },
              {
                name: "Bukit Timah Summit",
                start: "Bukit Timah Nature Reserve Visitor Centre, Singapore",
                end: "Bukit Timah Hill Summit, Singapore",
                distance: "6 km", duration: "2–3 h",
                difficulty: "Moderate", diffColor: "text-amber", diffBg: "bg-amber/10",
                tags: ["Hill", "Nature Reserve"],
                desc: "Singapore's highest natural point at 163m, dense primary rainforest.",
              },
              {
                name: "Southern Ridges",
                start: "HarbourFront MRT Station, Singapore",
                end: "Labrador Nature Reserve, Singapore",
                distance: "9 km", duration: "3 h",
                difficulty: "Easy", diffColor: "text-primary", diffBg: "bg-primary/10",
                tags: ["Skyline", "Park Connector"],
                desc: "Connected ridge parks from HarbourFront to Labrador with city views.",
              },
              {
                name: "Sungei Buloh Wetland Reserve",
                start: "Sungei Buloh Wetland Reserve, Singapore",
                end: "Kranji Marshes, Singapore",
                distance: "7 km", duration: "2–3 h",
                difficulty: "Easy", diffColor: "text-primary", diffBg: "bg-primary/10",
                tags: ["Wetlands", "Wildlife"],
                desc: "Mangrove boardwalks with resident monitor lizards and migratory birds.",
              },
              {
                name: "Pulau Ubin Chek Jawa",
                start: "Pulau Ubin Jetty, Singapore",
                end: "Chek Jawa Wetlands, Singapore",
                distance: "5 km", duration: "2 h",
                difficulty: "Easy", diffColor: "text-primary", diffBg: "bg-primary/10",
                tags: ["Island", "Coastal"],
                desc: "Coastal wetland boardwalk on Singapore's rustic island getaway.",
              },
            ].map((trail) => (
              <div
                key={trail.name}
                onClick={() => navigate("/register-trail", { state: { start: trail.start, end: trail.end, name: trail.name } })}
                className="flex items-start gap-4 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-4 hover:bg-white/[0.05] hover:border-primary/20 transition-all cursor-pointer group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-fg">{trail.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${trail.diffBg} ${trail.diffColor}`}>
                      {trail.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-2">{trail.desc}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-muted flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                      {trail.distance}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      {trail.duration}
                    </span>
                    {trail.tags.map((t) => (
                      <span key={t} className="text-[10px] text-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <svg className="text-muted group-hover:text-primary transition-colors shrink-0 mt-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATUS ROW ── */}
        <div className="flex gap-3 mt-6 overflow-x-auto pb-1">
          {[
            { dot: "bg-amber", text: "28°C · Partly Cloudy" },
            { dot: "bg-primary", text: "Most trails open" },
            { dot: "bg-white/20", text: "Updated just now" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-full px-4 py-2 whitespace-nowrap shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-xs text-muted">{s.text}</span>
            </div>
          ))}
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 mt-auto py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
            </svg>
            TrailGuard
          </div>
          <p className="text-xs text-muted">Stay safe on the trails · Singapore</p>
        </div>
      </footer>

    </div>
  );
}
