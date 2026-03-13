import Navbar from "../components/shared/Navbar.jsx";
import HazardReportForm from "../components/hazard/HazardReportForm.jsx";
import HazardTypeSelector from "../components/hazard/HazardTypeSelector.jsx";
import TrailStatusBanner from "../components/hazard/TrailStatusBanner.jsx";
import TrailMap from "../components/map/TrailMap.jsx";
import { useHazardReport } from "../hooks/useHazardReport.js";
import { useNavigate } from "react-router-dom";

export default function HazardReportPage() {
  const { submitReport } = useHazardReport();
  const navigate = useNavigate();

  async function handleSubmit(data) {
    const result = await submitReport(data);
    if (result) navigate("/hazard/alternative");
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Report a Hazard</h1>
        <p className="page-subheading">Flag a dangerous trail condition — S3</p>
        <TrailStatusBanner status="CAUTION" />
        <HazardTypeSelector />
        <HazardReportForm onSubmit={handleSubmit} />
        <TrailMap />
      </main>
    </div>
  );
}
