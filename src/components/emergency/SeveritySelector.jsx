import { SEVERITY_LEVELS } from "../../config/constants.js";

// S2 — Injury severity picker (1–5)
// Props: { value: number, onChange(value) }
export default function SeveritySelector({ value, onChange }) {
  return (
    <div className="section-card">
      <p className="page-subheading">SeveritySelector — S2</p>
      {SEVERITY_LEVELS.map((s) => (
        <div key={s.value}>{s.label}: {s.description}</div>
      ))}
    </div>
  );
}
