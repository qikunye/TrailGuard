import { Link } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import TrailMap, { matchTrail } from "../components/map/TrailMap.jsx";
import { useAuth } from "../hooks/useAuth.js";

const quickActions = [
  {
    to: "/trail-assessment",
    label: "Trail Check",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>,
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
  {
    to: "/register-trail",
    label: "Register",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20 hover:border-blue-400/50", glowColor: "#60a5fa",
  },
];

function formatDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
    + " · " + d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const firstName = currentUser?.displayName?.split(" ")[0];

  const upcomingHike = (() => {
    try { return JSON.parse(localStorage.getItem("upcomingHike")); } catch { return null; }
  })();

  const trailInfo = upcomingHike ? matchTrail(upcomingHike.trailName) : null;

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
          <TrailMap trailName={upcomingHike?.trailName} className="rounded-2xl" />

          {/* Overlay pill – trail name + status */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-xs font-medium text-fg">
              {upcomingHike
                ? (trailInfo?.name ?? upcomingHike.trailName)
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
              <p className="font-semibold text-fg truncate">{upcomingHike.trailName}</p>
              <p className="text-xs text-muted mt-0.5">
                {formatDate(upcomingHike.startDate, upcomingHike.startTime)}
                {upcomingHike.estimatedDuration && ` · ${upcomingHike.estimatedDuration}h`}
                {upcomingHike.partySize > 1 && ` · ${upcomingHike.partySize} people`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {trailInfo && (
                <span className="hidden sm:block text-xs text-muted bg-white/5 border border-white/5 px-3 py-1 rounded-full">
                  {trailInfo.difficulty} · {trailInfo.distance}
                </span>
              )}
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

        {/* ── QUICK ACTIONS ── */}
        <p className="text-xs text-muted uppercase tracking-widest mb-3">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
