export default function CompletionFeasibility({ daylightMinutes = 480, requiredMinutes = 240 }) {
  const feasible = daylightMinutes >= requiredMinutes;
  const ratio    = Math.min((requiredMinutes / daylightMinutes) * 100, 100);

  const fmt = m => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[0.95rem] font-semibold text-fg">Completion Feasibility</h2>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
          feasible
            ? "bg-green-bg text-green border border-green-line"
            : "bg-red-bg text-red border border-red-line"
        }`}>
          {feasible ? "✓ Feasible" : "✕ Not Feasible"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-surface rounded-xl p-3">
          <div className="text-xs text-muted mb-1">Available Daylight</div>
          <div className="text-lg font-bold text-green">{fmt(daylightMinutes)}</div>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <div className="text-xs text-muted mb-1">Est. Trail Time</div>
          <div className={`text-lg font-bold ${feasible ? "text-fg" : "text-red"}`}>{fmt(requiredMinutes)}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Trail time vs daylight</span>
          <span>{Math.round(ratio)}%</span>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${feasible ? "bg-primary" : "bg-red"}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>
    </div>
  );
}
