import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import EmergencyStatusCard from "../components/emergency/EmergencyStatusCard.jsx";

export default function EmergencyConfirmPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const result           = state?.result ?? null;
  const notifiedContacts = state?.notifiedContacts ?? [];

  // If user lands here directly without a result, send them back to the report form
  useEffect(() => {
    if (!result) navigate("/emergency", { replace: true });
  }, [result, navigate]);

  if (!result) return null;

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full">
        <EmergencyStatusCard result={result} notifiedContacts={notifiedContacts} />
      </main>
    </div>
  );
}
