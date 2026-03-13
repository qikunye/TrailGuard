import { TRAIL_STATUS } from "../../config/constants.js";

// S1 — Badge showing trail surface/condition status
// Props: { status: "OPEN"|"CAUTION"|"CLOSED" }
export default function TrailConditionBadge({ status = "OPEN" }) {
  const info = TRAIL_STATUS[status] ?? TRAIL_STATUS.OPEN;
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
