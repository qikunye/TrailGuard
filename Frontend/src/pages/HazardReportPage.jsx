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

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

async function reverseGeocode(lat, lng) {
  if (!GMAPS_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`
    );
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.formatted_address) {
      return data.results[0].formatted_address;
    }
  } catch { /* give up */ }
  return null;
}

export default function HazardReportPage() {
  const { submitReport, loading } = useHazardReport();
  const { coords } = useGeolocation();
  const { uid } = useProfile();
  const navigate = useNavigate();
  const [hazardType, setHazardType] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);

  // ── Guard: only accessible while actively hiking ─────────────────────────
  const isActivelyHiking = (() => {
    if (!uid) return false;
    try {
      const saved = JSON.parse(localStorage.getItem(`activeTrack_${uid}`));
      return saved?.status === "tracking";
    } catch { return false; }
  })();

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
    reverseGeocode(coords.lat, coords.lng).then(addr => { if (addr) setResolvedAddress(addr); });
  }, [coords?.lat, coords?.lng]);

  async function handleSubmit(data) {
    // Always store the submission payload so AlternativeRoutePage can
    // call the service directly if the full chain didn't return data.
    sessionStorage.setItem("hazardPayload", JSON.stringify(data));

    // Persist the reported hazard to localStorage so TrackHikePage can display it
    if (uid && data.trailId) {
      try {
        const key = `reportedHazards_${uid}`;
        const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
        existing.push({
          id: `haz_${Date.now()}`,
          trailId: String(data.trailId),
          hazardType: hazardType ?? data.hazardType ?? "Unknown",
          severity: data.severity ?? 3,
          hazardLat: data.hazardLat,
          hazardLng: data.hazardLng,
          description: data.description ?? "",
          locationDescription: data.location?.description ?? "",
          reportedAt: new Date().toISOString(),
        });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch { /* ignore */ }
    }

    const result = await submitReport({ ...data, hazardType });
    if (result?.reroutingResult) {
      sessionStorage.setItem("altRouteData", JSON.stringify(result.reroutingResult));
    }
    // Navigate regardless — AlternativeRoutePage has its own fallback
    navigate("/hazard/alternative");
  }

  if (!isActivelyHiking) return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-fg mb-2">Not on a hike</h2>
        <p className="text-sm text-muted mb-6 max-w-xs">Hazard reporting is only available while you have an active hike in progress. Start tracking your hike first.</p>
        <button onClick={() => navigate("/track-hike")}
          className="px-5 py-2.5 rounded-full bg-primary text-sm font-semibold text-black cursor-pointer border-none hover:opacity-90 transition-opacity">
          Go to Track Hike
        </button>
      </main>
    </div>
  );

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
