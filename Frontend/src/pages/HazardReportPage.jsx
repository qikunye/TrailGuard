import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import TrailStatusBanner from "../components/hazard/TrailStatusBanner.jsx";
import HazardTypeSelector from "../components/hazard/HazardTypeSelector.jsx";
import HazardReportForm from "../components/hazard/HazardReportForm.jsx";
import TrailMap from "../components/map/TrailMap.jsx";
import { useHazardReport } from "../hooks/useHazardReport.js";
import { useGeolocation } from "../hooks/useGeolocation.js";
import { useProfile } from "../hooks/useProfile.js";
import { useNavigate } from "react-router-dom";
import { kongFetch } from "../lib/kongClient.js";

const MAPS_URL = import.meta.env.VITE_MAPS_WRAPPER_URL ?? "http://localhost:8080/api/maps";

export default function HazardReportPage() {
  const { submitReport, loading } = useHazardReport();
  const { coords } = useGeolocation();
  const { uid } = useProfile();
  const navigate = useNavigate();
  const [hazardType, setHazardType] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);

  // Read the active hike from localStorage (same pattern as EmergencyReportPage)
  const upcomingKey  = uid ? `upcomingHike_${uid}` : null;
  const upcomingHike = (() => {
    if (!upcomingKey) return {};
    try { return JSON.parse(localStorage.getItem(upcomingKey)) ?? {}; } catch { return {}; }
  })();

  const prefillTrailId   = upcomingHike.selectedTrailId ?? null;
  const prefillTrailName = upcomingHike.startLocation && upcomingHike.endLocation
    ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
    : null;

  // Resolve GPS coords to human-readable address
  useEffect(() => {
    if (!coords) return;
    kongFetch(`${MAPS_URL}/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.formattedAddress) setResolvedAddress(data.formattedAddress); })
      .catch(() => {});
  }, [coords?.lat, coords?.lng]);

  async function handleSubmit(data) {
    const result = await submitReport({ ...data, hazardType });
    if (result) navigate("/hazard/alternative");
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Report a Hazard</h1>
        <p className="text-sm text-muted mb-6">Flag a dangerous trail condition</p>
        <TrailStatusBanner status="CAUTION" />
        <HazardTypeSelector value={hazardType} onChange={setHazardType} />
        <HazardReportForm
          onSubmit={handleSubmit}
          loading={loading}
          hazardType={hazardType}
          prefillTrailId={prefillTrailId}
          prefillTrailName={prefillTrailName}
          coords={coords}
          resolvedAddress={resolvedAddress}
        />
        <TrailMap />
      </main>
    </div>
  );
}
