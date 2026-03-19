import { useState } from "react";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.92rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

export default function HazardReportForm({ onSubmit, loading, hazardType }) {
  const [trailId,     setTrailId]     = useState("");
  const [location,    setLocation]    = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit?.({ trailId: trailId || "unknown", hazardType, description, location: { description: location } });
  }

  return (
    <form className="bg-card border border-line rounded-2xl p-6 mb-4" onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Hazard Details</h2>

      <div className="mb-4">
        <label className={lbl}>Trail Name</label>
        <div className={wrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
            <path d="M3 20l5-9 4 6 3-4 6 7"/>
          </svg>
          <input type="text" placeholder="e.g. MacRitchie Reservoir Trail" value={trailId} onChange={e => setTrailId(e.target.value)} className={input} />
        </div>
      </div>

      <div className="mb-4">
        <label className={lbl}>Hazard Location</label>
        <div className={wrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <input type="text" placeholder="e.g. Near km 2.5, after the stream crossing" value={location} onChange={e => setLocation(e.target.value)} className={input} />
        </div>
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
        disabled={loading || !hazardType}
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
    </form>
  );
}
