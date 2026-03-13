import { ASSESSMENT_VERDICTS } from "../../config/constants.js";
import ConfidenceBar from "../shared/ConfidenceBar.jsx";

// S1 — Displays GO / CAUTION / DO NOT GO verdict + confidence
// Props: { verdict: "GO"|"CAUTION"|"NO_GO", confidence: number }
export default function SafetyScoreCard({ verdict, confidence }) {
  const info = ASSESSMENT_VERDICTS[verdict] ?? ASSESSMENT_VERDICTS.CAUTION;
  return (
    <div className="section-card">
      <span className={`badge ${info.className}`}>{info.icon} {info.label}</span>
      <ConfidenceBar value={confidence ?? 0} />
    </div>
  );
}
