import { Link } from "react-router-dom";

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
    title: "Trail Assessment",
    desc: "AI-powered safety scores before you step on the trail. Get weather, risk, and feasibility in seconds.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: "Hazard Reporting",
    desc: "Flag fallen trees, flooding, or unsafe conditions instantly. Keep other hikers safe with real-time alerts.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    title: "Emergency SOS",
    desc: "One-tap emergency reporting with your GPS location sent directly to authorities and your contacts.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: "Hike Registration",
    desc: "Log your planned route and check-in time. Automated alerts notify your contacts if you're overdue.",
  },
];

const stats = [
  { value: "500+", label: "Trails Tracked" },
  { value: "24/7", label: "Emergency Support" },
  { value: "AI", label: "Powered Safety" },
  { value: "SG", label: "Singapore Ready" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative z-[1] flex flex-col">

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 max-w-[1100px] mx-auto w-full">
        <div className="flex items-center gap-2 text-[1rem] font-bold tracking-[0.12em] uppercase text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
          </svg>
          TrailGuard
        </div>
        <Link to="/login">
          <button className="py-2 px-5 border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg bg-transparent">
            Sign In
          </button>
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-[720px] mx-auto w-full">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/[0.12] border border-primary/[0.3] text-primary text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
          AI-Powered Trail Safety
        </div>

        <h1 className="text-[2.8rem] font-bold text-fg leading-[1.15] mb-5 tracking-tight">
          Hike smarter.<br />
          <span className="text-primary">Come back safe.</span>
        </h1>

        <p className="text-[1.05rem] text-muted leading-relaxed mb-8 max-w-[500px]">
          Real-time trail assessments, hazard alerts, and emergency tools — built for Singapore's outdoor community.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Link to="/login">
            <button className="py-3 px-7 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
              Get Started Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </Link>
          <Link to="/login">
            <button className="py-3 px-7 bg-transparent border border-line text-muted rounded-full text-[0.95rem] font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
              Sign In
            </button>
          </Link>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-line bg-card/60 backdrop-blur py-5">
        <div className="grid grid-cols-4 max-w-[800px] mx-auto px-6">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center px-4">
              <div className="text-[1.6rem] font-bold text-primary leading-none mb-0.5">{s.value}</div>
              <div className="text-[0.72rem] text-muted uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 max-w-[1100px] mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-[1.4rem] font-bold text-fg mb-2">Everything you need on the trail</h2>
          <p className="text-sm text-muted">Powered by AI, designed for Singapore hikers</p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-card border border-line rounded-2xl p-6 hover:border-primary/50 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-primary/[0.12] border border-primary/[0.2] flex items-center justify-center text-primary mb-4 group-hover:bg-primary/[0.2] transition-colors">
                {f.icon}
              </div>
              <h3 className="font-bold text-fg text-[0.95rem] mb-2">{f.title}</h3>
              <p className="text-[0.82rem] text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 pb-16 max-w-[1100px] mx-auto w-full">
        <div className="bg-card border border-line rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-[1.1rem] font-bold text-fg mb-1">Ready to hike safer?</h3>
            <p className="text-sm text-muted">Create your free account and register your first trail today.</p>
          </div>
          <Link to="/login" className="shrink-0">
            <button className="py-3 px-8 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center gap-2 transition-all hover:opacity-90 border-none whitespace-nowrap">
              Get Started
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-6 px-6">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
            </svg>
            TrailGuard
          </div>
          <p className="text-xs text-muted">Built for Singapore's outdoor community</p>
        </div>
      </footer>

    </div>
  );
}
