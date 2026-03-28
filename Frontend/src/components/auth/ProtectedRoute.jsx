import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useProfile } from "../../hooks/useProfile.js";
import LoadingSpinner from "../shared/LoadingSpinner.jsx";

export default function ProtectedRoute() {
  const { currentUser } = useAuth();
  const { isSetup } = useProfile();
  const location = useLocation();

  // Still resolving Firebase auth state
  if (currentUser === undefined) return <LoadingSpinner />;

  // Not signed in → landing page
  if (!currentUser) return <Navigate to="/" replace />;

  // Signed in but no OutSystems userId yet → must complete profile first.
  // Allow /profile itself to avoid an infinite redirect loop.
  if (!isSetup && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}
