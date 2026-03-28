import { useLocation } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import EmergencyStatusCard from "../components/emergency/EmergencyStatusCard.jsx";

export default function EmergencyConfirmPage() {
  const { state } = useLocation();
  const result = state?.result ?? null;

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Help is on the way</h1>
        <p className="text-sm text-muted mb-6">Emergency services and contacts have been notified</p>
        <EmergencyStatusCard result={result} />
      </main>
    </div>
  );
}
