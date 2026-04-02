import { useState } from "react";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.92rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";
const icon  = "text-muted shrink-0";

// ── Preset hazard locations along each trail ─────────────────────────────────
// Coordinates sampled directly from the OSRM walking route at ~25%, 50%, 75%.
// These are on the actual routed path so the alternative-route calculation works.
const TRAIL_HAZARD_POINTS = {
  "1": [
    { id: "1a", label: "Near Henderson Waves (25%)",    lat: 1.2708, lng: 103.8102 },
    { id: "1b", label: "Forest Walk midpoint (50%)",    lat: 1.2774, lng: 103.8026 },
    { id: "1c", label: "Approaching Hort Park (75%)",   lat: 1.2882, lng: 103.8037 },
  ],
  "2": [
    { id: "2a", label: "Lornie Trail section (25%)",    lat: 1.3430, lng: 103.8381 },
    { id: "2b", label: "Reservoir loop midpoint (50%)", lat: 1.3540, lng: 103.8335 },
    { id: "2c", label: "Near Venus Drive (75%)",        lat: 1.3554, lng: 103.8321 },
  ],
  "3": [
    { id: "3a", label: "Lower summit trail (25%)",      lat: 1.3471, lng: 103.7751 },
    { id: "3b", label: "Summit trail midway (50%)",     lat: 1.3462, lng: 103.7758 },
    { id: "3c", label: "Near Dairy Farm exit (75%)",    lat: 1.3452, lng: 103.7754 },
  ],
  "4": [
    { id: "4a", label: "Labrador Park road (25%)",      lat: 1.2719, lng: 103.8061 },
    { id: "4b", label: "Coastal path midpoint (50%)",   lat: 1.2658, lng: 103.8211 },
    { id: "4c", label: "Berlayer Creek area (75%)",     lat: 1.2657, lng: 103.8251 },
  ],
  "5": [
    { id: "5a", label: "Kranji Way section (25%)",      lat: 1.4298, lng: 103.7068 },
    { id: "5b", label: "Wetland access road (50%)",     lat: 1.4174, lng: 103.7161 },
    { id: "5c", label: "Near observation hide (75%)",   lat: 1.4340, lng: 103.7250 },
  ],
  "6": [
    { id: "6a", label: "Park entrance path (25%)",      lat: 1.3515, lng: 103.7600 },
    { id: "6b", label: "Quarry loop midpoint (50%)",    lat: 1.3547, lng: 103.7611 },
    { id: "6c", label: "Little Guilin approach (75%)",  lat: 1.3530, lng: 103.7600 },
  ],
  "7": [
    { id: "7a", label: "Ubin road section (25%)",       lat: 1.3913, lng: 103.9757 },
    { id: "7b", label: "Trail midpoint (50%)",           lat: 1.3913, lng: 103.9757 },
    { id: "7c", label: "Chek Jawa approach (75%)",      lat: 1.3913, lng: 103.9757 },
  ],
  "8": [
    { id: "8a", label: "Vigilante Drive area (25%)",    lat: 1.2969, lng: 103.7830 },
    { id: "8b", label: "Canopy Walk section (50%)",     lat: 1.2939, lng: 103.7850 },
    { id: "8c", label: "Near Pepys Road (75%)",         lat: 1.2903, lng: 103.7847 },
  ],
  "9": [
    { id: "9a", label: "Park entrance path (25%)",      lat: 1.4402, lng: 103.7985 },
    { id: "9b", label: "Boardwalk midpoint (50%)",      lat: 1.4420, lng: 103.8030 },
    { id: "9c", label: "Mangrove far end (75%)",        lat: 1.4436, lng: 103.8043 },
  ],
  "10": [
    { id: "10a", label: "Forest entrance (25%)",        lat: 1.3242, lng: 103.7725 },
    { id: "10b", label: "Trail midpoint (50%)",          lat: 1.3296, lng: 103.7776 },
    { id: "10c", label: "Near West Coast end (75%)",    lat: 1.3320, lng: 103.7753 },
  ],
};

function InfoRow({ iconPath, children }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 bg-surface border border-line rounded-full text-[0.9rem] text-fg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon}>
        <path d={iconPath} />
      </svg>
      <span className="flex-1 truncate">{children}</span>
      <span className="text-[0.7rem] text-primary/70 font-mono shrink-0">auto</span>
    </div>
  );
}

function WarnRow({ children }) {
  return (
    <div className="px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-full text-sm text-amber-400">
      {children}
    </div>
  );
}

export default function HazardReportForm({
  onSubmit, loading, hazardType,
  prefillTrailId, prefillTrailName,
  coords, resolvedAddress,
}) {
  const [description, setDescription] = useState("");
  // "preset:<id>" | "live" | null
  const [locChoice, setLocChoice] = useState(null);

  const hasTrail  = !!prefillTrailId;
  const hasCoords = !!coords;

  const presets = TRAIL_HAZARD_POINTS[prefillTrailId] ?? [];

  // Resolve the selected location to {lat, lng, description}
  function getSelectedLocation() {
    if (!locChoice) return null;
    if (locChoice === "live") {
      if (!hasCoords) return null;
      return {
        lat: coords.lat,
        lng: coords.lng,
        description: resolvedAddress ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      };
    }
    const preset = presets.find(p => p.id === locChoice);
    if (!preset) return null;
    return { lat: preset.lat, lng: preset.lng, description: preset.label };
  }

  const selectedLoc = getSelectedLocation();

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedLoc) return;
    onSubmit?.({
      hikerId:     "usr_001",
      trailId:     prefillTrailId || "unknown",
      mountainId:  "sg",
      hazardType,
      severity:    3,
      hazardLat:   selectedLoc.lat,
      hazardLng:   selectedLoc.lng,
      currentLat:  selectedLoc.lat,
      currentLng:  selectedLoc.lng,
      description,
      location:    { description: selectedLoc.description },
    });
  }

  return (
    <form className="bg-card border border-line rounded-2xl p-6 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Hazard Details</h2>

      {/* Trail Name — auto-filled from active hike */}
      <div className="mb-4">
        <label className={lbl}>Trail Name</label>
        {hasTrail
          ? <InfoRow iconPath="M3 20l5-9 4 6 3-4 6 7">
              {prefillTrailName ? `${prefillTrailName} (ID: ${prefillTrailId})` : `Trail #${prefillTrailId}`}
            </InfoRow>
          : <WarnRow>No active hike found — register a trail first</WarnRow>
        }
      </div>

      {/* Hazard Location — preset trail points + live location */}
      <div className="mb-4">
        <label className={lbl}>Hazard Location</label>

        {hasTrail && presets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {presets.map(p => {
              const isSelected = locChoice === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLocChoice(isSelected ? null : p.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-full border transition-all cursor-pointer bg-transparent ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-line bg-surface hover:bg-white/[0.04]"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#4ade80" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? "text-fg" : "text-fg/80"}`}>{p.label}</p>
                    <p className="text-[0.7rem] text-muted font-mono">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                  </div>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Live Location option */}
            <button
              type="button"
              onClick={() => setLocChoice(locChoice === "live" ? null : "live")}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-full border transition-all cursor-pointer bg-transparent ${
                locChoice === "live"
                  ? "border-blue-400 bg-blue-400/10"
                  : "border-line bg-surface hover:bg-white/[0.04]"
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${locChoice === "live" ? "border-blue-400" : "border-muted"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${locChoice === "live" ? "bg-blue-400" : ""}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${locChoice === "live" ? "text-fg" : "text-fg/80"}`}>
                  Use Live Location
                </p>
                {locChoice === "live" && hasCoords && (
                  <p className="text-[0.7rem] text-muted font-mono truncate">
                    {resolvedAddress ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                  </p>
                )}
                {locChoice === "live" && !hasCoords && (
                  <p className="text-[0.7rem] text-amber-400">Waiting for GPS...</p>
                )}
              </div>
              {locChoice === "live" && hasCoords && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <WarnRow>Select a trail above to see hazard location options</WarnRow>
        )}
      </div>

      <div className="mb-4">
        <label className={lbl}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the hazard in detail..."
          rows={3}
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.92rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !hazardType || !selectedLoc}
        className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed border-none"
      >
        {loading ? "Submitting..." : "Submit Hazard Report"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
      {!hazardType && (
        <p className="text-center text-xs text-muted mt-2">Select a hazard type above first</p>
      )}
      {hazardType && !selectedLoc && (
        <p className="text-center text-xs text-muted mt-2">Select a hazard location above</p>
      )}
    </form>
  );
}
