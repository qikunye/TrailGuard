import { Link } from "react-router-dom";

const SEVERITY_LABELS = {
  1: "Minor",
  2: "Moderate",
  3: "Serious",
  4: "Critical",
  5: "Fatal",
};

function SeverityBadge({ severity }) {
  if (!severity) return null;
  const color =
    severity >= 4 ? "bg-red/15 text-red border-red/25"
    : severity >= 3 ? "bg-amber/15 text-amber border-amber/25"
    : "bg-green/15 text-green border-green/25";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {severity}/5 — {SEVERITY_LABELS[severity] ?? "—"}
    </span>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-line/40 last:border-b-0">
      <span className="text-muted text-xs uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-fg text-sm text-right">{children}</span>
    </div>
  );
}

function NotifiedRow({ icon, name, detail, badge }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 bg-surface/60 rounded-xl">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg font-medium truncate">{name}</p>
        {detail && <p className="text-[0.7rem] text-muted">{detail}</p>}
      </div>
      <span className="text-[0.7rem] text-green font-bold tracking-wide uppercase shrink-0">{badge}</span>
    </div>
  );
}

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
    <div className="animate-fade-in">
      {/* Hero section */}
      <div className="text-center pt-2 pb-5">
        <div className="relative inline-block mb-3">
          <div className="w-16 h-16 rounded-full bg-green/10 border border-green/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">🚁</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green rounded-full flex items-center justify-center">
            <span className="text-[0.6rem] text-bg font-black">✓</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-green mb-1">Help is on the way</h1>
        <p className="text-xs text-muted">Your emergency contacts and nearby hikers have been notified</p>
      </div>

      {/* SMS warning */}
      {!smsDelivered && (
        <div className="bg-amber/10 border border-amber/20 rounded-xl px-3.5 py-2.5 mb-4 text-[0.78rem] text-amber text-center leading-snug">
          ⚠ SMS delivery failed — call your emergency contacts directly.
        </div>
      )}

      {/* Incident details card */}
      <div className="bg-card border border-line rounded-2xl p-4 mb-3">
        <MetaRow label="Incident">{<span className="font-mono text-xs text-muted">{incidentId}</span>}</MetaRow>
        <MetaRow label="Injury">{injuryType}</MetaRow>
        {severity && (
          <MetaRow label="Severity"><SeverityBadge severity={severity} /></MetaRow>
        )}
        <MetaRow label="Location">
          <span className="max-w-[55vw] inline-block">{resolvedAddress}</span>
        </MetaRow>
        <MetaRow label="Time">{timeCreated}</MetaRow>
      </div>

      {/* Notified section */}
      <div className="mb-3">
        <h3 className="text-[0.7rem] font-semibold text-muted uppercase tracking-widest mb-2 px-1">Notified</h3>
        <div className="flex flex-col gap-2">
          {notifiedContacts.length > 0 ? (
            notifiedContacts.map((c, i) => (
              <NotifiedRow
                key={i}
                icon="👤"
                name={c.name}
                detail={c.relation}
                badge="Notified"
              />
            ))
          ) : (
            <NotifiedRow
              icon="👤"
              name={`Emergency Contact${emergencyContactsCount !== 1 ? "s" : ""}`}
              badge={`${emergencyContactsCount} notified`}
            />
          )}
          <NotifiedRow
            icon="🥾"
            name="Nearby Hikers on Trail"
            badge={`${nearbyHikersCount} notified`}
          />
        </div>
      </div>

      {/* Safety warning */}
      <div className="bg-amber-bg border border-amber-line rounded-xl px-4 py-3 mb-4 text-center">
        <p className="text-[0.8rem] text-amber font-medium leading-snug">
          ⚠️ Stay where you are. Help is on the way.<br />Keep your phone visible.
        </p>
      </div>

      {/* Action button */}
      <Link to="/dashboard" className="no-underline block">
        <button className="w-full py-3.5 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-all hover:border-green hover:text-green active:scale-[0.98]">
          Back to Dashboard
        </button>
      </Link>
    </div>
  );
}
