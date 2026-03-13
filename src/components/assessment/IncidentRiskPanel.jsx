// S1 — Lists recent incidents on the selected trail
// Props: { incidents: Array<{ id, type, date, severity }> }
export default function IncidentRiskPanel({ incidents = [] }) {
  return (
    <div className="section-card">
      <p className="page-subheading">IncidentRiskPanel — S1</p>
    </div>
  );
}
