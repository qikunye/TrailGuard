import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/firebase.js";

const EyeOpen = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

function friendlyError(code) {
  const map = {
    "auth/invalid-email":        "Invalid email address.",
    "auth/user-not-found":       "No account found for that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in popup was closed.",
    "auth/unauthorized-domain":  "This domain isn't authorised in Firebase Console.",
    "auth/too-many-requests":    "Too many attempts. Try again later.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

const toastStyle = {
  error:   "bg-red-bg text-red border border-red-line",
  success: "bg-green-bg text-green border border-green-line",
  loading: "bg-[#0d1a14] text-[#7ec8a0] border border-[#1a3d28]",
};

const inputWrap = "flex items-center bg-surface border border-line rounded-full px-4 gap-2.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
const inputBase = "flex-1 bg-transparent border-none outline-none text-fg text-[0.92rem] py-3 font-[inherit] placeholder:text-muted";

export default function LoginPage() {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [toast, setToast]       = useState({ msg: "", type: "" });
  const [busy, setBusy]         = useState(false);

  const { currentUser, signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  // After auth resolves, route new users to profile setup, existing users to dashboard
  useEffect(() => {
    if (!currentUser) return;
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem(`tg_profile_${currentUser.uid}`)) ?? {}; } catch { return {}; }
    })();
    if (stored.userId && Number(stored.userId) > 0) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/profile", { replace: true });
    }
  }, [currentUser, navigate]);

  const showToast = (msg, type = "loading") => setToast({ msg, type });
  const clearToast = () => setToast({ msg: "", type: "" });

  async function handleSubmit() {
    if (!email || !password) { showToast("Please fill in all fields.", "error"); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        showToast("Signing in...", "loading");
        await signInWithEmail(email, password);
      } else {
        showToast("Creating account...", "loading");
        await registerWithEmail(email, password);
      }
    } catch (err) {
      showToast(friendlyError(err.code), "error");
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    showToast("Opening Google sign-in...", "loading");
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast(friendlyError(err.code), "error");
      setBusy(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!email) { showToast("Enter your email above first.", "error"); return; }
    if (!auth) { showToast("Firebase not configured.", "error"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Reset email sent — check your inbox.", "success");
    } catch (err) {
      showToast(friendlyError(err.code), "error");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-[1]">
      <Link to="/" className="flex items-center gap-1.5 text-sm text-muted no-underline hover:text-fg transition-colors mb-6 self-start absolute top-6 left-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back
      </Link>

      <div className="flex items-center gap-2 text-[1.1rem] font-bold tracking-[0.12em] uppercase text-primary mb-5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </div>

      <div className="bg-card border border-line rounded-[20px] p-8 w-full max-w-[380px]">
        {toast.msg && (
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm mb-5 ${toastStyle[toast.type] ?? toastStyle.loading}`}>
            {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "⟳"} {toast.msg}
          </div>
        )}

        <div className="grid grid-cols-2 bg-surface rounded-full p-1 mb-7">
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); clearToast(); }}
              className={`rounded-full py-2.5 text-[0.95rem] font-semibold cursor-pointer border-none transition-all ${
                mode === m ? "bg-primary text-bg" : "bg-transparent text-muted"
              }`}
            >
              {m === "login" ? "Log In" : "Register"}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono">Email Address</label>
          <div className={inputWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              className={inputBase}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[0.82rem] font-semibold tracking-[0.04em] text-fg mb-1.5 font-mono">Password</label>
          <div className={inputWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="bg-transparent border-none cursor-pointer text-muted p-0 flex transition-colors hover:text-fg"
            >
              {showPw ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
        </div>

        {mode === "login" && (
          <div className="flex items-center justify-between mb-5">
            <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer select-none">
              <input type="checkbox" className="accent-primary w-4 h-4 cursor-pointer" />
              Remember me
            </label>
            <a href="#" className="text-sm text-link no-underline hover:underline" onClick={handleForgot}>
              Forgot password?
            </a>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full py-3 px-4 bg-primary text-bg rounded-full text-[0.95rem] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:[transform:none] border-none mb-5"
        >
          {mode === "login" ? "Sign In" : "Create Account"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-line" />
          <span className="text-xs text-primary font-medium whitespace-nowrap">Or continue with</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 px-4 bg-transparent border border-line rounded-full text-[0.9rem] font-semibold text-fg cursor-pointer flex items-center justify-center gap-2.5 transition-colors hover:border-primary hover:bg-primary/[0.18] disabled:opacity-45"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
