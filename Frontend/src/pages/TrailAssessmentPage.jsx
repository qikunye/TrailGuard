import Navbar from "../components/shared/Navbar.jsx";
import TrailSearchForm from "../components/assessment/TrailSearchForm.jsx";
import WeatherWidget from "../components/assessment/WeatherWidget.jsx";
import IncidentRiskPanel from "../components/assessment/IncidentRiskPanel.jsx";
import CompletionFeasibility from "../components/assessment/CompletionFeasibility.jsx";
import AlertBanner from "../components/shared/AlertBanner.jsx";
import { useAssessment } from "../hooks/useAssessment.js";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { TrailContext } from "../context/TrailContext.jsx";

export default function TrailAssessmentPage() {
  const { assess, loading, error } = useAssessment();
  const { setAssessmentResult } = useContext(TrailContext);
  const navigate  = useNavigate();
  const { state } = useLocation();

  async function handleSearch(trailData) {
    const result = await assess(trailData);
    if (result) {
      setAssessmentResult(result);
      navigate("/trail-assessment/result");
    }
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Trail Assessment</h1>
        <p className="text-sm text-muted mb-6">Check conditions before you head out</p>
        {error && <AlertBanner type="error" message={error} />}
        <TrailSearchForm onSearch={handleSearch} loading={loading} initialValues={state} />
        <WeatherWidget />
        <IncidentRiskPanel />
        <CompletionFeasibility />
      </main>
    </div>
  );
}
