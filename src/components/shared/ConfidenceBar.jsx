export default function ConfidenceBar({ label = "AI Confidence", value = 0 }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted mb-1.5">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
