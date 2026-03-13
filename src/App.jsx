import { AuthProvider } from "./context/AuthContext.jsx";
import { TrailProvider } from "./context/TrailContext.jsx";
import AppRouter from "./router/AppRouter.jsx";

export default function App() {
  return (
    <AuthProvider>
      <TrailProvider>
        <AppRouter />
      </TrailProvider>
    </AuthProvider>
  );
}
