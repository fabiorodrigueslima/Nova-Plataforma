import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoutes() {
  const location = useLocation();
  const { autenticado, carregando } = useAuth();

  if (carregando) {
    return (
      <main className="route-loading" aria-live="polite" aria-busy="true">
        <span className="route-loading-spinner" aria-hidden="true" />
        <p>Carregando sua sessão...</p>
      </main>
    );
  }

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
