import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import { useAuth } from "../context/auth";
import { authHeader } from "../context/auth";

const VERDICT_COLORS = {
  accurate:   { pill: "bg-green-100 text-green-800" },
  misleading: { pill: "bg-red-100 text-kaypoh" },
  unverified: { pill: "bg-amber-100 text-amber-800" },
};

const SEVERITY_STYLES = {
  low:      { bg: "#eaf3de", color: "#3b6d11" },
  medium:   { bg: "#faeeda", color: "#854f0b" },
  high:     { bg: "#fcebeb", color: "#a32d2d" },
  critical: { bg: "#fcebeb", color: "#c0392b" },
};

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetch("/api/submission/history", {
      headers: { ...authHeader(user) },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      })
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  function replayResult(row) {
    if (!row.result_json) return;
    navigate("/results", {
      state: { result: { ...row.result_json, submission_id: row.id } },
    });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f4ef" }}>
      <Nav back />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-20">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-kaypoh mb-2">
            My Account
          </p>
          <h1 className="font-serif text-3xl text-gray-900">Check History</h1>
          <p className="text-sm text-gray-400 mt-1">
            Signed in as <span className="font-medium text-gray-600">{user?.username}</span>
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-kaypoh/30 border-t-kaypoh rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-kaypoh">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div
            className="p-12 text-center"
            style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "12px" }}
          >
            <p className="font-serif text-xl text-gray-400 mb-2">No checks yet</p>
            <p className="text-sm text-gray-400">
              Your fact-checks will appear here after you submit them while signed in.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "12px" }}
            className="divide-y divide-gray-50 overflow-hidden"
          >
            {rows.map((row) => {
              const vc = VERDICT_COLORS[row.verdict] ?? VERDICT_COLORS.unverified;
              const sevStyle = SEVERITY_STYLES[row.harm_severity] ?? SEVERITY_STYLES.medium;
              const canReplay = !!row.result_json;

              return (
                <div
                  key={row.id}
                  onClick={() => canReplay && replayResult(row)}
                  className={`px-6 py-4 flex items-start gap-4 ${canReplay ? "cursor-pointer hover:bg-gray-50" : ""} transition-colors`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 leading-relaxed line-clamp-2 mb-2">
                      {row.input_value}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${vc.pill}`}
                      >
                        {row.verdict}
                      </span>
                      {row.harm_severity && (
                        <span
                          className="text-xs font-medium px-2.5 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: sevStyle.bg, color: sevStyle.color }}
                        >
                          {row.harm_severity}
                        </span>
                      )}
                      {row.harm_category && (
                        <span className="text-xs text-gray-400 capitalize">
                          {row.harm_category.replace(/_/g, " ")}
                        </span>
                      )}
                      {row.platform_tag && (
                        <span className="text-xs text-gray-400 capitalize">
                          via {row.platform_tag}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-gray-400">{timeAgo(row.created_at)}</span>
                    {canReplay && (
                      <span className="text-xs text-kaypoh font-medium">View →</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
