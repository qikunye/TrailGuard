import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm]   = useState({
    displayName: "", phone: "", bloodType: "", medicalNotes: "", experienceLevel: "beginner",
    emergencyContacts: [{ name: "", phone: "", relation: "" }],
  });

  useEffect(() => {
    if (currentUser?.displayName) setForm(f => ({ ...f, displayName: currentUser.displayName }));
  }, [currentUser]);

  const setContact = (i, field, val) =>
    setForm(f => ({ ...f, emergencyContacts: f.emergencyContacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c) }));

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Profile</h1>
        <p className="text-sm text-muted mb-6">Emergency contacts &amp; hiker info</p>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-bg text-green border border-green-line text-sm mb-4">
            <span>✓</span><span>Profile saved successfully</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Account */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Account</h2>
            <div className="flex items-center gap-3 mb-4">
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} className="w-12 h-12 rounded-full border-2 border-primary" alt="avatar" />
                : <div className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center text-xl">👤</div>
              }
              <div>
                <div className="font-semibold text-fg">{currentUser?.displayName ?? "—"}</div>
                <div className="text-xs text-muted">{currentUser?.email}</div>
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Display Name</label>
              <div className={wrap}>
                <input type="text" placeholder="Your name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} className={input} />
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Phone Number</label>
              <div className={wrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input type="tel" placeholder="+65 9123 4567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={input} />
              </div>
            </div>
          </div>

          {/* Hiker Info */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Hiker Info</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="mb-4">
                <label className={lbl}>Experience Level</label>
                <div className={`${wrap} pr-4`}>
                  <select
                    value={form.experienceLevel}
                    onChange={e => setForm(f => ({ ...f, experienceLevel: e.target.value }))}
                    className="flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 cursor-pointer"
                  >
                    {["beginner","intermediate","advanced","expert"].map(v => (
                      <option key={v} value={v} className="bg-card capitalize">{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className={lbl}>Blood Type</label>
                <div className={wrap}>
                  <input type="text" placeholder="e.g. A+" value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))} className={input} />
                </div>
              </div>
            </div>
            <div>
              <label className={lbl}>Medical Notes</label>
              <textarea
                value={form.medicalNotes}
                onChange={e => setForm(f => ({ ...f, medicalNotes: e.target.value }))}
                placeholder="Allergies, conditions, medications..."
                rows={2}
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary"
              />
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[0.95rem] font-semibold text-fg">Emergency Contacts</h2>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, emergencyContacts: [...f.emergencyContacts, { name: "", phone: "", relation: "" }] }))}
                className="bg-primary/[0.18] border border-primary text-primary text-xs px-2.5 py-1.5 rounded-lg cursor-pointer font-semibold"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {form.emergencyContacts.map((c, i) => (
                <div key={i} className="bg-surface rounded-xl p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-muted">Contact {i + 1}</span>
                    {i > 0 && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, emergencyContacts: f.emergencyContacts.filter((_, idx) => idx !== i) }))} className="text-xs text-red bg-transparent border-none cursor-pointer">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2">
                      <input type="text" placeholder="Name" value={c.name} onChange={e => setContact(i, "name", e.target.value)} className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2">
                      <input type="text" placeholder="Relation" value={c.relation} onChange={e => setContact(i, "relation", e.target.value)} className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2 col-span-2">
                      <input type="tel" placeholder="Phone number" value={c.phone} onChange={e => setContact(i, "phone", e.target.value)} className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none">
            Save Profile
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
}
