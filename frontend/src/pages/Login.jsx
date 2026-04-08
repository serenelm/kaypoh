import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#f7f4ef" }}>
      {/* Logo */}
      <Link to="/" className="font-serif text-3xl text-gray-900 tracking-tight mb-10">
        Kay<span className="text-kaypoh">poh</span>
      </Link>

      <div
        className="w-full max-w-sm p-8"
        style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "16px" }}
      >
        <h1 className="font-serif text-2xl text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-400 mb-6">Access your check history and voting</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-kaypoh transition-colors"
              placeholder="serene"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-kaypoh transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-kaypoh font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-kaypoh text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-2">Demo accounts</p>
          <div className="flex gap-2 justify-center">
            {[
              { username: "serene", password: "kaypoh123", label: "serene / kaypoh123" },
              { username: "admin", password: "kaypoh123", label: "admin / kaypoh123" },
            ].map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Link to="/" className="mt-6 text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ← Back to Kaypoh
      </Link>
    </div>
  );
}
