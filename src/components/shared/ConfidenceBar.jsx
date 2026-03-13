/** @param {{ label: string, value: number }} props  — value 0–100 */
export default function ConfidenceBar({ label = "AI Confidence", value = 0 }) {
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-label">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="confidence-bar-track">
        <div className="confidence-bar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
