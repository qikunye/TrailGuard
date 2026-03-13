export default function IncidentRiskPanel({ incidents = [] }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <h2 className="text-[0.95rem] font-semibold text-fg mb-3">Recent Incidents</h2>

      {incidents.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <div className="text-2xl mb-1.5">✓</div>
          <p className="text-sm">No reported incidents on this trail recently</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {incidents.map(incident => (
            <div key={incident.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-fg">{incident.type}</div>
                <div className="text-xs text-muted">{incident.date}</div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                incident.severity >= 3
                  ? "bg-red-bg text-red border border-red-line"
                  : "bg-amber-bg text-amber border border-amber-line"
              }`}>
                Sev. {incident.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
