import Navbar from "../components/shared/Navbar.jsx";
import IncidentReportForm from "../components/emergency/IncidentReportForm.jsx";
import SeveritySelector from "../components/emergency/SeveritySelector.jsx";
import PhotoUpload from "../components/emergency/PhotoUpload.jsx";
import { useEmergency } from "../hooks/useEmergency.js";
import { useNavigate } from "react-router-dom";

export default function EmergencyReportPage() {
  const { submitReport, loading } = useEmergency();
  const navigate = useNavigate();

  async function handleSubmit(data) {
    const result = await submitReport(data);
    if (result) navigate("/emergency/confirm");
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Emergency Report</h1>
        <p className="page-subheading">Report an injury or emergency on-trail — S2</p>
        <SeveritySelector />
        <IncidentReportForm onSubmit={handleSubmit} />
        <PhotoUpload />
      </main>
    </div>
  );
}
