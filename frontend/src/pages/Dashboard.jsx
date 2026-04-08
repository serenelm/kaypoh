import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import { useAuth, authHeader } from "../context/auth";

const VERDICT_COLORS = {
  accurate:   { pill: "bg-green-100 text-green-800", bar: "bg-green-500" },
  misleading: { pill: "bg-red-100 text-kaypoh",     bar: "bg-kaypoh" },
  unverified: { pill: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
};

const SEVERITY_STYLES = {
  low:      { bg: "#eaf3de", color: "#3b6d11" },
  medium:   { bg: "#faeeda", color: "#854f0b" },
  high:     { bg: "#fcebeb", color: "#a32d2d" },
  critical: { bg: "#fcebeb", color: "#c0392b" },
};

const CATEGORY_COLORS = {
  health:                  "#f87171",
  financial:               "#34d399",
  racial:                  "#a78bfa",
  political:               "#60a5fa",
  government_impersonation:"#fb923c",
};

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetch("/api/user/stats", { headers: authHeader(user) })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError("Failed to load your stats"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-kaypoh/30 border-t-kaypoh rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="text-kaypoh text-sm">{error}</p>
    </div>
  );

  const {
    total_submissions,
    verdict_breakdown,
    contribution_score,
    votes_cast,
    platform_tags,
    recent_checks,
    week_in_singapore,
    most_checked_topics,
    community_activity,
  } = data;

  const maxTopic = Math.max(...(most_checked_topics.map((t) => t.count) || [1]), 1);

  return (
    <div className="min-h-screen bg-cream">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-20">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-kaypoh mb-2">My Dashboard</p>
          <h1 className="font-serif text-3xl text-gray-900">
            Welcome back, {user?.username}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Your fact-checking activity at a glance</p>
        </div>

        {/* Personal stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard value={total_submissions} label="Checks done" accent="text-gray-900" />
          <StatCard value={contribution_score} label="Contribution score" accent="text-kaypoh" />
          <StatCard
            value={total_submissions > 0
              ? `${Math.round((verdict_breakdown.misleading / total_submissions) * 100)}%`
              : "—"}
            label="Misleading found"
            accent="text-kaypoh"
          />
        </div>

        {/* Contribution breakdown */}
        <Card className="mb-4">
          <SectionTitle>Your contributions</SectionTitle>
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="font-serif text-2xl text-gray-900">{votes_cast}</p>
              <p className="text-xs text-gray-400 mt-0.5">Votes cast</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="font-serif text-2xl text-gray-900">{platform_tags}</p>
              <p className="text-xs text-gray-400 mt-0.5">Platforms tagged</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center flex-1">
              <div className="flex gap-2 justify-center flex-wrap">
                {Object.entries(verdict_breakdown).map(([v, c]) => {
                  const vc = VERDICT_COLORS[v];
                  return c > 0 ? (
                    <span key={v} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${vc.pill}`}>
                      {c} {v}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Verdict breakdown</p>
            </div>
          </div>
        </Card>

        {/* Recent checks */}
        {recent_checks.length > 0 && (
          <Card className="mb-6">
            <SectionTitle>Your recent checks</SectionTitle>
            <ul className="mt-4 divide-y divide-gray-50">
              {recent_checks.map((r) => {
                const vc = VERDICT_COLORS[r.verdict];
                return (
                  <li key={r.id} className="py-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-1">
                        {r.input_value}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">
                        {r.harm_category?.replace(/_/g, " ")} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${vc?.pill ?? "bg-gray-100 text-gray-500"}`}>
                      {r.verdict}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Singapore insights</p>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Community activity */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard value={community_activity.checks_today} label="Checks today" accent="text-gray-900" small />
          <StatCard value={community_activity.votes_today} label="Votes today" accent="text-gray-900" small />
          <StatCard value={community_activity.platform_tags_today} label="Tags today" accent="text-gray-900" small />
        </div>

        {/* This week in Singapore */}
        {week_in_singapore.length > 0 && (
          <Card className="mb-4">
            <SectionTitle>This week in Singapore</SectionTitle>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Top harm categories from all submissions</p>
            <div className="space-y-3">
              {week_in_singapore.map(({ category, count }) => {
                const color = CATEGORY_COLORS[category.replace(/ /g, "_")] ?? "#999";
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-700 capitalize flex-1">{category}</span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Most checked topics */}
        {most_checked_topics.length > 0 && (
          <Card>
            <SectionTitle>Most checked claim topics</SectionTitle>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">From text submissions this week — no individual claims shown</p>
            <ul className="space-y-3">
              {most_checked_topics.map(({ topic, count }) => (
                <li key={topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{topic}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kaypoh rounded-full"
                      style={{ width: `${(count / maxTopic) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

      </main>
    </div>
  );
}

function StatCard({ value, label, accent, small }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className={`font-serif ${small ? "text-2xl" : "text-3xl"} font-semibold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 leading-snug">{label}</p>
    </div>
  );
}

function Card({ children, className }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="font-serif text-lg text-gray-900">{children}</h2>;
}
