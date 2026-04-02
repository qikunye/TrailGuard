import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import SeveritySelector from "../components/emergency/SeveritySelector.jsx";
import IncidentReportForm from "../components/emergency/IncidentReportForm.jsx";
import PhotoUpload from "../components/emergency/PhotoUpload.jsx";
import { useEmergency } from "../hooks/useEmergency.js";
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

export default function EmergencyReportPage() {
  const { submitReport, loading, error } = useEmergency();
  const { coords } = useGeolocation();
  const navigate = useNavigate();

  const [severity,        setSeverity]        = useState(null);
  const [photoUrl,        setPhotoUrl]        = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState(null);

  // ── Read pre-fill data ────────────────────────────────────────────────────
  const { profile, uid } = useProfile();

  // ── Guard: only accessible while actively hiking ─────────────────────────
  const isActivelyHiking = (() => {
    if (!uid) return false;
    try {
      const saved = JSON.parse(localStorage.getItem(`activeTrack_${uid}`));
      return saved?.status === "tracking";
    } catch { return false; }
  })();
  const upcomingKey  = uid ? `upcomingHike_${uid}` : null;
  const upcomingHike = (() => {
    if (!upcomingKey) return {};
    try { return JSON.parse(localStorage.getItem(upcomingKey)) ?? {}; } catch { return {}; }
  })();

  const prefillUserId  = profile.userId ?? null;
  const prefillPhone   = profile.phone  ?? "";
  const prefillTrailId = upcomingHike.selectedTrailId ?? null;
  const prefillTrailName = upcomingHike.startLocation && upcomingHike.endLocation
    ? `${upcomingHike.startLocation} → ${upcomingHike.endLocation}`
    : null;

  // ── Resolve GPS coords to human-readable address ──────────────────────────
  useEffect(() => {
    if (!coords) return;
    reverseGeocode(coords.lat, coords.lng).then(addr => { if (addr) setResolvedAddress(addr); });
  }, [coords?.lat, coords?.lng]);

  async function handleSubmit(data) {
    const localContacts = (profile.emergencyContacts ?? [])
      .filter(c => c.name && c.phone)
      .map(c => ({ name: c.name, phone: c.phone, relation: c.relation ?? "" }));
    const result = await submitReport({ ...data, severity, photoUrl, localEmergencyContacts: localContacts });
    if (result) {
      navigate("/emergency/confirm", { state: { result, notifiedContacts: localContacts } });
    }
  }

  if (!isActivelyHiking) return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-fg mb-2">Not on a hike</h2>
        <p className="text-sm text-muted mb-6 max-w-xs">Emergency reporting is only available while you have an active hike in progress. Start tracking your hike first.</p>
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
