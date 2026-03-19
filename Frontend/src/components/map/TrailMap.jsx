export default function TrailMap() {
  return (
    <div className="bg-card border border-line rounded-2xl overflow-hidden mb-4">
      <div className="relative min-h-[220px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0d2015 0%,#0e2818 50%,#0a1e12 100%)" }}>
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5c9e40" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapgrid)" />
        </svg>
        {/* Trail path */}
        <svg className="absolute inset-0 w-full h-full opacity-35">
          <path d="M 8% 85% Q 25% 40% 48% 55% T 92% 18%" fill="none" stroke="#5c9e40" strokeWidth="3" strokeDasharray="10 5" strokeLinecap="round"/>
          <circle cx="8%" cy="85%" r="5" fill="#5c9e40" opacity="0.8"/>
          <circle cx="92%" cy="18%" r="5" fill="#7ec85a" opacity="0.8"/>
        </svg>
        <div className="relative z-10 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary mx-auto mb-1.5">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            <circle cx="12" cy="10" r="3" fill="#5c9e40" stroke="none"/>
          </svg>
          <p className="text-sm text-muted">Interactive Map</p>
          <p className="text-xs text-muted opacity-70">Map integration coming soon</p>
        </div>
      </div>
    </div>
  );
}
