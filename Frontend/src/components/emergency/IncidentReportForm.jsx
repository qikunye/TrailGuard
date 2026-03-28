import { useState } from "react";

const INJURY_TYPES = [
  "Sprain / Strain", "Fracture / Broken Bone", "Laceration / Cut",
  "Head Injury", "Dehydration / Heat Exhaustion", "Snake Bite",
  "Fall", "Cardiac Event", "Other",
];

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.92rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";
const icon  = "text-muted shrink-0";

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
      ⚠ {children}
    </div>
  );
}

export default function IncidentReportForm({
  onSubmit, loading, severity, photoUrl,
  coords, resolvedAddress,
  prefillUserId, prefillTrailId, prefillTrailName, prefillPhone,
}) {
  const [injuryType,  setInjuryType]  = useState("");
  const [description, setDescription] = useState("");
  const [hikerPhone,  setHikerPhone]  = useState(prefillPhone ?? "");

  const userIdInt  = parseInt(prefillUserId,  10);
  const trailIdInt = parseInt(prefillTrailId, 10);
  const validUserId  = !isNaN(userIdInt)  && userIdInt > 0;
  const validTrailId = !isNaN(trailIdInt) && trailIdInt > 0;
  const validPhone   = /^\+[1-9]\d{7,14}$/.test(hikerPhone);
  const hasCoords    = !!coords;

  function handleSubmit(e) {
    e.preventDefault();
    if (!validUserId || !validTrailId || !hasCoords || !validPhone) return;
    onSubmit?.({
      userId:   userIdInt,
      trailId:  trailIdInt,
      severity,
      injuryType,
      description,
      hikerPhone,
      lat:      coords.lat,
      lng:      coords.lng,
      photoUrl: photoUrl ?? null,
    });
  }

  const canSubmit = injuryType && severity && validPhone && validUserId && validTrailId && hasCoords && !loading;

  return (
    <form className="bg-card border border-line rounded-2xl p-6 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Incident Details</h2>

      {/* Location */}
      <div className="mb-4">
        <label className={lbl}>Your Location</label>
        {hasCoords
          ? <InfoRow iconPath="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z">
              {resolvedAddress ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
            </InfoRow>
          : <WarnRow>Waiting for GPS — allow location access and try again</WarnRow>
        }
      </div>

      {/* User ID */}
      <div className="mb-4">
        <label className={lbl}>User ID</label>
        {validUserId
          ? <InfoRow iconPath="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z">
              User #{userIdInt}
            </InfoRow>
          : <WarnRow>No profile found — go to Profile and save it first</WarnRow>
        }
      </div>

      {/* Trail */}
      <div className="mb-4">
        <label className={lbl}>Trail</label>
        {validTrailId
          ? <InfoRow iconPath="M3 20l5-9 4 6 3-4 6 7">
              {prefillTrailName ? `${prefillTrailName} (ID: ${trailIdInt})` : `Trail #${trailIdInt}`}
            </InfoRow>
          : <WarnRow>No active hike found — register a trail first</WarnRow>
        }
      </div>

      {/* Injury Type */}
      <div className="mb-4">
        <label className={lbl}>Injury Type</label>
        <div className={`${wrap} pr-4`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <select
            value={injuryType}
            onChange={e => setInjuryType(e.target.value)}
            required
            className="flex-1 bg-transparent border-none outline-none text-[0.92rem] py-3 cursor-pointer text-fg"
          >
            <option value="" disabled className="bg-card">Select injury type</option>
            {INJURY_TYPES.map(t => <option key={t} value={t} className="bg-card">{t}</option>)}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className={lbl}>Additional Details</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what happened..."
          rows={3}
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.92rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary"
        />
      </div>

      {/* Phone */}
      <div className="mb-4">
        <label className={lbl}>Your Phone Number (for SMS confirmation)</label>
        <div className={`${wrap} ${hikerPhone && !validPhone ? "border-red/50" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <input
            type="tel"
            placeholder="+6583355100"
            value={hikerPhone}
            onChange={e => setHikerPhone(e.target.value)}
            required
            className={input}
          />
          {validPhone && <span className="text-primary text-xs">✓</span>}
        </div>
        {hikerPhone && !validPhone && (
          <p className="text-[0.75rem] text-red mt-1 ml-1">Must be E.164 format, e.g. +6583355100</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed border-none"
      >
        {loading ? "Sending Alert…" : "Send Emergency Alert"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      {!severity && <p className="text-center text-xs text-muted mt-2">Select an injury severity above first</p>}
    </form>
  );
}
