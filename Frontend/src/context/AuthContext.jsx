import { createContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase/firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still loading, null = signed out, object = signed in
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — treat as signed out immediately
      setCurrentUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return unsubscribe;
  }, []);

  const signInWithGoogle = () => {
    if (!auth || !googleProvider) return Promise.reject(new Error("Firebase not configured"));
    return signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = (email, password) => {
    if (!auth) return Promise.reject(new Error("Firebase not configured"));
    return signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = (email, password) => {
    if (!auth) return Promise.reject(new Error("Firebase not configured"));
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => {
    if (!auth) return Promise.resolve();
    return fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, signInWithGoogle, signInWithEmail, registerWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
