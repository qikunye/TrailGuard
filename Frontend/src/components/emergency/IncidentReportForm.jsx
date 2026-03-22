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

export default function IncidentReportForm({ onSubmit, loading, severity, photoUrl }) {
  const [trailId,      setTrailId]      = useState("");
  const [injuryType,   setInjuryType]   = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [description,  setDescription]  = useState("");
  const [hikerPhone,   setHikerPhone]   = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit?.({ trailId: trailId || "unknown", severity, injuryType, description, location: { description: locationDesc }, photoUrl, hikerPhone });
  }

  return (
    <form className="bg-card border border-line rounded-2xl p-6 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Incident Details</h2>

      <div className="mb-4">
        <label className={lbl}>Trail / Location Name</label>
        <div className={wrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon}>
            <path d="M3 20l5-9 4 6 3-4 6 7"/>
          </svg>
          <input type="text" placeholder="e.g. MacRitchie Reservoir Trail" value={trailId} onChange={e => setTrailId(e.target.value)} className={input} />
        </div>
      </div>

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

      <div className="mb-4">
        <label className={lbl}>Location on Trail</label>
        <div className={wrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon}>
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <input type="text" placeholder="e.g. Near km 3, junction with blue trail" value={locationDesc} onChange={e => setLocationDesc(e.target.value)} className={input} />
        </div>
      </div>

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
        <p className="text-[0.75rem] text-muted mt-1 ml-1">Enter in E.164 format, e.g. +6583355100</p>
      </div>

      <button
        type="submit"
        disabled={loading || !injuryType || !severity || !hikerPhone}
        className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed border-none"
      >
        {loading ? "Sending Alert..." : "Send Emergency Alert"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
      {!severity && (
        <p className="text-center text-xs text-muted mt-2">Select an injury severity above first</p>
      )}
    </form>
  );
}
