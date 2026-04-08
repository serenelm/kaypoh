import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth";

export default function ResearcherRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
