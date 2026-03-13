import { Link } from "react-router-dom";

export default function EmergencyStatusCard({ eta = "15–20 minutes", contacts = [] }) {
  const notified = [
    { icon: "🚑", label: "Singapore Civil Defence Force (SCDF)" },
    { icon: "🏥", label: "Nearest Emergency Facility" },
    ...contacts.map(c => ({ icon: "👤", label: c })),
  ];

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🚁</div>
        <h2 className="text-xl font-bold text-green">Emergency Alert Sent</h2>
        <p className="text-sm text-muted mt-1">Emergency services and your contacts have been notified</p>
      </div>

      <div className="bg-green-bg border border-green-line rounded-xl p-4 mb-5 text-center">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Estimated Response Time</div>
        <div className="text-2xl font-bold text-green">{eta}</div>
      </div>

      <div className="mb-5">
        <h3 className="text-[0.8rem] font-semibold text-muted uppercase tracking-wider mb-2">Notified</h3>
        <div className="flex flex-col gap-1.5">
          {notified.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-lg">
              <span>{item.icon}</span>
              <span className="text-sm text-fg flex-1">{item.label}</span>
              <span className="text-xs text-green">✓ Notified</span>
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
