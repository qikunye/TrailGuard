import { useState, useContext } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import SeveritySelector from "../components/emergency/SeveritySelector.jsx";
import IncidentReportForm from "../components/emergency/IncidentReportForm.jsx";
import PhotoUpload from "../components/emergency/PhotoUpload.jsx";
import { useEmergency } from "../hooks/useEmergency.js";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

export default function EmergencyReportPage() {
  const { submitReport, loading } = useEmergency();
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [severity, setSeverity] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  async function handleSubmit(data) {
    const result = await submitReport({
      ...data,
      severity,
      photoUrl,
      hikerId: currentUser?.uid ?? "usr_001",
    });
    if (result) navigate("/emergency/confirm");
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Emergency Report</h1>
        <p className="text-sm text-muted mb-6">Report an injury or emergency on-trail</p>
        <SeveritySelector value={severity} onChange={setSeverity} />
        <IncidentReportForm onSubmit={handleSubmit} loading={loading} severity={severity} photoUrl={photoUrl} />
        <PhotoUpload onUpload={file => setPhotoUrl(URL.createObjectURL(file))} />
      </main>
    </div>
  );
}
