import { Link } from "react-router-dom";

const SEVERITY_LABELS = {
  1: "Minor",
  2: "Moderate",
  3: "Serious",
  4: "Critical",
  5: "Fatal",
};

export default function EmergencyStatusCard({ result, notifiedContacts = [] }) {
  const incidentId             = result?.incidentId             ?? "—";
  const resolvedAddress        = result?.resolvedAddress        ?? "—";
  const injuryType             = result?.injuryType             ?? "—";
  const severity               = result?.severity               ?? null;
  const emergencyContactsCount = result?.emergencyContactsNotified ?? 0;
  const nearbyHikersCount      = result?.nearbyHikersNotified   ?? 0;
  const smsDelivered           = result?.smsDelivered           ?? false;
  const timeCreated            = result?.timeCreated
    ? new Date(result.timeCreated).toLocaleTimeString()
    : "—";

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🚁</div>
        <h2 className="text-xl font-bold text-green">Emergency Alert Sent</h2>
        <p className="text-sm text-muted mt-1">Your emergency contacts and nearby hikers have been notified</p>
      </div>

      {/* SMS delivery status */}
      {!smsDelivered && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-4 text-sm text-amber-400 text-center">
          ⚠ SMS delivery failed — emergency contacts may not have been reached by text. Call them directly if possible.
        </div>
      )}

      {/* Incident meta */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Incident ID</span>
          <span className="text-fg font-mono text-xs">{incidentId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Injury</span>
          <span className="text-fg">{injuryType}</span>
        </div>
        {severity && (
          <div className="flex justify-between">
            <span className="text-muted">Severity</span>
            <span className={`font-semibold ${severity >= 4 ? "text-red" : severity >= 3 ? "text-amber" : "text-green"}`}>
              {severity}/5 — {SEVERITY_LABELS[severity] ?? "—"}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted">Location</span>
          <span className="text-fg text-right max-w-[60%]">{resolvedAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Reported At</span>
          <span className="text-fg">{timeCreated}</span>
        </div>
      </div>

      {/* Notified — emergency contacts by name */}
      <div className="mb-5">
        <h3 className="text-[0.8rem] font-semibold text-muted uppercase tracking-wider mb-2">Notified</h3>
        <div className="flex flex-col gap-1.5">

          {/* Emergency contacts — show names if available, else show count */}
          {notifiedContacts.length > 0 ? (
            notifiedContacts.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-lg">
                <span>👤</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg font-medium truncate">{c.name}</p>
                  {c.relation && <p className="text-xs text-muted">{c.relation}</p>}
                </div>
                <span className="text-xs text-green font-semibold shrink-0">Notified</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-lg">
              <span>👤</span>
              <span className="text-sm text-fg flex-1">
                Emergency Contact{emergencyContactsCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-green font-semibold">{emergencyContactsCount} notified</span>
            </div>
          )}

          {/* Nearby hikers — always show as count */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-lg">
            <span>🥾</span>
            <span className="text-sm text-fg flex-1">Nearby Hikers on Trail</span>
            <span className="text-xs text-green font-semibold">{nearbyHikersCount} notified</span>
          </div>
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
