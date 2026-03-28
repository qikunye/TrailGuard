const DECISION_META = {
  GO: {
    emoji: "✅", label: "Clear to Go",
    color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/30",
    barColor: "#4ade80",
  },
  CAUTION: {
    emoji: "⚠️", label: "Proceed with Caution",
    color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30",
    barColor: "#fbbf24",
  },
  NO_GO: {
    emoji: "🚫", label: "Do Not Go",
    color: "text-red-400",   bg: "bg-red-400/10",   border: "border-red-400/30",
    barColor: "#f87171",
  },
};

const SEV_COLOR = {
  none:     "text-muted",
  minor:    "text-green-400",
  moderate: "text-amber-400",
  severe:   "text-red-400",
  critical: "text-red-600",
};

/**
 * Assessment result modal.
 * onRegister is optional — omit it to hide the Register button (e.g. from Dashboard).
 */
export default function AssessmentModal({ assessment, onClose, onRegister }) {
  const meta = DECISION_META[assessment.verdict] ?? DECISION_META.CAUTION;

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-card border border-line rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className={`p-6 pb-4 rounded-t-3xl sm:rounded-t-2xl border-b border-line ${meta.bg}`}>
          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{meta.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-xl font-bold ${meta.color}`}>{meta.label}</div>
              <div className="text-sm text-muted mt-0.5 truncate">
                {assessment.trailName} · {assessment.date}
                {assessment.startTime && ` · ${assessment.startTime}`}
              </div>
            </div>
            <button onClick={onClose}
              className="text-muted hover:text-fg transition-colors bg-transparent border-none cursor-pointer text-xl leading-none mt-0.5 shrink-0">
              ✕
            </button>
          </div>

          {/* Confidence bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
              <span>AI CONFIDENCE</span>
              <span>{assessment.confidence}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${assessment.confidence}%`, background: meta.barColor }} />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 flex flex-col gap-4">

          {assessment.reasoning && (
            <section>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">AI Assessment</div>
              <p className="text-sm text-fg/80 leading-relaxed">{assessment.reasoning}</p>
            </section>
          )}

          {assessment.keyReasons?.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Key Factors</div>
              <ul className="flex flex-col gap-1.5">
                {assessment.keyReasons.map((r, i) => (
                  <li key={i} className="text-sm text-fg flex items-start gap-2">
                    <span className={`${meta.color} mt-0.5 shrink-0`}>•</span>{r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-surface rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-3">Trail Conditions</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className={`font-semibold capitalize ${
                  assessment.trailStatus?.operationalStatus === "open" ? "text-primary" : "text-red-400"
                }`}>{assessment.trailStatus?.operationalStatus ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Difficulty</span>
                <span className="font-semibold text-fg">{assessment.trailStatus?.difficulty ?? "—"} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Active Hazards</span>
                <span className="font-semibold text-fg">{assessment.trailStatus?.activeHazardCounts ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Highest Severity</span>
                <span className={`font-semibold capitalize ${SEV_COLOR[assessment.trailStatus?.highestSeverity] ?? "text-fg"}`}>
                  {assessment.trailStatus?.highestSeverity ?? "none"}
                </span>
              </div>
              {assessment.trailStatus?.hazardTypes?.length > 0 && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-muted">Hazard Types</span>
                  <span className="font-semibold text-fg text-right max-w-[60%] text-xs">
                    {assessment.trailStatus.hazardTypes.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          {assessment.weather && (
            <section className="bg-surface rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-3">
                Weather at Start Time
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                {[
                  { icon: "🌡", label: "Temp",      value: assessment.weather.temp != null ? `${assessment.weather.temp}°C` : "—" },
                  { icon: "💨", label: "Wind",       value: assessment.weather.wind != null ? `${assessment.weather.wind} km/h` : "—" },
                  { icon: "💧", label: "Humidity",   value: assessment.weather.humidity != null ? `${assessment.weather.humidity}%` : "—" },
                  { icon: "🔆", label: "UV",         value: assessment.weather.uvIndex != null ? assessment.weather.uvIndex : "—" },
                  { icon: "☁️", label: "Conditions", value: assessment.weather.conditions || "—" },
                  { icon: "👁", label: "Severity",   value: assessment.weather.severity || "—" },
                ].map(s => (
                  <div key={s.label} className="bg-card rounded-lg py-2 px-1">
                    <div className="text-base leading-none mb-1">{s.icon}</div>
                    <div className="text-[9px] text-muted uppercase tracking-wide">{s.label}</div>
                    <div className="text-xs font-semibold text-fg mt-0.5 capitalize">{s.value}</div>
                  </div>
                ))}
              </div>
              {assessment.weather.safetyFlags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assessment.weather.safetyFlags.map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 font-mono">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="bg-surface rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Recent Incidents</div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted">Last 30 days </span>
                <span className="font-bold text-fg">{assessment.incidents?.count30Days ?? 0}</span>
              </div>
              <div>
                <span className="text-muted">Last 90 days </span>
                <span className="font-bold text-fg">{assessment.incidents?.count90Days ?? 0}</span>
              </div>
            </div>
          </section>

          {assessment.completion?.estimatedDuration && (
            <section className="bg-surface rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Completion Estimate</div>
              <div className="flex gap-4 text-sm flex-wrap">
                <div>
                  <span className="text-muted">Duration </span>
                  <span className="font-bold text-fg">{assessment.completion.estimatedDuration}</span>
                </div>
                {assessment.completion.estimatedReturn && (
                  <div>
                    <span className="text-muted">Return </span>
                    <span className="font-bold text-fg">{assessment.completion.estimatedReturn}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted">Before dark </span>
                  <span className={`font-bold ${assessment.completion.returnsBeforeSunset ? "text-primary" : "text-red-400"}`}>
                    {assessment.completion.returnsBeforeSunset ? "Yes ✓" : "No ✕"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {assessment.warnings?.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted mb-2">Recommended Precautions</div>
              <ul className="flex flex-col gap-1.5">
                {assessment.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-fg/80 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">⚑</span>{w}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 pt-0 flex gap-3 sticky bottom-0 bg-card border-t border-line">
          <button onClick={onClose}
            className="flex-1 py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer hover:border-primary hover:text-fg transition-colors">
            Close
          </button>
          {onRegister && (
            <button onClick={onRegister}
              className="flex-1 py-3 px-4 bg-primary text-bg rounded-full text-sm font-bold cursor-pointer hover:opacity-90 transition-all border-none">
              Register Hike →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
