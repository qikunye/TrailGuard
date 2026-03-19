const styles = {
  error:   "bg-red-bg text-red border border-red-line",
  success: "bg-green-bg text-green border border-green-line",
  warning: "bg-amber-bg text-amber border border-amber-line",
  info:    "bg-[#0d1a2a] text-[#70b8e0] border border-[#1a3a5a]",
};

const icons = { error: "✕", success: "✓", warning: "⚠", info: "ℹ" };

export default function AlertBanner({ type = "info", message }) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}
