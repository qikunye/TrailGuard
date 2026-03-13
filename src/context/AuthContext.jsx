import { createContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase/firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still loading, null = signed out, object = signed in
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return unsubscribe;
  }, []);

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
