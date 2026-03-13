import { SEVERITY_LEVELS } from "../../config/constants.js";

const severityStyle = [
  { ring: "border-green-line",  bg: "bg-green-bg",       text: "text-green",       dot: "text-green" },
  { ring: "border-[#3a4a1a]",   bg: "bg-[#1a2a0a]",      text: "text-[#b8d870]",   dot: "text-[#b8d870]" },
  { ring: "border-amber-line",  bg: "bg-amber-bg",       text: "text-amber",       dot: "text-amber" },
  { ring: "border-[#6a2a0a]",   bg: "bg-[#2a1a0a]",      text: "text-[#e09060]",   dot: "text-[#e09060]" },
  { ring: "border-red-line",    bg: "bg-red-bg",         text: "text-red",         dot: "text-red" },
];

export default function SeveritySelector({ value, onChange }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <h2 className="text-[0.95rem] font-semibold text-fg mb-3">Injury Severity</h2>
      <div className="flex flex-col gap-2">
        {SEVERITY_LEVELS.map((s, i) => {
          const style      = severityStyle[i];
          const isSelected = value === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange?.(s.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left transition-all border w-full ${
                isSelected ? `${style.bg} ${style.ring}` : "bg-surface border-line"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-colors ${
                isSelected ? `${style.bg} ${style.ring} ${style.dot}` : "bg-card border-line text-muted"
              }`}>
                {s.value}
              </div>
              <div>
                <div className={`text-sm font-semibold transition-colors ${isSelected ? style.text : "text-fg"}`}>
                  {s.label}
                </div>
                <div className="text-xs text-muted">{s.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
