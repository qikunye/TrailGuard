import { useState } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import TrailStatusBanner from "../components/hazard/TrailStatusBanner.jsx";
import HazardTypeSelector from "../components/hazard/HazardTypeSelector.jsx";
import HazardReportForm from "../components/hazard/HazardReportForm.jsx";
import TrailMap from "../components/map/TrailMap.jsx";
import { useHazardReport } from "../hooks/useHazardReport.js";
import { useNavigate } from "react-router-dom";

export default function HazardReportPage() {
  const { submitReport, loading } = useHazardReport();
  const navigate = useNavigate();
  const [hazardType, setHazardType] = useState(null);

  async function handleSubmit(data) {
    const result = await submitReport({ ...data, hazardType });
    if (result) navigate("/hazard/alternative");
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Report a Hazard</h1>
        <p className="text-sm text-muted mb-6">Flag a dangerous trail condition</p>
        <TrailStatusBanner status="CAUTION" />
        <HazardTypeSelector value={hazardType} onChange={setHazardType} />
        <HazardReportForm onSubmit={handleSubmit} loading={loading} hazardType={hazardType} />
        <TrailMap />
      </main>
    </div>
  );
}
