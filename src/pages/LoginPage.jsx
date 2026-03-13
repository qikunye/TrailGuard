import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase/firebase.js";

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

export default function LoginPage() {
  const [mode, setMode]           = useState("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [toast, setToast]         = useState({ msg: "", type: "" });
  const [busy, setBusy]           = useState(false);

  const { currentUser, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate("/dashboard", { replace: true });
  }, [currentUser, navigate]);

  function showToast(msg, type = "loading") { setToast({ msg, type }); }
  function clearToast() { setToast({ msg: "", type: "" }); }

  async function handleSubmit() {
    if (!email || !password) { showToast("Please fill in all fields.", "error"); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        showToast("Signing in...", "loading");
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        showToast("Creating account...", "loading");
        await createUserWithEmailAndPassword(auth, email, password);
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
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Reset email sent — check your inbox.", "success");
    } catch (err) {
      showToast(friendlyError(err.code), "error");
    }
  }

  function switchMode(m) { setMode(m); clearToast(); }

  return (
    <div className="auth-layout">
      <div className="wordmark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 20l5-9 4 6 3-4 6 7"/><circle cx="17" cy="6" r="2"/>
        </svg>
        TrailGuard
      </div>

      <div className="card">
        {toast.msg && (
          <div className={`toast show ${toast.type}`}>
            {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "⟳"} {toast.msg}
          </div>
        )}

        {/* Tab toggle */}
        <div className="tab-toggle">
          <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>
            Log In
          </button>
          <button className={`tab ${mode === "register" ? "active" : ""}`} onClick={() => switchMode("register")}>
            Register
          </button>
        </div>

        {/* Email */}
        <div className="field">
          <label>Email Address</label>
          <div className="input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input type="email" placeholder="john@example.com" value={email}
              onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
        </div>

        {/* Password */}
        <div className="field">
          <label>Password</label>
          <div className="input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            <button className="eye-btn" type="button" onClick={() => setShowPw(p => !p)}>
              {showPw ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                  <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Remember me / Forgot — login only */}
        {mode === "login" && (
          <div className="row-meta">
            <label className="checkbox-label">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" className="link" onClick={handleForgot}>Forgot password?</a>
          </div>
        )}

        <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
          <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>

        <div className="divider"><span>Or continue with</span></div>

        <button className="btn-google" onClick={handleGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
