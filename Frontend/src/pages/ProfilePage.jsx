import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useProfile } from "../hooks/useProfile.js";
import { deriveExpLevel } from "../hooks/useAssessment.js";

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

const TIER_COLORS = {
  beginner:     "text-blue-400 bg-blue-400/10 border-blue-400/20",
  intermediate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  advanced:     "text-primary  bg-primary/10   border-primary/20",
};

const TIER_LABELS = {
  beginner:     "Beginner  (0–4 hikes)",
  intermediate: "Intermediate  (5–14 hikes)",
  advanced:     "Advanced  (15+ hikes)",
};

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { profile, saveProfile, isSetup } = useProfile();
  const navigate = useNavigate();

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const [form, setForm] = useState({
    name:                "",
    fitnessLevel:        "medium",
    age:                 "",
    bio:                 "",
    totalHikesCompleted: 0,
    phone:               "",
    emergencyContacts:   [{ name: "", phone: "", relation: "" }],
  });

  // Load saved profile (scoped to this Firebase user) on mount
  useEffect(() => {
    if (profile && Object.keys(profile).length > 0) {
      setForm(f => ({
        ...f,
        ...profile,
        // Ensure emergencyContacts is always a valid array
        emergencyContacts: Array.isArray(profile.emergencyContacts) && profile.emergencyContacts.length > 0
          ? profile.emergencyContacts
          : f.emergencyContacts,
      }));
    } else if (currentUser?.displayName) {
      setForm(f => ({ ...f, name: currentUser.displayName }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const derivedTier = deriveExpLevel(Number(form.totalHikesCompleted) || 0);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setContact = (i, field, val) =>
    setForm(f => ({
      ...f,
      emergencyContacts: f.emergencyContacts.map((c, idx) =>
        idx === i ? { ...c, [field]: val } : c
      ),
    }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveErr("");

    const existingUserId = profile.userId;

    const apiPayload = {
      name:                form.name || currentUser?.displayName || "Unknown",
      fitnessLevel:        form.fitnessLevel,
      age:                 form.age ? Number(form.age) : null,
      bio:                 form.bio,
      totalHikesCompleted: Number(form.totalHikesCompleted) || 0,
    };

    let userId = existingUserId;

    try {
      if (existingUserId) {
        const res = await fetch(`${ORCHESTRATOR_URL}/hiker-profile/${existingUserId}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(apiPayload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.userId && data.userId !== existingUserId) userId = data.userId;
        }
      } else {
        const res = await fetch(`${ORCHESTRATOR_URL}/hiker-profile`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(apiPayload),
        });
        if (res.ok) {
          const data = await res.json();
          userId = data.userId;
        }
      }
    } catch {
      setSaveErr("Could not reach the profile service. Saved locally only.");
    }

    saveProfile({ ...form, userId });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    // If this was the first save (just got a userId), send to dashboard
    if (!existingUserId && userId) {
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    }
  }

  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Profile</h1>

        {/* Banner for new users who haven't set up yet */}
        {!isSetup && (
          <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-5 text-sm text-amber-400">
            Complete your profile to access TrailGuard. Fill in your details and tap <strong>Save Profile</strong>.
          </div>
        )}

        <p className="text-sm text-muted mb-6">Hiker info &amp; emergency contacts</p>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-bg text-green border border-green-line text-sm mb-4">
            <span>✓</span><span>Profile saved{!isSetup ? " — redirecting…" : ""}</span>
          </div>
        )}
        {saveErr && (
          <div className="px-4 py-3 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 text-sm mb-4">
            {saveErr}
          </div>
        )}

        <form onSubmit={handleSave}>

          {/* ── Account ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.95rem] font-semibold text-fg mb-4">Account</h2>
            <div className="flex items-center gap-3 mb-4">
              {currentUser?.photoURL
                ? <img src={currentUser.photoURL} className="w-12 h-12 rounded-full border-2 border-primary" alt="avatar" />
                : <div className="w-12 h-12 rounded-full border-2 border-line bg-surface flex items-center justify-center text-xl">👤</div>}
              <div>
                <div className="font-semibold text-fg">{currentUser?.displayName ?? "—"}</div>
                <div className="text-xs text-muted">{currentUser?.email}</div>
                {profile.userId && (
                  <div className="text-xs text-primary font-mono mt-0.5">User #{profile.userId}</div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className={lbl}>Full Name</label>
              <div className={wrap}>
                <input type="text" placeholder="Your name"
                  value={form.name} onChange={e => set("name", e.target.value)} className={input} />
              </div>
            </div>

            <div className="mb-0">
              <label className={lbl}>
                Phone Number <span className="text-muted font-normal">(used for emergency SMS confirmation)</span>
              </label>
              <div className={wrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input type="tel" placeholder="+6591234567"
                  value={form.phone} onChange={e => set("phone", e.target.value)} className={input} />
              </div>
            </div>
          </div>

          {/* ── Hiker Info ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.95rem] font-semibold text-fg mb-1">Hiker Info</h2>
            <p className="text-xs text-muted mb-4">Used by the Trail Safety Assessment evaluator</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className={lbl}>Fitness Level</label>
                <div className={`${wrap} pr-4`}>
                  <select value={form.fitnessLevel} onChange={e => set("fitnessLevel", e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 cursor-pointer">
                    {[["low","Low — casual walker"],["medium","Medium — regular hiker"],["high","High — trained athlete"]].map(([v,l]) => (
                      <option key={v} value={v} className="bg-card">{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={lbl}>Age</label>
                <div className={wrap}>
                  <input type="number" min="10" max="100" placeholder="e.g. 28"
                    value={form.age} onChange={e => set("age", e.target.value)} className={input} />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className={lbl}>Total Hikes Completed</label>
              <div className="flex items-center gap-3">
                <div className={`${wrap} flex-1`}>
                  <input type="number" min="0" placeholder="0"
                    value={form.totalHikesCompleted}
                    onChange={e => set("totalHikesCompleted", Math.max(0, parseInt(e.target.value) || 0))}
                    className={input} />
                </div>
                <button type="button" onClick={() => set("totalHikesCompleted", Math.max(0, (Number(form.totalHikesCompleted) || 0) - 1))}
                  className="w-9 h-9 rounded-full border border-line text-muted bg-surface text-lg flex items-center justify-center hover:border-primary hover:text-fg transition-colors cursor-pointer">−</button>
                <button type="button" onClick={() => set("totalHikesCompleted", (Number(form.totalHikesCompleted) || 0) + 1)}
                  className="w-9 h-9 rounded-full border border-line text-muted bg-surface text-lg flex items-center justify-center hover:border-primary hover:text-fg transition-colors cursor-pointer">+</button>
              </div>
            </div>

            <div className="mb-4 p-3 bg-surface rounded-xl border border-line">
              <div className="flex items-center justify-between">
                <div>
                  <div className={lbl}>Experience Rating <span className="text-muted font-normal">(derived)</span></div>
                  <div className="text-xs text-muted">{TIER_LABELS[derivedTier]}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${TIER_COLORS[derivedTier]}`}>
                  {derivedTier}
                </span>
              </div>
            </div>

            <div>
              <label className={lbl}>Bio / Notes</label>
              <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
                placeholder="Brief intro, hiking style, known conditions..."
                rows={2}
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary" />
            </div>
          </div>

          {/* ── Emergency Contacts ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[0.95rem] font-semibold text-fg">Emergency Contacts</h2>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, emergencyContacts: [...f.emergencyContacts, { name: "", phone: "", relation: "" }] }))}
                className="bg-primary/[0.18] border border-primary text-primary text-xs px-2.5 py-1.5 rounded-lg cursor-pointer font-semibold">
                + Add
              </button>
            </div>
            <p className="text-xs text-muted mb-4">Used when submitting emergency incident reports</p>
            <div className="flex flex-col gap-3">
              {form.emergencyContacts.map((c, i) => (
                <div key={i} className="bg-surface rounded-xl p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-muted">Contact {i + 1}</span>
                    {i > 0 && (
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, emergencyContacts: f.emergencyContacts.filter((_, idx) => idx !== i) }))}
                        className="text-xs text-red bg-transparent border-none cursor-pointer">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2">
                      <input type="text" placeholder="Name" value={c.name}
                        onChange={e => setContact(i, "name", e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2">
                      <input type="text" placeholder="Relation" value={c.relation}
                        onChange={e => setContact(i, "relation", e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                    <div className="flex items-center bg-card border border-line rounded-full px-3 gap-2 col-span-2">
                      <input type="tel" placeholder="+6591234567" value={c.phone}
                        onChange={e => setContact(i, "phone", e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-fg text-sm py-2.5 font-[inherit] placeholder:text-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px border-none disabled:opacity-50">
            {saving ? "Saving…" : (
              <>
                Save Profile
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
