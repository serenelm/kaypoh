import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";

export default function Nav({ back = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isResearcher = user?.role === "admin";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-20 bg-cream/90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        {back ? (
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Check another
          </Link>
        ) : (
          <Link to="/" className="font-serif text-xl text-gray-900 tracking-tight">
            Kay<span className="text-kaypoh">poh</span>
          </Link>
        )}

        <div className="flex items-center gap-1">
          {back && (
            <Link to="/" className="font-serif text-lg text-gray-900 tracking-tight mr-4">
              Kay<span className="text-kaypoh">poh</span>
            </Link>
          )}

          {!back && <NavLink to="/">Check</NavLink>}

          {user ? (
            <>
              <NavLink to="/dashboard">My Dashboard</NavLink>
              {isResearcher && (
                <NavLink to="/researcher-dashboard">
                  <span className="flex items-center gap-1">
                    Admin View
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">R</span>
                  </span>
                </NavLink>
              )}
              <NavLink to="/history">History</NavLink>
              <span className="px-3 py-1.5 text-sm text-gray-500 font-medium hidden sm:inline">
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {!back && <NavLink to="/dashboard">Dashboard</NavLink>}
              <NavLink to="/login">Sign in</NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-100"
    >
      {children}
    </Link>
  );
}
