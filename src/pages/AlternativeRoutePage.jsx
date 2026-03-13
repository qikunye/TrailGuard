import Navbar from "../components/shared/Navbar.jsx";
import AlternativeRouteCard from "../components/hazard/AlternativeRouteCard.jsx";
import TrailMap from "../components/map/TrailMap.jsx";

export default function AlternativeRoutePage() {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Alternative Routes</h1>
        <p className="page-subheading">Suggested reroutes around the hazard — S3</p>
        <TrailMap />
        <AlternativeRouteCard />
      </main>
    </div>
  );
}
