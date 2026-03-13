import Navbar from "../components/shared/Navbar.jsx";
import SafetyScoreCard from "../components/assessment/SafetyScoreCard.jsx";
import { useContext } from "react";
import { TrailContext } from "../context/TrailContext.jsx";

export default function AssessmentResultPage() {
  const { assessmentResult } = useContext(TrailContext);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Assessment Result</h1>
        <p className="page-subheading">GO / CAUTION / DO NOT GO — S1</p>
        <SafetyScoreCard
          verdict={assessmentResult?.verdict ?? "CAUTION"}
          confidence={assessmentResult?.confidence ?? 0}
        />
      </main>
    </div>
  );
}
