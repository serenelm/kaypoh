import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import ResearcherRoute from "./components/ResearcherRoute";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import ResearcherDashboard from "./pages/ResearcherDashboard";
import Login from "./pages/Login";
import History from "./pages/History";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/researcher-dashboard"
            element={
              <ResearcherRoute>
                <ResearcherDashboard />
              </ResearcherRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
