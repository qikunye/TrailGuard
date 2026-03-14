import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

export default function Navbar() {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate("/");
  }

  const displayName = currentUser?.displayName ?? currentUser?.email ?? "Account";
  const firstName   = displayName.split(" ")[0];

  return (
    <div className="sticky top-4 z-50 flex justify-center px-4 pointer-events-none">
      <nav
        className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full border border-line"
        style={{
          background: "rgba(14, 26, 16, 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(92,158,64,0.08) inset",
        }}
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 text-[0.78rem] font-bold tracking-widest uppercase text-primary no-underline px-2 py-1 shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
          </svg>
          TrailGuard
        </Link>

        <div className="w-px h-4 bg-line shrink-0" />

        {/* Nav links */}
        {[
          { to: "/trail-assessment", label: "Trail Check" },
          { to: "/emergency",        label: "Emergency" },
          { to: "/hazard",           label: "Hazard" },
          { to: "/register-trail",   label: "Register" },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-[0.8rem] font-medium px-3 py-1.5 rounded-full transition-all no-underline whitespace-nowrap ${
                isActive
                  ? "bg-primary text-bg font-semibold"
                  : "text-muted hover:text-fg hover:bg-white/[0.06]"
              }`
            }
          >
            {label}
          </NavLink>
        ))}

        <div className="w-px h-4 bg-line shrink-0" />

        {/* Profile dropdown trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full cursor-pointer border-none bg-transparent hover:bg-white/[0.06] transition-colors"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                className="w-7 h-7 rounded-full border border-primary/50 object-cover shrink-0"
                alt="avatar"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface border border-line flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
            <span className="text-[0.8rem] text-fg font-medium">{firstName}</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] w-52 rounded-2xl border border-line overflow-hidden"
              style={{
                background: "rgba(14, 26, 16, 0.92)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} className="w-9 h-9 rounded-full border border-primary/50 object-cover shrink-0" alt="avatar" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-surface border border-line flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fg truncate">{displayName}</div>
                  {currentUser?.email && currentUser?.displayName && (
                    <div className="text-xs text-muted truncate">{currentUser.email}</div>
                  )}
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1.5">
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-fg hover:bg-white/[0.06] transition-colors no-underline"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  My Profile
                </Link>

                <div className="h-px bg-line my-1.5 mx-1" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-red hover:bg-red-bg transition-colors cursor-pointer bg-transparent border-none text-left"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
