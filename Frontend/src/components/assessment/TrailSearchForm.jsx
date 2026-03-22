import { useState } from "react";

const card     = "bg-card border border-line rounded-2xl p-6 mb-4";
const label    = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";
const wrap     = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input    = "flex-1 bg-transparent border-none outline-none text-fg text-[0.92rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const iconCls  = "text-muted shrink-0";

export default function TrailSearchForm({ onSearch, loading, initialValues }) {
  const [trailName, setTrailName] = useState(initialValues?.trailName || "");
  const [date, setDate]           = useState(initialValues?.date || new Date().toISOString().split("T")[0]);
  const [partySize, setPartySize] = useState(initialValues?.partySize || 1);

  function handleSubmit(e) {
    e.preventDefault();
    if (!trailName.trim()) return;
    onSearch({
      trailId: trailName.trim().toLowerCase().replace(/\s+/g, "-"),
      trailName: trailName.trim(),
      date,
      partySize: Number(partySize),
    });
  }

  return (
    <form className={card} onSubmit={handleSubmit}>
      <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Trail Details</h2>

      <div className="mb-4">
        <label className={label}>Trail Name</label>
        <div className={wrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconCls}>
            <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
          </svg>
          <input type="text" placeholder="e.g. MacRitchie Reservoir Trail" value={trailName} onChange={e => setTrailName(e.target.value)} required className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="mb-4">
          <label className={label}>Date</label>
          <div className={wrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconCls}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
          </div>
        </div>

        <div className="mb-4">
          <label className={label}>Party Size</label>
          <div className={wrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconCls}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <input type="number" min="1" max="50" value={partySize} onChange={e => setPartySize(e.target.value)} className={input} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed border-none mt-1"
      >
        {loading ? "Checking..." : "Check Trail Safety"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </form>
  );
}
