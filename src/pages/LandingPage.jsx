import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-[1]">
      <div className="flex items-center gap-2 text-[1.1rem] font-bold tracking-[0.12em] uppercase text-primary mb-5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </div>

      <div className="bg-card border border-line rounded-[20px] p-8 w-full max-w-[420px] text-center">
        <h1 className="text-[1.6rem] font-bold text-fg mb-3">Stay safe on every trail.</h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          AI-powered trail safety assessments, emergency reporting, and hazard alerts — all in one place.
        </p>
        <Link to="/login">
          <button className="w-full py-3 px-4 bg-primary text-bg rounded-full font-bold text-[0.95rem] cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </Link>
      </div>
    </div>
  );
}
