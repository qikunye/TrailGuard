import { auth, googleProvider } from "./firebase.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";

// --- Element refs ---
const toast        = document.getElementById("toast");
const panelAuth    = document.getElementById("panel-auth");
const panelSignedIn = document.getElementById("panel-signedin");
const tabLogin     = document.getElementById("tab-login");
const tabRegister  = document.getElementById("tab-register");
const emailInput   = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnEye       = document.getElementById("btn-eye");
const iconOpen     = document.getElementById("icon-eye-open");
const iconClosed   = document.getElementById("icon-eye-closed");
const rowMeta      = document.getElementById("row-meta");
const btnSubmit    = document.getElementById("btn-submit");
const btnLabel     = document.getElementById("btn-label");
const btnGoogle    = document.getElementById("btn-google");
const btnSignout   = document.getElementById("btn-signout");
const linkForgot   = document.getElementById("link-forgot");

let mode = "login"; // "login" | "register"

// --- Toast ---
function showToast(msg, type = "loading") {
  const icons = { error: "✕", success: "✓", loading: "⟳" };
  toast.textContent = `${icons[type] ?? ""} ${msg}`;
  toast.className = `toast show ${type}`;
}
function clearToast() {
  toast.className = "toast";
}

// --- Auth state ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    showSignedIn(user);
  } else {
    showAuthPanel();
  }
});

function showSignedIn(user) {
  panelAuth.classList.add("hide");
  panelSignedIn.classList.add("show");

  document.getElementById("user-name").textContent  = user.displayName || "Anonymous";
  document.getElementById("user-email").textContent = user.email;

  const avatarEl = document.getElementById("user-avatar");
  if (user.photoURL) {
    avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar" />`;
  } else {
    avatarEl.innerHTML = `<div class="avatar-placeholder">🧭</div>`;
  }

  showToast("Signed in successfully", "success");
}

function showAuthPanel() {
  panelAuth.classList.remove("hide");
  panelSignedIn.classList.remove("show");
  clearToast();
}

// --- Tab toggle ---
tabLogin.addEventListener("click", () => setMode("login"));
tabRegister.addEventListener("click", () => setMode("register"));

function setMode(m) {
  mode = m;
  tabLogin.classList.toggle("active", m === "login");
  tabRegister.classList.toggle("active", m === "register");
  btnLabel.textContent = m === "login" ? "Sign In" : "Create Account";
  rowMeta.style.display = m === "login" ? "" : "none";
  clearToast();
}

// --- Eye toggle ---
btnEye.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  iconOpen.style.display   = isPassword ? "none" : "";
  iconClosed.style.display = isPassword ? "" : "none";
});

// --- Submit (email/password) ---
btnSubmit.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

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
});

// --- Google ---
btnGoogle.addEventListener("click", async () => {
  setBusy(true);
  showToast("Opening Google sign-in...", "loading");
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    setBusy(false);
  }
});

// --- Sign out ---
btnSignout.addEventListener("click", async () => {
  await signOut(auth);
});

// --- Forgot password ---
linkForgot.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) {
    showToast("Enter your email above first", "error");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Reset email sent — check your inbox", "success");
  } catch (err) {
    showToast(friendlyError(err.code), "error");
  }
});

// --- Helpers ---
function setBusy(busy) {
  btnSubmit.disabled = busy;
  btnGoogle.disabled = busy;
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email":          "Invalid email address.",
    "auth/user-not-found":         "No account found for that email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/email-already-in-use":   "That email is already registered.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/popup-closed-by-user":   "Sign-in popup was closed.",
    "auth/unauthorized-domain":    "This domain isn't authorised in Firebase Console.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}
