import { Link } from "react-router-dom";

const defaultRoute = {
  name: "Northern Ridge Trail",
  distance: "4.2 km",
  estimatedTime: "1h 45m",
  difficulty: "Moderate",
  avoidance: "Bypasses the affected section and rejoins the main trail at km 3.8",
};

export default function AlternativeRouteCard({ route }) {
  const r = route ?? defaultRoute;

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🗺️</span>
        <h2 className="text-[0.95rem] font-semibold text-fg">Suggested Alternative</h2>
      </div>

      <div className="bg-surface rounded-xl p-4 mb-3">
        <div className="text-base font-bold text-primary mb-3">{r.name}</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Distance",   value: r.distance },
            { label: "Est. Time",  value: r.estimatedTime },
            { label: "Difficulty", value: r.difficulty },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-[0.7rem] text-muted mb-0.5">{item.label}</div>
              <div className="text-sm font-semibold text-fg">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {r.avoidance && (
        <div className="bg-green-bg border border-green-line rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-green">✓ {r.avoidance}</p>
        </div>
      )}

      <Link to="/dashboard" className="no-underline">
        <button className="w-full py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
          Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
