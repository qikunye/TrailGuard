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
    <nav className="navbar">
      <Link to="/dashboard" className="nav-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/>
          <circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </Link>

      <div className="nav-links">
        <NavLink to="/trail-assessment">Trail Check</NavLink>
        <NavLink to="/emergency">Emergency</NavLink>
        <NavLink to="/hazard">Report Hazard</NavLink>
        <NavLink to="/register-trail">Register Hike</NavLink>
      </div>

      <div className="nav-user">
        {currentUser?.photoURL && (
          <img src={currentUser.photoURL} className="nav-avatar" alt="avatar" />
        )}
        <span>{currentUser?.displayName ?? currentUser?.email}</span>
        <button className="nav-signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </nav>
  );
}
