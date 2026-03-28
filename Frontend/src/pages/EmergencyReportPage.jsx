import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import SeveritySelector from "../components/emergency/SeveritySelector.jsx";
import IncidentReportForm from "../components/emergency/IncidentReportForm.jsx";
import PhotoUpload from "../components/emergency/PhotoUpload.jsx";
import { useEmergency } from "../hooks/useEmergency.js";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { useNavigate } from "react-router-dom";

const MAPS_URL = import.meta.env.VITE_MAPS_WRAPPER_URL ?? "http://localhost:8007";

export default function EmergencyReportPage() {
  const { submitReport, loading, error } = useEmergency();
  const { coords } = useGeolocation();
  const navigate = useNavigate();

  const [severity,        setSeverity]        = useState(null);
  const [photoUrl,        setPhotoUrl]        = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);

  // ── Read pre-fill data from localStorage ──────────────────────────────────
  const profile      = (() => { try { return JSON.parse(localStorage.getItem("tg_profile")) ?? {}; } catch { return {}; } })();
  const upcomingHike = (() => { try { return JSON.parse(localStorage.getItem("upcomingHike")) ?? {}; } catch { return {}; } })();

  const prefillUserId  = profile.userId   ?? null;
  const prefillPhone   = profile.phone    ?? "";
  const prefillTrailId = upcomingHike.selectedTrailId ?? null;
  const prefillTrailName = upcomingHike.startLocation && upcomingHike.endLocation
    ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
    : null;

  // ── Resolve GPS coords to human-readable address ──────────────────────────
  useEffect(() => {
    if (!coords) return;
    fetch(`${MAPS_URL}/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.formattedAddress) setResolvedAddress(data.formattedAddress); })
      .catch(() => {});
  }, [coords?.lat, coords?.lng]);

  async function handleSubmit(data) {
    const result = await submitReport({ ...data, severity, photoUrl });
    if (result) navigate("/emergency/confirm", { state: { result } });
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Emergency Report</h1>
        <p className="text-sm text-muted mb-6">Report an injury or emergency on-trail</p>

        {error && (
          <div className="bg-red-bg border border-red-line rounded-xl px-4 py-3 mb-4 text-sm text-red">
            ⚠ {error}
          </div>
        )}

        <SeveritySelector value={severity} onChange={setSeverity} />
        <IncidentReportForm
          onSubmit={handleSubmit}
          loading={loading}
          severity={severity}
          photoUrl={photoUrl}
          coords={coords}
          resolvedAddress={resolvedAddress}
          prefillUserId={prefillUserId}
          prefillTrailId={prefillTrailId}
          prefillTrailName={prefillTrailName}
          prefillPhone={prefillPhone}
        />
        <PhotoUpload onUpload={file => setPhotoUrl(URL.createObjectURL(file))} />
      </main>
    </div>
  );
}
