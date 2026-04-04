import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute.jsx";

import LandingPage           from "../pages/LandingPage.jsx";
import LoginPage             from "../pages/LoginPage.jsx";
import DashboardPage         from "../pages/DashboardPage.jsx";
import TrailAssessmentPage   from "../pages/TrailAssessmentPage.jsx";
import AssessmentResultPage  from "../pages/AssessmentResultPage.jsx";
import EmergencyReportPage   from "../pages/EmergencyReportPage.jsx";
import EmergencyConfirmPage  from "../pages/EmergencyConfirmPage.jsx";
import HazardReportPage      from "../pages/HazardReportPage.jsx";
import AlternativeRoutePage  from "../pages/AlternativeRoutePage.jsx";
import ProfilePage           from "../pages/ProfilePage.jsx";
import TelegramSetupPage     from "../pages/TelegramSetupPage.jsx";
import TrailRegistrationPage from "../pages/TrailRegistrationPage.jsx";
import TrackHikePage         from "../pages/TrackHikePage.jsx";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — auth guard wraps all child routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard"                element={<DashboardPage />} />
          <Route path="/trail-assessment"         element={<TrailAssessmentPage />} />
          <Route path="/trail-assessment/result"  element={<AssessmentResultPage />} />
          <Route path="/emergency"                element={<EmergencyReportPage />} />
          <Route path="/emergency/confirm"        element={<EmergencyConfirmPage />} />
          <Route path="/hazard"                   element={<HazardReportPage />} />
          <Route path="/hazard/alternative"       element={<AlternativeRoutePage />} />
          <Route path="/profile"                  element={<ProfilePage />} />
          <Route path="/setup/telegram"           element={<TelegramSetupPage />} />
          <Route path="/register-trail"           element={<TrailRegistrationPage />} />
          <Route path="/track-hike"               element={<TrackHikePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
