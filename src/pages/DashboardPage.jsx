import { Link } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";

const actions = [
  { to: "/trail-assessment", label: "Trail Check",   desc: "AI safety assessment before you head out",       icon: "🏔️", hover: "hover:border-primary" },
  { to: "/emergency",        label: "Emergency",      desc: "Report an injury or on-trail emergency",         icon: "🚨", hover: "hover:border-red" },
  { to: "/hazard",           label: "Report Hazard",  desc: "Flag a dangerous trail condition",               icon: "⚠️", hover: "hover:border-amber" },
  { to: "/register-trail",   label: "Register Hike",  desc: "Log your planned route & check-in time",        icon: "📍", hover: "hover:border-[#70b8e0]" },
  { to: "/profile",          label: "My Profile",     desc: "Emergency contacts & hiker info",               icon: "👤", hover: "hover:border-muted" },
];

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const firstName = currentUser?.displayName?.split(" ")[0];

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">
          {firstName ? `Hey, ${firstName}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted mb-6">What do you need today?</p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 mb-6">
          {actions.map(a => (
            <Link key={a.to} to={a.to} className="no-underline">
              <div className={`bg-card border border-line rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-0.5 h-full ${a.hover}`}>
                <div className="text-[2rem] mb-2.5">{a.icon}</div>
                <div className="font-bold text-fg text-[0.95rem] mb-1">{a.label}</div>
                <div className="text-[0.78rem] text-muted leading-snug">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "☀️", label: "Weather",      value: "28°C · Partly Cloudy" },
            { icon: "🟢", label: "Trails Open",  value: "Most trails open" },
            { icon: "📡", label: "Last Updated", value: "Just now" },
          ].map(item => (
            <div key={item.label} className="bg-surface border border-line rounded-xl p-3 text-center">
              <div className="text-[1.3rem] mb-1">{item.icon}</div>
              <div className="text-[0.7rem] text-muted mb-0.5">{item.label}</div>
              <div className="text-sm font-semibold text-fg">{item.value}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
