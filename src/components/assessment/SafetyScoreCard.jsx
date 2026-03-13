import { ASSESSMENT_VERDICTS } from "../../config/constants.js";
import ConfidenceBar from "../shared/ConfidenceBar.jsx";
import { Link } from "react-router-dom";

const verdictStyle = {
  GO:      { wrap: "bg-green-bg border-green-line", badge: "bg-green-bg text-green border-green-line", emoji: "✅" },
  CAUTION: { wrap: "bg-amber-bg border-amber-line", badge: "bg-amber-bg text-amber border-amber-line", emoji: "⚠️" },
  NO_GO:   { wrap: "bg-red-bg   border-red-line",   badge: "bg-red-bg   text-red   border-red-line",   emoji: "🚫" },
};

export default function SafetyScoreCard({ verdict = "CAUTION", confidence = 0, reasons = [] }) {
  const info  = ASSESSMENT_VERDICTS[verdict] ?? ASSESSMENT_VERDICTS.CAUTION;
  const style = verdictStyle[verdict] ?? verdictStyle.CAUTION;

  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <div className={`text-center py-6 rounded-xl border mb-5 ${style.wrap}`}>
        <div className="text-5xl mb-2">{style.emoji}</div>
        <span className={`inline-flex items-center gap-1 px-5 py-1.5 rounded-full text-base font-semibold uppercase tracking-wider border ${style.badge}`}>
          {info.icon} {info.label}
        </span>
      </div>

      <ConfidenceBar label="AI Confidence" value={confidence} />

      {reasons.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[0.8rem] font-semibold text-muted mb-2 uppercase tracking-wider">Key Factors</h3>
          <ul className="flex flex-col gap-1.5">
            {reasons.map((r, i) => (
              <li key={i} className="text-sm text-fg flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <Link to="/dashboard" className="flex-1 no-underline">
          <button className="w-full py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
            Dashboard
          </button>
        </Link>
        <Link to="/emergency" className="flex-1 no-underline">
          <button className="w-full py-3 px-4 bg-primary text-bg rounded-full text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 border-none">
            Report Emergency
          </button>
        </Link>
      </div>
    </div>
  );
}
