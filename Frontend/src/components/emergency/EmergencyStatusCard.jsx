import { Link } from "react-router-dom";

export default function EmergencyStatusCard({ result }) {
  const incidentId              = result?.incidentId ?? "—";
  const resolvedAddress         = result?.resolvedAddress ?? "—";
  const emergencyContactsCount  = result?.emergencyContactsNotified ?? 0;
  const nearbyHikersCount       = result?.nearbyHikersNotified ?? 0;
  const timeCreated             = result?.timeCreated
    ? new Date(result.timeCreated).toLocaleTimeString()
    : "—";

  const notified = [
    { icon: "👤", label: `Emergency Contact${emergencyContactsCount !== 1 ? "s" : ""}`, count: emergencyContactsCount },
    { icon: "🥾", label: "Nearby Hikers on Trail",                                       count: nearbyHikersCount },
  ];

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🚁</div>
        <h2 className="text-xl font-bold text-green">Emergency Alert Sent</h2>
        <p className="text-sm text-muted mt-1">Your emergency contacts and nearby hikers have been notified</p>
      </div>

      {/* Incident meta */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Incident ID</span>
          <span className="text-fg font-mono">{incidentId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Location</span>
          <span className="text-fg">{resolvedAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Reported At</span>
          <span className="text-fg">{timeCreated}</span>
        </div>
      </div>

      {/* Notified counts */}
      <div className="mb-5">
        <h3 className="text-[0.8rem] font-semibold text-muted uppercase tracking-wider mb-2">Notified</h3>
        <div className="flex flex-col gap-1.5">
          {notified.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-lg">
              <span>{item.icon}</span>
              <span className="text-sm text-fg flex-1">{item.label}</span>
              <span className="text-xs text-green font-semibold">{item.count} notified</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-bg border border-amber-line rounded-xl px-4 py-3 mb-5 text-center">
        <p className="text-sm text-amber">
          ⚠️ Stay where you are. Help is on the way. Keep your phone visible.
        </p>
      </div>

      <Link to="/dashboard" className="no-underline">
        <button className="w-full py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
          Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
