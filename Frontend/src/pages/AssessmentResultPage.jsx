import Navbar from "../components/shared/Navbar.jsx";
import SafetyScoreCard from "../components/assessment/SafetyScoreCard.jsx";
import WeatherWidget from "../components/assessment/WeatherWidget.jsx";
import { useContext } from "react";
import { TrailContext } from "../context/TrailContext.jsx";

export default function AssessmentResultPage() {
  const { assessmentResult } = useContext(TrailContext);

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Assessment Result</h1>
        <p className="text-sm text-muted mb-6">
          {assessmentResult?.trailName ?? "Trail"} — {assessmentResult?.date ?? "Today"}
        </p>
        <SafetyScoreCard
          verdict={assessmentResult?.verdict ?? "CAUTION"}
          confidence={assessmentResult?.confidence ?? 0}
          reasons={assessmentResult?.reasons ?? []}
        />
        <WeatherWidget weather={assessmentResult?.weather} />
      </main>
    </div>
  );
}
