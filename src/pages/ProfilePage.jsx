import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";

export default function ProfilePage() {
  const { currentUser } = useAuth();

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-heading">Profile</h1>
        <p className="page-subheading">Emergency contacts &amp; hiker info</p>
        <div className="section-card">
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Signed in as <strong style={{ color: "var(--text)" }}>{currentUser?.email}</strong>
          </p>
        </div>
      </main>
    </div>
  );
}
