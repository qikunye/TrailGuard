import { Link } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";

const actions = [
  { to: "/trail-assessment", label: "Trail Check",     desc: "Is it safe to go?",         icon: "🏔" },
  { to: "/emergency",        label: "Emergency",       desc: "Report an injury",           icon: "🚨" },
  { to: "/hazard",           label: "Report Hazard",   desc: "Flag a trail condition",     icon: "⚠️" },
  { to: "/register-trail",   label: "Register Hike",   desc: "Log your planned route",     icon: "📍" },
  { to: "/profile",          label: "Profile",         desc: "Emergency contacts & info",  icon: "👤" },
];

export default function DashboardPage() {
  const { currentUser } = useAuth();

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">
          Welcome{currentUser?.displayName ? `, ${currentUser.displayName.split(" ")[0]}` : ""}
        </h1>
        <p className="page-subheading">What do you need today?</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
          {actions.map((a) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: "none" }}>
              <div className="section-card" style={{ textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{a.icon}</div>
                <strong style={{ color: "var(--text)", display: "block" }}>{a.label}</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{a.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
