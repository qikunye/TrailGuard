import { HAZARD_TYPES } from "../../config/constants.js";

// S3 — Hazard type picker (fallen tree, flood, landslide…)
// Props: { value: string, onChange(value) }
export default function HazardTypeSelector({ value, onChange }) {
  return (
    <div className="section-card">
      <p className="page-subheading">HazardTypeSelector — S3</p>
      {HAZARD_TYPES.map((t) => (
        <div key={t}>{t}</div>
      ))}
    </div>
  );
}
