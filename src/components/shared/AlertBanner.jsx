/** @param {{ type: "error"|"success"|"warning"|"info", message: string }} props */
export default function AlertBanner({ type = "info", message }) {
  if (!message) return null;
  const icons = { error: "✕", success: "✓", warning: "⚠", info: "ℹ" };
  return (
    <div className={`alert-banner ${type}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}
