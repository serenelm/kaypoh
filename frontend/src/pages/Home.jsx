import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import { useAuth, authHeader } from "../context/auth";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState("url");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const body = mode === "url" ? { url: input.trim() } : { text: input.trim() };
      const res = await fetch("/api/fact-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(user) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong");
      }
      const result = await res.json();
      navigate("/results", {
        state: { result, inputType: mode, inputValue: input.trim() },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const total = stats?.total_submissions ?? 0;
  const dist = stats?.verdict_distribution ?? {};
  const misleadingRate =
    total > 0 ? Math.round(((dist.misleading || 0) / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-cream">
      <Nav />

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-36">
        {/* Eyebrow */}
        <p className="text-xs font-semibold tracking-widest uppercase text-kaypoh mb-5">
          Singapore's Fact-Checking Platform
        </p>

        {/* Headline */}
        <h1 className="font-serif text-5xl md:text-6xl leading-tight text-gray-900 mb-6">
          Don't anyhow share.
          <br />
          <span className="text-kaypoh">Check first.</span>
        </h1>

        <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-lg">
          Paste a URL or a claim. Kaypoh verifies it against trusted Singapore
          sources, assesses the harm, and explains it in four languages.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit mb-6">
          {[
            { id: "url", label: "Paste URL" },
            { id: "text", label: "Paste Text" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setMode(id);
                setInput("");
                setError(null);
              }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                mode === id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "url" ? (
            <input
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://mothership.sg/2024/..."
              className="w-full border border-gray-200 rounded-xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kaypoh/20 focus:border-kaypoh text-base bg-white shadow-sm"
            />
          ) : (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              placeholder="Paste the WhatsApp message, social media post, or claim you want to check…"
              className="w-full border border-gray-200 rounded-xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kaypoh/20 focus:border-kaypoh text-base bg-white shadow-sm resize-none"
            />
          )}

          {error && (
            <p className="text-kaypoh text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full bg-kaypoh text-white py-4 rounded-xl font-semibold text-base hover:bg-red-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking…
              </span>
            ) : (
              "Check this →"
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            {mode === "url"
              ? "Works best with Singapore news articles and social media posts"
              : "Works best with forwarded WhatsApp messages and viral claims"}
          </p>
        </form>
      </main>

      {/* Stats bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex justify-around items-center">
          <StatItem
            value={total > 0 ? total.toLocaleString() : "—"}
            label="Total checks"
          />
          <div className="w-px h-8 bg-gray-200" />
          <StatItem
            value={total > 0 ? `${misleadingRate}%` : "—"}
            label="Misleading rate"
          />
          <div className="w-px h-8 bg-gray-200" />
          <StatItem value="4" label="Languages supported" />
        </div>
      </div>
    </div>
  );
}

function StatItem({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold text-gray-900 font-serif">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
