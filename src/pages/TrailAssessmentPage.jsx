import Navbar from "../components/shared/Navbar.jsx";
import TrailSearchForm from "../components/assessment/TrailSearchForm.jsx";
import WeatherWidget from "../components/assessment/WeatherWidget.jsx";
import TrailConditionBadge from "../components/assessment/TrailConditionBadge.jsx";
import IncidentRiskPanel from "../components/assessment/IncidentRiskPanel.jsx";
import CompletionFeasibility from "../components/assessment/CompletionFeasibility.jsx";
import { useAssessment } from "../hooks/useAssessment.js";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { TrailContext } from "../context/TrailContext.jsx";

export default function TrailAssessmentPage() {
  const { assess, loading } = useAssessment();
  const { setAssessmentResult } = useContext(TrailContext);
  const navigate = useNavigate();

  async function handleSearch(trailData) {
    const result = await assess(trailData);
    if (result) {
      setAssessmentResult(result);
      navigate("/trail-assessment/result");
    }
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Trail Assessment</h1>
        <p className="page-subheading">Check conditions before you head out — S1</p>
        <TrailSearchForm onSearch={handleSearch} />
        <WeatherWidget />
        <TrailConditionBadge status="OPEN" />
        <IncidentRiskPanel />
        <CompletionFeasibility />
      </main>
    </div>
  );
}
