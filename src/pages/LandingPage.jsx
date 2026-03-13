import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="auth-layout">
      <div className="wordmark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </div>
      <div className="card" style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 className="page-heading" style={{ marginBottom: "0.5rem" }}>Stay safe on every trail.</h1>
        <p className="page-subheading" style={{ marginBottom: "1.5rem" }}>
          AI-powered trail safety assessments, emergency reporting, and hazard alerts — all in one place.
        </p>
        <Link to="/login">
          <button className="btn-primary">Get Started</button>
        </Link>
      </div>
    </div>
  );
}
