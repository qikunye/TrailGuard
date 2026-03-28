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

export default function IncidentReportForm({
  onSubmit, loading, severity, photoUrl,
  coords, resolvedAddress,
  prefillUserId, prefillTrailId, prefillTrailName, prefillPhone,
}) {
  const [injuryType,  setInjuryType]  = useState("");
  const [description, setDescription] = useState("");
  const [hikerPhone,  setHikerPhone]  = useState(prefillPhone ?? "");

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit?.({
      userId:      parseInt(prefillUserId, 10),
      trailId:     parseInt(prefillTrailId, 10),
      severity,
      injuryType,
      description,
      hikerPhone,
      lat:         coords?.lat ?? 1.3521,
      lng:         coords?.lng ?? 103.8198,
      photoUrl:    photoUrl ?? null,
    });
  }

  const canSubmit = injuryType && severity && hikerPhone && prefillUserId && prefillTrailId && !loading;

  return (
    <form className="bg-card border border-line rounded-2xl p-6 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Incident Details</h2>

      {/* Location */}
      <div className="mb-4">
        <label className={lbl}>Your Location</label>
        <InfoRow iconPath="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0">
          {resolvedAddress
            ? resolvedAddress
            : coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : "Detecting location…"}
        </InfoRow>
      </div>

      {/* User ID — read-only */}
      <div className="mb-4">
        <label className={lbl}>User ID</label>
        {prefillUserId
          ? <InfoRow iconPath="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z">
              User #{prefillUserId}
            </InfoRow>
          : <div className="px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-full text-sm text-amber-400">
              ⚠ No profile found — save your profile first
            </div>
        }
      </div>

      {/* Trail ID — read-only */}
      <div className="mb-4">
        <label className={lbl}>Trail</label>
        {prefillTrailId
          ? <InfoRow iconPath="M3 20l5-9 4 6 3-4 6 7">
              {prefillTrailName ? `${prefillTrailName} (ID: ${prefillTrailId})` : `Trail #${prefillTrailId}`}
            </InfoRow>
          : <div className="px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-full text-sm text-amber-400">
              ⚠ No active hike found — register a trail first
            </div>
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

      {/* Phone — pre-filled but editable */}
      <div className="mb-4">
        <label className={lbl}>Your Phone Number (for SMS confirmation)</label>
        <div className={wrap}>
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
        </div>
        <p className="text-[0.75rem] text-muted mt-1 ml-1">E.164 format, e.g. +6583355100</p>
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

      {!severity && (
        <p className="text-center text-xs text-muted mt-2">Select an injury severity above first</p>
      )}
      {(!prefillUserId || !prefillTrailId) && (
        <p className="text-center text-xs text-amber-400 mt-2">
          {!prefillUserId && "Save your profile · "}
          {!prefillTrailId && "Register a trail"}
          {" before submitting"}
        </p>
      )}
    </form>
  );
}
