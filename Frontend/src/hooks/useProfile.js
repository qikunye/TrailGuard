import { useAuth } from "./useAuth.js";

/**
 * Returns the current user's profile scoped to their Firebase UID,
 * so different users never share the same profile data.
 *
 * profile     – parsed object from localStorage (empty {} if not set)
 * saveProfile – writes the full profile object to the scoped key
 * profileKey  – the raw localStorage key (null when not signed in)
 * isSetup     – true when an OutSystems userId is present (profile complete)
 */
export function useProfile() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? null;
  const profileKey = uid ? `tg_profile_${uid}` : null;

  const profile = (() => {
    if (!profileKey) return {};
    try { return JSON.parse(localStorage.getItem(profileKey)) ?? {}; } catch { return {}; }
  })();

  function saveProfile(data) {
    if (!profileKey) return;
    localStorage.setItem(profileKey, JSON.stringify(data));
  }

  const isSetup = !!(profile.userId && Number(profile.userId) > 0);

  return { profile, saveProfile, profileKey, isSetup, uid };
}
