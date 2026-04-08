import { useState, useEffect } from "react";
import Nav from "../components/Nav";
import { useAuth, authHeader } from "../context/auth";

const VERDICT_COLORS = {
  accurate:   { pill: "bg-green-100 text-green-800" },
  misleading: { pill: "bg-red-100 text-kaypoh" },
  unverified: { pill: "bg-amber-100 text-amber-800" },
};

const PLATFORM_COLORS = {
  whatsapp:  "#25D366",
  tiktok:    "#000000",
  facebook:  "#1877F2",
  instagram: "#E1306C",
};

const CATEGORY_COLORS = {
  health:                   "#f87171",
  financial:                "#34d399",
  racial:                   "#a78bfa",
  political:                "#60a5fa",
  government_impersonation: "#fb923c",
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

export default function ResearcherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/researcher/overview", { headers: authHeader(user) })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError("Failed to load researcher data"))
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

  const { heatmap, disputed, platform_accuracy, claim_clusters, demographic_index, trend, recent_submissions } = data;

  const allCats = Array.from(new Set([
    ...Object.keys(heatmap.this_week),
    ...Object.keys(heatmap.last_week),
  ]));
  const maxHeatCount = Math.max(
    ...Object.values(heatmap.this_week),
    ...Object.values(heatmap.last_week),
    1
  );

  const trendUp = trend.change > 0;
  const trendFlat = trend.change === 0;

  return (
    <div className="min-h-screen bg-cream">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 pt-20 pb-20">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold tracking-widest uppercase text-kaypoh">Admin View</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              Restricted
            </span>
          </div>
          <h1 className="font-serif text-3xl text-gray-900">Singapore Misinformation Intelligence</h1>
          <p className="text-sm text-gray-400 mt-1">Full analytics · Admin clearance only</p>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-xl">
            This dashboard aggregates anonymised data from all Kaypoh user submissions to help researchers,
            government agencies, and journalists identify misinformation trends across Singapore in real time.
          </p>
        </div>

        {/* Trend comparison banner */}
        <div
          className="p-5 rounded-2xl mb-6 flex items-center gap-4"
          style={{ background: trendUp ? "#fcebeb" : "#eaf3de", border: `1px solid ${trendUp ? "#f5c6c6" : "#c6e2b0"}` }}
        >
          <span className="text-3xl">{trendFlat ? "→" : trendUp ? "↑" : "↓"}</span>
          <div>
            <p className="font-serif text-lg" style={{ color: trendUp ? "#a32d2d" : "#3b6d11" }}>
              {trendFlat
                ? "Misleading rate unchanged from last week"
                : trendUp
                ? `Misleading rate increased by ${Math.abs(trend.change)}% this week compared to last week`
                : `Misleading rate decreased by ${Math.abs(trend.change)}% this week compared to last week`}
            </p>
            <p className="text-sm mt-0.5" style={{ color: trendUp ? "#c0392b" : "#3b6d11" }}>
              This week: <strong>{trend.this_week_pct}%</strong> · Last week: <strong>{trend.last_week_pct}%</strong>
            </p>
          </div>
        </div>

        {/* Misinformation heatmap */}
        <GridCard title="Misinformation Heatmap" subtitle="Harm categories — this week vs last week" className="mb-4">
          <div className="mt-4 space-y-4">
            {allCats.map((cat) => {
              const tw = heatmap.this_week[cat] ?? 0;
              const lw = heatmap.last_week[cat] ?? 0;
              const color = CATEGORY_COLORS[cat] ?? "#999";
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span className="capitalize font-medium text-gray-700">{cat.replace(/_/g, " ")}</span>
                    <span>
                      <span className="font-semibold text-gray-900">{tw}</span>
                      <span className="text-gray-400"> this · </span>
                      <span className="text-gray-500">{lw} last</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">This week</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${(tw / maxHeatCount) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 shrink-0">Last week</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full opacity-40" style={{ backgroundColor: color, width: `${(lw / maxHeatCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GridCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Claim clustering */}
          <GridCard title="Claim Clusters" subtitle="Similar text submissions this week">
            {claim_clusters.length === 0 ? (
              <p className="text-sm text-gray-400 mt-4">No clusters yet — needs text submissions</p>
            ) : (
              <ul className="space-y-4 mt-4">
                {claim_clusters.map((cluster, i) => {
                  const total = Object.values(cluster.verdicts).reduce((a, b) => a + b, 0);
                  return (
                    <li key={i}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium text-gray-800 capitalize">{cluster.topic}</p>
                        <span className="text-xs text-gray-400 shrink-0">{cluster.count} submissions</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(cluster.verdicts).map(([v, c]) => {
                          const vc = VERDICT_COLORS[v];
                          return (
                            <span key={v} className={`text-xs px-2 py-0.5 rounded-full font-medium ${vc?.pill ?? "bg-gray-100 text-gray-600"}`}>
                              {c} {v}
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GridCard>

          {/* Demographic vulnerability index */}
          <GridCard title="Demographic Vulnerability" subtitle="Most at-risk groups this week">
            {demographic_index.length === 0 ? (
              <p className="text-sm text-gray-400 mt-4">No data yet</p>
            ) : (
              <ul className="space-y-2.5 mt-4">
                {demographic_index.map(({ group, count }, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 truncate">{group}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: "#faeeda", color: "#854f0b" }}
                    >
                      {count}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GridCard>
        </div>

        {/* Platform spread accuracy */}
        <GridCard title="Platform Spread Accuracy" subtitle="AI prediction vs user-reported tags" className="mb-4">
          <div className="mt-4 space-y-5">
            {platform_accuracy.map(({ platform, ai_predicted_pct, user_reported_pct, user_reported_count }) => {
              const color = PLATFORM_COLORS[platform] ?? "#999";
              return (
                <div key={platform}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-gray-800 capitalize">{platform}</span>
                    <span className="text-xs text-gray-400 ml-auto">{user_reported_count} reports</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 shrink-0">AI predicted</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full opacity-50" style={{ backgroundColor: color, width: `${ai_predicted_pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-8 text-right">{ai_predicted_pct}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 shrink-0">User reported</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${user_reported_pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 w-8 text-right">{user_reported_pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GridCard>

        {/* Community disputed verdicts */}
        <GridCard title="Community Disputed Verdicts" subtitle="Submissions where users strongly disagree with AI" className="mb-4">
          {disputed.length === 0 ? (
            <p className="text-sm text-gray-400 mt-4">No disputed verdicts yet</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-50">
              {disputed.map((d) => {
                const vc = VERDICT_COLORS[d.verdict];
                return (
                  <li key={d.submission_id} className="py-4">
                    <p className="text-sm text-gray-700 leading-relaxed mb-2 line-clamp-2">
                      {d.input_value}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${vc?.pill ?? "bg-gray-100 text-gray-500"}`}>
                        AI: {d.verdict}
                      </span>
                      <span className="text-xs text-green-600 font-medium">👍 {d.agree} agreed</span>
                      <span className="text-xs text-kaypoh font-medium">👎 {d.disagree} disagreed</span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        ⚡ Disputed
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GridCard>

        {/* Full recent submissions feed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="font-serif text-lg text-gray-900">Full Submissions Feed</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 20 · Admin clearance</p>
          </div>
          {recent_submissions.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">No submissions yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recent_submissions.map((row) => {
                const vc = VERDICT_COLORS[row.verdict];
                const sevStyle = SEVERITY_STYLES[row.harm_severity] ?? SEVERITY_STYLES.medium;
                return (
                  <li key={row.id} className="px-6 py-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-400 mb-0.5 capitalize">
                          {row.input_type} · {row.harm_category?.replace(/_/g, " ")} · {timeAgo(row.created_at)}
                          {row.user_identifier && (
                            <span className="ml-1 text-gray-300">· {row.user_identifier}</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{row.input_value}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${vc?.pill ?? "bg-gray-100 text-gray-600"}`}>
                          {row.verdict}
                        </span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: sevStyle.bg, color: sevStyle.color }}
                        >
                          {row.harm_severity}
                        </span>
                      </div>
                    </div>
                    {row.platform_tag && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[row.platform_tag] ?? "#999"}20`,
                          color: PLATFORM_COLORS[row.platform_tag] ?? "#999",
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[row.platform_tag] ?? "#999" }} />
                        {row.platform_tag}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </main>
    </div>
  );
}

function GridCard({ title, subtitle, children, className }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm ${className ?? ""}`}>
      <h2 className="font-serif text-lg text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  );
}
