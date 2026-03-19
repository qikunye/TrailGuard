import { TRAIL_STATUS } from "../../config/constants.js";

const cfg = {
  OPEN:    { cls: "bg-green-bg text-green border-green-line", icon: "🟢", msg: "Trail is currently open. Proceed with normal caution." },
  CAUTION: { cls: "bg-amber-bg text-amber border-amber-line", icon: "🟡", msg: "Hazardous conditions reported. Proceed with extra care." },
  CLOSED:  { cls: "bg-red-bg   text-red   border-red-line",   icon: "🔴", msg: "Trail is closed due to hazardous conditions." },
};

export default function TrailStatusBanner({ status = "OPEN" }) {
  const info   = TRAIL_STATUS[status] ?? TRAIL_STATUS.OPEN;
  const styles = cfg[status] ?? cfg.OPEN;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border mb-4 ${styles.cls}`}>
      <span className="text-lg leading-snug">{styles.icon}</span>
      <div>
        <strong className="text-sm font-semibold">Trail Status: {info.label}</strong>
        <p className="text-xs opacity-80 mt-0.5">{styles.msg}</p>
      </div>
    </div>
  );
}
