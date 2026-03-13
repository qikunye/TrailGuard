import { TRAIL_STATUS } from "../../config/constants.js";

// S3 — Full-width banner showing OPEN / CAUTION / CLOSED
// Props: { status: "OPEN"|"CAUTION"|"CLOSED" }
export default function TrailStatusBanner({ status = "OPEN" }) {
  const info = TRAIL_STATUS[status] ?? TRAIL_STATUS.OPEN;
  return (
    <div className={`alert-banner ${info.className === "go" ? "success" : info.className === "closed" ? "error" : "warning"}`}>
      <span>{info.label}</span>
    </div>
  );
}
