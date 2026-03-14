import { HAZARD_TYPES } from "../../config/constants.js";

const icons = {
  "Fallen Tree":       "🌲",
  "Flooding":          "🌊",
  "Landslide":         "⛰️",
  "Washed-out Bridge": "🌉",
  "Unsafe Cliff Edge": "🧗",
  "Wildlife":          "🐗",
  "Fire Damage":       "🔥",
  "Other":             "⚠️",
};

export default function HazardTypeSelector({ value, onChange }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 mb-4">
      <h2 className="text-[0.95rem] font-semibold text-fg mb-3">Hazard Type</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
        {HAZARD_TYPES.map(type => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange?.(selected ? null : type)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl cursor-pointer transition-all border text-center ${
                selected
                  ? "bg-primary/[0.18] border-primary text-primary"
                  : "bg-surface border-line text-muted hover:border-primary/50"
              }`}
            >
              <span className="text-2xl">{icons[type]}</span>
              <span className="text-[0.78rem] font-semibold leading-tight">{type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
