import { useState, useEffect } from "react";
import Navbar from "../components/shared/Navbar.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { deriveExpLevel } from "../hooks/useAssessment.js";

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const wrap  = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const input = "flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 font-[inherit] placeholder:text-muted min-w-0";
const lbl   = "block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono";

// Experience tier badge colours
const TIER_COLORS = {
  beginner:     "text-blue-400 bg-blue-400/10 border-blue-400/20",
  intermediate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  advanced:     "text-primary  bg-primary/10   border-primary/20",
};

// Tier thresholds (mirrors Hiker_Profile_Service._derive_experience_rating)
const TIER_LABELS = {
  beginner:     "Beginner  (0–4 hikes)",
  intermediate: "Intermediate  (5–14 hikes)",
  advanced:     "Advanced  (15+ hikes)",
};

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // ── Fields aligned to HikerProfileAPI ─────────────────────────────────────
  // HikerProfileAPI AddUser/Update accepts: name, fitnessLevel, age, bio
  // totalHikesCompleted: accepted by our impl; not in formal Swagger spec
  // phone + emergencyContacts: UI-only, not sent to HikerProfileAPI
  const [form, setForm] = useState({
    // HikerProfileAPI-backed fields
    name:                "",
    fitnessLevel:        "medium",   // low | medium | high
    age:                 "",
    bio:                 "",
    totalHikesCompleted: 0,
    // UI-only fields (stored locally, not sent to HikerProfileAPI)
    phone:               "",
    emergencyContacts:   [{ name: "", phone: "", relation: "" }],
  });

  // ── Load from localStorage on mount ───────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("tg_profile");
    if (stored) {
      try { setForm(JSON.parse(stored)); } catch (_) { /* ignore */ }
    } else if (currentUser?.displayName) {
      setForm(f => ({ ...f, name: currentUser.displayName }));
    }
  }, [currentUser]);

  const derivedTier = deriveExpLevel(Number(form.totalHikesCompleted) || 0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setContact = (i, field, val) =>
    setForm(f => ({
      ...f,
      emergencyContacts: f.emergencyContacts.map((c, idx) =>
        idx === i ? { ...c, [field]: val } : c
      ),
    }));

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveErr("");
    try {
      const storedProfile = JSON.parse(localStorage.getItem("tg_profile") || "{}");
      const existingUserId = storedProfile.userId;

      // Build HikerProfileAPI payload (only API-backed fields)
      const apiPayload = {
        name:                form.name || currentUser?.displayName || "Unknown",
        fitnessLevel:        form.fitnessLevel,
        age:                 form.age ? Number(form.age) : null,
        bio:                 form.bio,
        totalHikesCompleted: Number(form.totalHikesCompleted) || 0,
      };

      let userId = existingUserId;

      if (existingUserId) {
        // Update existing profile — response may contain a new OutSystems userId
        const res = await fetch(`${ORCHESTRATOR_URL}/hiker-profile/${existingUserId}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(apiPayload),
        });
        if (res.ok) {
          const data = await res.json();
          // OutSystems assigned a canonical integer userId — adopt it
          if (data.userId && data.userId !== existingUserId) {
            userId = data.userId;
          }
        }
      } else {
        // Create new profile
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

      // Persist full form (including UI-only fields) to localStorage
      localStorage.setItem("tg_profile", JSON.stringify({ ...form, userId }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveErr("Could not reach the profile service. Changes saved locally.");
      // Still save locally so the flow works offline/in dev
      const storedProfile = JSON.parse(localStorage.getItem("tg_profile") || "{}");
      localStorage.setItem("tg_profile", JSON.stringify({ ...form, userId: storedProfile.userId }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen relative z-[1]">
      <Navbar />
      <main className="flex-1 p-6 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[1.4rem] font-bold text-fg mb-1">Profile</h1>
        <p className="text-sm text-muted mb-6">Hiker info &amp; emergency contacts</p>

        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-bg text-green border border-green-line text-sm mb-4">
            <span>✓</span><span>Profile saved successfully</span>
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
              </div>
            </div>

            {/* name — HikerProfileAPI field */}
            <div className="mb-4">
              <label className={lbl}>Full Name <span className="text-primary/50 font-normal">(API-backed)</span></label>
              <div className={wrap}>
                <input type="text" placeholder="Your name"
                  value={form.name} onChange={e => set("name", e.target.value)} className={input} />
              </div>
            </div>

            {/* phone — UI-only */}
            <div className="mb-4">
              <label className={lbl}>
                Phone Number <span className="text-muted font-normal">(local only — used for emergency reports)</span>
              </label>
              <div className={wrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 13 19.79 19.79 0 0 1 1.09 4.24 2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input type="tel" placeholder="+65 9123 4567"
                  value={form.phone} onChange={e => set("phone", e.target.value)} className={input} />
              </div>
            </div>
          </div>

          {/* ── Hiker Info (HikerProfileAPI-backed) ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <h2 className="text-[0.95rem] font-semibold text-fg mb-1">Hiker Info</h2>
            <p className="text-xs text-muted mb-4">Fields used by the Trail Safety Assessment evaluator</p>

            <div className="grid grid-cols-2 gap-3 mb-4">

              {/* fitnessLevel — HikerProfileAPI field */}
              <div>
                <label className={lbl}>Fitness Level <span className="text-primary/50 font-normal">(API-backed)</span></label>
                <div className={`${wrap} pr-4`}>
                  <select value={form.fitnessLevel} onChange={e => set("fitnessLevel", e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-fg text-[0.9rem] py-3 cursor-pointer">
                    {[["low","Low — casual walker"],["medium","Medium — regular hiker"],["high","High — trained athlete"]].map(([v,l]) => (
                      <option key={v} value={v} className="bg-card">{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* age — HikerProfileAPI field */}
              <div>
                <label className={lbl}>Age <span className="text-primary/50 font-normal">(API-backed)</span></label>
                <div className={wrap}>
                  <input type="number" min="10" max="100" placeholder="e.g. 28"
                    value={form.age} onChange={e => set("age", e.target.value)} className={input} />
                </div>
              </div>
            </div>

            {/* totalHikesCompleted — accepted by our AddUser impl; drives experienceRating */}
            <div className="mb-4">
              <label className={lbl}>
                Total Hikes Completed
                <span className="text-muted font-normal ml-1">(drives Experience Rating)</span>
              </label>
              <div className="flex items-center gap-3">
                <div className={`${wrap} flex-1`}>
                  <input type="number" min="0" placeholder="0"
                    value={form.totalHikesCompleted}
                    onChange={e => set("totalHikesCompleted", Math.max(0, parseInt(e.target.value) || 0))}
                    className={input} />
                </div>
                {/* +/- quick buttons */}
                <button type="button" onClick={() => set("totalHikesCompleted", Math.max(0, (Number(form.totalHikesCompleted) || 0) - 1))}
                  className="w-9 h-9 rounded-full border border-line text-muted bg-surface text-lg flex items-center justify-center hover:border-primary hover:text-fg transition-colors cursor-pointer">−</button>
                <button type="button" onClick={() => set("totalHikesCompleted", (Number(form.totalHikesCompleted) || 0) + 1)}
                  className="w-9 h-9 rounded-full border border-line text-muted bg-surface text-lg flex items-center justify-center hover:border-primary hover:text-fg transition-colors cursor-pointer">+</button>
              </div>
            </div>

            {/* Derived experience tier — read-only display */}
            <div className="mb-4 p-3 bg-surface rounded-xl border border-line">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[0.82rem] font-mono font-semibold tracking-[0.04em] mb-0.5 ${lbl}`}>
                    Experience Rating <span className="text-muted font-normal">(derived · read-only)</span>
                  </div>
                  <div className="text-xs text-muted">{TIER_LABELS[derivedTier]}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${TIER_COLORS[derivedTier]}`}>
                  {derivedTier}
                </span>
              </div>
            </div>

            {/* bio — HikerProfileAPI field */}
            <div>
              <label className={lbl}>Bio / Notes <span className="text-primary/50 font-normal">(API-backed)</span></label>
              <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
                placeholder="Brief intro, hiking style, known conditions..."
                rows={2}
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-fg text-[0.9rem] font-[inherit] outline-none resize-y transition-colors focus:border-primary" />
            </div>
          </div>

          {/* ── Emergency Contacts (UI-only) ── */}
          <div className="bg-card border border-line rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[0.95rem] font-semibold text-fg">Emergency Contacts</h2>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, emergencyContacts: [...f.emergencyContacts, { name: "", phone: "", relation: "" }] }))}
                className="bg-primary/[0.18] border border-primary text-primary text-xs px-2.5 py-1.5 rounded-lg cursor-pointer font-semibold">
                + Add
              </button>
            </div>
            <p className="text-xs text-muted mb-4">Stored locally — used when submitting emergency incident reports</p>
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
                      <input type="tel" placeholder="Phone number (+65...)" value={c.phone}
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
