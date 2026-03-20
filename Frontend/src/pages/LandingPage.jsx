import { Link } from "react-router-dom";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
    title: "Trail Assessment",
    desc: "Safety scores before you step on the trail.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: "Hazard Reporting",
    desc: "Flag dangerous conditions and keep others safe.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    title: "Emergency SOS",
    desc: "One-tap emergency reporting with GPS location.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: "Hike Registration",
    desc: "Log your route with automated safety alerts.",
  },
];

const stats = [
  { value: "500+", label: "Trails Mapped" },
  { value: "24/7", label: "Live Support" },
  { value: "10k+", label: "Hikers" },
  { value: "SG", label: "Ready" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative z-[1] flex flex-col">

      {/* Nav - Absolute positioned over hero */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 text-base font-bold tracking-wider uppercase text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
          </svg>
          TrailGuard
        </div>
        <Link to="/login">
          <button className="py-2.5 px-6 border border-white/10 text-muted rounded-full text-sm font-medium cursor-pointer transition-all hover:bg-white/5 hover:text-fg bg-transparent">
            Sign In
          </button>
        </Link>
      </header>

      {/* Hero - Full viewport height */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative" style={{ contain: "paint" }}>

        {/* Background gradient accent */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" style={{ willChange: "transform", transform: "translateZ(0)" }} />
        </div>

        {/* Trail animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.4, willChange: "transform", transform: "translateZ(0)" }}>
          <svg
            viewBox="0 0 1200 600"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Glow filter for trail */}
              <filter id="trailGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              {/* Glow filter for dot */}
              <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              {/* Clip to keep within bounds */}
              <clipPath id="heroClip">
                <rect width="1200" height="600" />
              </clipPath>
            </defs>

            <g clipPath="url(#heroClip)">

              {/* Mountain silhouettes — back layer */}
              <polygon points="0,600 120,340 240,480 380,260 500,420 620,200 740,380 860,240 980,390 1100,200 1200,320 1200,600"
                fill="rgba(74,222,128,0.03)" />
              {/* Mountain silhouettes — front layer */}
              <polygon points="0,600 80,420 200,520 320,360 440,480 560,300 680,440 800,320 920,460 1040,280 1160,400 1200,360 1200,600"
                fill="rgba(74,222,128,0.05)" />

              {/* Topographic rings (faint) */}
              <ellipse cx="600" cy="420" rx="340" ry="100" fill="none" stroke="rgba(74,222,128,0.04)" strokeWidth="1"/>
              <ellipse cx="600" cy="420" rx="260" ry="76" fill="none" stroke="rgba(74,222,128,0.04)" strokeWidth="1"/>
              <ellipse cx="600" cy="420" rx="180" ry="52" fill="none" stroke="rgba(74,222,128,0.04)" strokeWidth="1"/>

              {/* Main trail path */}
              <path
                id="trailPath"
                d="M -60,520 C 60,500 100,460 180,430 S 280,370 360,350 S 460,310 520,280 S 600,240 660,220 S 740,200 800,210 S 880,230 940,215 S 1020,185 1100,175 S 1180,170 1260,160"
                fill="none"
                stroke="#4ade80"
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#trailGlow)"
                opacity="0.3"
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: 2000,
                  animation: "drawTrail 3s ease-out 0.3s forwards",
                }}
              />

              {/* Faint dashed secondary path */}
              <path
                d="M -60,520 C 60,500 100,460 180,430 S 280,370 360,350 S 460,310 520,280 S 600,240 660,220 S 740,200 800,210 S 880,230 940,215 S 1020,185 1100,175 S 1180,170 1260,160"
                fill="none"
                stroke="#4ade80"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.06"
              />

              {/* Waypoint dots along the trail */}
              {[
                [180, 430], [360, 350], [520, 280], [660, 220], [800, 210], [940, 215],
              ].map(([cx, cy], i) => (
                <circle
                  key={i}
                  cx={cx} cy={cy} r="3"
                  fill="#4ade80"
                  opacity="0"
                  style={{ animation: `fadeInDot 0.3s ease-out ${1.0 + i * 0.35}s forwards` }}
                />
              ))}

              {/* Moving hiker dot */}
              <circle r="5" fill="#4ade80" filter="url(#dotGlow)" opacity="0">
                <animateMotion
                  dur="4s"
                  begin="0.3s"
                  repeatCount="indefinite"
                  path="M -60,520 C 60,500 100,460 180,430 S 280,370 360,350 S 460,310 520,280 S 600,240 660,220 S 740,200 800,210 S 880,230 940,215 S 1020,185 1100,175 S 1180,170 1260,160"
                />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.9;1" dur="4s" begin="0.3s" repeatCount="indefinite" />
              </circle>

            </g>
          </svg>

          <style>{`
            @keyframes drawTrail {
              to { stroke-dashoffset: 0; }
            }
            @keyframes fadeInDot {
              to { opacity: 0.5; }
            }
          `}</style>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-muted text-xs font-medium px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Trail Safety
          </div>

          {/* Main headline - TrailGuard */}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold leading-none mb-6 tracking-tight">
            <span style={{ color: "transparent", WebkitTextStroke: "1.5px white" }}>Trail</span><span className="text-primary">Guard</span>
          </h1>

          {/* Caption */}
          <p className="text-xl md:text-lg text-muted leading-relaxed mb-10 max-w-2xl mx-auto">
            Hike smarter. Come back safe.
            <br />
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/login">
              <button className="py-4 px-10 bg-primary text-black rounded-full text-base font-semibold cursor-pointer flex items-center gap-2 transition-all hover:opacity-90 hover:-translate-y-0.5 border-none shadow-lg shadow-primary/25">
                Get Started Free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </Link>
            <Link to="/login">
              <button className="py-4 px-10 bg-white/5 border border-white/10 text-fg rounded-full text-base font-medium cursor-pointer transition-all hover:bg-white/10">
                Sign In
              </button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted">
          <span className="text-xs">Scroll to explore</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14">
        <div className="flex flex-row items-center justify-center px-6">
          {stats.map((s, i) => (
            <>
              <div key={i} className="flex flex-col items-center text-center px-6 md:px-10">
                <div
                  className="text-2xl md:text-4xl font-bold text-primary leading-none mb-1"
                  style={{ textShadow: "0 0 24px rgba(74,222,128,0.5)" }}
                >
                  {s.value}
                </div>
                <div className="text-xs md:text-sm text-muted mt-1 tracking-wide uppercase">{s.label}</div>
              </div>
              {i < stats.length - 1 && (
                <div key={`divider-${i}`} className="w-px h-10 bg-white/10 shrink-0" />
              )}
            </>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">Everything you need on the trail</h2>
          <p className="text-lg text-muted">Designed for Singapore hikers</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-4 md:p-6 hover:bg-white/[0.05] hover:border-white/10 transition-colors"
            >
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3 md:mb-5 group-hover:bg-primary/20 transition-all [&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-6 md:[&>svg]:h-6">
                {f.icon}
              </div>
              <h3 className="font-semibold text-fg text-xs md:text-lg mb-1 md:mb-2">{f.title}</h3>
              <p className="text-xs md:text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 md:pb-28 max-w-4xl mx-auto w-full">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-transparent to-primary/5 border border-white/10 rounded-3xl p-10 md:p-14">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold text-fg mb-3">Ready to hike safer?</h3>
              <p className="text-muted text-lg">Create your free account and register your first trail today.</p>
            </div>
            <Link to="/login" className="shrink-0">
              <button className="py-4 px-10 bg-primary text-black rounded-full text-base font-semibold cursor-pointer flex items-center gap-2 transition-all hover:opacity-90 border-none shadow-lg shadow-primary/25 whitespace-nowrap">
                Get Started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </Link>
          </div>
          <div className="absolute -right-20 -top-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" style={{ willChange: "transform", transform: "translateZ(0)" }} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
            </svg>
            TrailGuard
          </div>
          <p className="text-sm text-muted">Built for Singapore's outdoor community</p>
        </div>
      </footer>

    </div>
  );
}
