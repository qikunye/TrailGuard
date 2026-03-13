import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import LoadingSpinner from "../shared/LoadingSpinner.jsx";

export default function ProtectedRoute() {
  const { currentUser } = useAuth();

  if (currentUser === undefined) return <LoadingSpinner />;
  if (!currentUser) return <Navigate to="/login" replace />;

  return <Outlet />;
}
