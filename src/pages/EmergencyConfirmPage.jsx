import Navbar from "../components/shared/Navbar.jsx";
import EmergencyStatusCard from "../components/emergency/EmergencyStatusCard.jsx";

export default function EmergencyConfirmPage() {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Help is on the way</h1>
        <p className="page-subheading">Emergency services and contacts have been notified — S2</p>
        <EmergencyStatusCard />
      </main>
    </div>
  );
}
