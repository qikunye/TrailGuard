import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

export default function Navbar() {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <nav className="h-14 bg-card border-b border-line flex items-center px-6 gap-6 sticky top-0 z-50">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-primary no-underline"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </Link>

      <div className="flex items-center gap-0.5 flex-1">
        {[
          { to: "/trail-assessment", label: "Trail Check" },
          { to: "/emergency",        label: "Emergency" },
          { to: "/hazard",           label: "Report Hazard" },
          { to: "/register-trail",   label: "Register Hike" },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-sm font-medium px-3 py-1.5 rounded-lg transition-colors no-underline ${
                isActive ? "text-fg bg-surface" : "text-muted hover:text-fg hover:bg-surface"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {currentUser?.photoURL && (
          <img
            src={currentUser.photoURL}
            className="w-8 h-8 rounded-full border-2 border-primary object-cover"
            alt="avatar"
          />
        )}
        <span className="text-sm text-muted">{currentUser?.displayName ?? currentUser?.email}</span>
        <button
          onClick={handleSignOut}
          className="bg-transparent border border-line text-muted text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors hover:border-red hover:text-red"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
