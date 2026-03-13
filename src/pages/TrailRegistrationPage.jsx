import Navbar from "../components/shared/Navbar.jsx";
import TrailMap from "../components/map/TrailMap.jsx";

export default function TrailRegistrationPage() {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Register for a Hike</h1>
        <p className="page-subheading">Log your planned trail so nearby users &amp; contacts can track you</p>
        <TrailMap />
        <div className="section-card">
          <p className="page-subheading">TrailRegistrationPage — form stub</p>
        </div>
      </main>
    </div>
  );
}
