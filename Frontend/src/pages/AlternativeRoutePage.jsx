import Navbar from "../components/shared/Navbar.jsx";
import AlternativeRouteCard from "../components/hazard/AlternativeRouteCard.jsx";
import TrailMap from "../components/map/TrailMap.jsx";

export default function AlternativeRoutePage() {
  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Alternative Routes</h1>
        <p className="text-sm text-muted mb-6">Suggested reroutes around the hazard</p>
        <TrailMap />
        <AlternativeRouteCard />
      </main>
    </div>
  );
}
