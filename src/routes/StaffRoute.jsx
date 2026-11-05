import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Só a equipe (admin/moderador) vê o painel. O servidor também valida o papel
// em cada rota /admin, então esta guarda é apenas para a navegação.
export default function StaffRoute({ children }) {
  const { usuario } = useAuth();
  if (!["admin", "moderador"].includes(usuario?.papel)) {
    return <Navigate to="/feed" replace />;
  }
  return children;
}
