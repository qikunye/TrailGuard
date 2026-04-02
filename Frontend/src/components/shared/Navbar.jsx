import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const Logo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
  </svg>
);

const navLinks = [
  { to: "/register-trail", label: "Register Hike" },
  { to: "/track-hike",     label: "Track Hike" },
  { to: "/emergency",      label: "Emergency" },
  { to: "/hazard",         label: "Hazard" },
];

const HEADER_H = 57; // mobile header height in px

export default function Navbar() {
  const { currentUser, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);

  const isActivelyHiking = (() => {
    const uid = currentUser?.uid;
    if (!uid) return false;
    try {
      const saved = JSON.parse(localStorage.getItem(`activeTrack_${uid}`));
      return saved?.status === "tracking";
    } catch { return false; }
  })();

  // Close both panels on navigation
  useEffect(() => {
    setProfileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Close profile on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const h = (e) => setProfileOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [profileOpen]);

  async function handleSignOut() {
    setProfileOpen(false);
    setMenuOpen(false);
    await signOut();
    navigate("/");
  }

  const displayName = currentUser?.displayName ?? currentUser?.email ?? "Account";
  const firstName   = displayName.split(" ")[0];

  const Avatar = ({ size = "w-8 h-8" }) =>
    currentUser?.photoURL ? (
      <img src={currentUser.photoURL} className={`${size} rounded-full object-cover ring-1 ring-white/10`} alt="avatar" />
    ) : (
      <div className={`${size} rounded-full bg-white/5 border border-white/10 flex items-center justify-center`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    );

  const ProfileMenu = () => (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/95 backdrop-blur-xl shadow-2xl w-56">
      <div className="px-4 py-4 border-b border-white/5 flex items-center gap-3">
        <Avatar size="w-10 h-10" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg truncate">{displayName}</div>
          {currentUser?.email && currentUser?.displayName && (
            <div className="text-xs text-muted truncate">{currentUser.email}</div>
          )}
        </div>
      </div>
      <div className="p-2">
        <Link to="/profile" onClick={() => setProfileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-fg hover:bg-white/5 transition-colors no-underline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          My Profile
        </Link>
        <div className="h-px bg-white/5 my-2 mx-1" />
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red hover:bg-red/10 transition-colors cursor-pointer bg-transparent border-none text-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── MOBILE HEADER ── */}
      <header className="md:hidden sticky top-0 z-[1500] bg-black/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">

          {/* Hamburger – left */}
          <button onClick={() => { setMenuOpen(o => !o); setProfileOpen(false); }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              {menuOpen
                ? <path d="M18 6L6 18M6 6l12 12"/>
                : <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>
              }
            </svg>
          </button>

          {/* Logo – center */}
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-primary no-underline absolute left-1/2 -translate-x-1/2">
            <Logo />
            TrailGuard
          </Link>

          {/* Avatar – right */}
          <button onClick={(e) => { e.stopPropagation(); setProfileOpen(o => !o); setMenuOpen(false); }}
            className="bg-transparent border-none cursor-pointer p-0 shrink-0">
            <Avatar />
          </button>
        </div>
      </header>

      {/* ── MOBILE MENU OVERLAY (fixed, doesn't push content) ── */}
      {menuOpen && (
        <div
          className="md:hidden fixed left-0 right-0 z-[1400] bg-black/95 backdrop-blur-xl border-b border-white/10 p-3 space-y-1"
          style={{ top: HEADER_H }}
        >
          {navLinks.map(({ to, label }) => {
            const hikeOnly = to === "/emergency" || to === "/hazard";
            const disabled = hikeOnly && !isActivelyHiking;
            if (disabled) return (
              <span key={to}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-white/20 cursor-not-allowed select-none">
                {label}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/25 ml-2">On hike only</span>
              </span>
            );
            return (
              <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl text-sm font-medium no-underline transition-colors ${
                    isActive ? "bg-primary/15 text-primary" : "text-muted hover:text-fg hover:bg-white/5"
                  }`
                }>
                {label}
              </NavLink>
            );
          })}
        </div>
      )}

      {/* ── MOBILE PROFILE DROPDOWN (fixed) ── */}
      {profileOpen && (
        <div
          className="md:hidden fixed right-4 z-[1600]"
          style={{ top: HEADER_H + 8 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ProfileMenu />
        </div>
      )}

      {/* ── DESKTOP FLOATING PILL ── */}
      <div className="hidden md:flex sticky top-4 z-[1500] justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-black/50 backdrop-blur-xl"
          style={{ boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>

          <Link to="/dashboard"
            className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-primary no-underline px-2 py-1 shrink-0">
            <Logo />
            TrailGuard
          </Link>

          <div className="w-px h-5 bg-white/10 shrink-0" />

          <div className="flex items-center gap-1">
            {navLinks.slice(0, 4).map(({ to, label }) => {
              const hikeOnly = to === "/emergency" || to === "/hazard";
              const disabled = hikeOnly && !isActivelyHiking;
              if (disabled) return (
                <span key={to} title="Start a hike to access this"
                  className="text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap text-white/25 cursor-not-allowed select-none">
                  {label}
                </span>
              );
              return (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `text-sm font-medium px-4 py-2 rounded-full transition-all no-underline whitespace-nowrap ${
                      isActive ? "bg-white/10 text-fg" : "text-muted hover:text-fg hover:bg-white/5"
                    }`}>
                  {label}
                </NavLink>
              );
            })}
          </div>

          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Desktop profile */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setProfileOpen(o => !o); }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full cursor-pointer border-none bg-transparent hover:bg-white/5 transition-colors">
              <Avatar />
              <span className="text-sm text-fg font-medium">{firstName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-muted transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] z-[2000]"
                onMouseDown={(e) => e.stopPropagation()}>
                <ProfileMenu />
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
