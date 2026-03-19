import { useState } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import TrailMap from "../components/map/TrailMap.jsx";
import { Link } from "react-router-dom";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

export default function TrailRegistrationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    trailName: "", startDate: new Date().toISOString().split("T")[0],
    startTime: "08:00", estimatedDuration: "", partySize: 1, notes: "",
  });

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen relative z-[1]">
        <Navbar />
        <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
          <div className="bg-card border border-line rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">📍</div>
            <h2 className="text-xl font-bold text-green mb-1">Hike Registered!</h2>
            <p className="text-sm text-muted mb-6">
              Your emergency contacts will be notified if you don&apos;t check in on time.
            </p>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button onClick={() => setSubmitted(false)} className="flex-1 py-3 px-4 bg-transparent border border-line text-muted rounded-full text-sm font-semibold cursor-pointer transition-colors hover:border-primary hover:text-fg">
                Register Another
              </button>
              <Link to="/dashboard" className="flex-1 no-underline">
                <button className="w-full py-3 px-4 bg-primary text-bg rounded-full text-sm font-bold cursor-pointer transition-all hover:opacity-90 border-none">
                  Dashboard
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Register for a Hike</h1>
        <p className="text-sm text-muted mb-6">Log your planned trail so your contacts can track you</p>

        <TrailMap />

        <form className="bg-card border border-line rounded-2xl p-6" onSubmit={e => { e.preventDefault(); setSubmitted(true); }}>
          <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Hike Details</h2>

          <div className="mb-4">
            <label className={lbl}>Trail Name</label>
            <div className={wrap}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                <path d="M3 20l5-9 4 6 3-4 6 7"/>
              </svg>
              <input type="text" placeholder="e.g. MacRitchie Reservoir Trail" value={form.trailName} onChange={e => setForm(f => ({ ...f, trailName: e.target.value }))} required className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-4">
              <label className={lbl}>Start Date</label>
              <div className={wrap}>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={input} />
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Start Time</label>
              <div className={wrap}>
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={input} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="mb-4">
              <label className={lbl}>Est. Duration (hrs)</label>
              <div className={wrap}>
                <input type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 3" value={form.estimatedDuration} onChange={e => setForm(f => ({ ...f, estimatedDuration: e.target.value }))} className={input} />
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Party Size</label>
              <div className={wrap}>
                <input type="number" min="1" max="50" value={form.partySize} onChange={e => setForm(f => ({ ...f, partySize: e.target.value }))} className={input} />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className={lbl}>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Planned route, vehicle parked at, special equipment..."
              rows={2}
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary"
            />
          </div>

          <button type="submit" className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
            Register Hike
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
}
