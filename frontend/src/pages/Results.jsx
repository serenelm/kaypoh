import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Nav from "../components/Nav";
import { useAuth } from "../context/auth";
import { authHeader } from "../context/auth";

// ─── helpers ────────────────────────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renders inline **bold** markers as <strong> elements and strips orphaned asterisks. */
function renderInline(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-gray-900">{part}</strong>
      : part.replace(/\*/g, "")  // Strip any remaining orphaned asterisks
  );
}

/** Splits raw explanation text into typed segments for structured rendering. */
function parseExplanationSegments(raw) {
  const text = raw.replace(/#{1,6}\s*/g, "").trim();
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const segments = [];
  let proseBuf = [];

  const flushProse = () => {
    if (!proseBuf.length) return;
    segments.push({ type: "prose", lines: [...proseBuf] });
    proseBuf = [];
  };

  for (const line of lines) {
    // Numbered point: "1. Title: body" or "1. Text"
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      flushProse();
      const body = numMatch[2];
      const colonIdx = body.indexOf(":");
      if (colonIdx > 0 && colonIdx < 60) {
        segments.push({
          type: "numbered",
          num: parseInt(numMatch[1]),
          title: body.slice(0, colonIdx).trim(),
          text: body.slice(colonIdx + 1).trim(),
        });
      } else {
        segments.push({ type: "numbered", num: parseInt(numMatch[1]), title: null, text: body });
      }
      continue;
    }

    // Official guidance block
    if (/^(official|moh|gov|ministry|according to|source:|sources?:)/i.test(line)) {
      flushProse();
      segments.push({ type: "official", text: line });
      continue;
    }

    proseBuf.push(line);
  }
  flushProse();

  // If no numbered items found but text has "1." inline, fall back to inline split
  if (!segments.some((s) => s.type === "numbered") && /\b1\.\s/.test(text)) {
    const parts = text.split(/(?=\b\d+\.\s)/).filter((s) => s.trim());
    const fallback = [];
    let intro = "";
    for (const part of parts) {
      if (/^\d+\.\s/.test(part.trim())) {
        const body = part.trim().replace(/^\d+\.\s*/, "").trim();
        const num = parseInt(part.trim());
        const colonIdx = body.indexOf(":");
        if (colonIdx > 0 && colonIdx < 60) {
          fallback.push({ type: "numbered", num: fallback.length + 1, title: body.slice(0, colonIdx).trim(), text: body.slice(colonIdx + 1).trim() });
        } else {
          fallback.push({ type: "numbered", num: fallback.length + 1, title: null, text: body });
        }
      } else {
        intro = part.trim();
      }
    }
    if (fallback.length) {
      const result = [];
      if (intro) result.push({ type: "prose", lines: [intro] });
      return [...result, ...fallback];
    }
  }

  return segments;
}

function renderExplanation(raw) {
  const segments = parseExplanationSegments(raw);

  // Group consecutive numbered items
  const grouped = [];
  let numBuf = [];
  for (const seg of segments) {
    if (seg.type === "numbered") {
      numBuf.push(seg);
    } else {
      if (numBuf.length) { grouped.push({ type: "numbered-list", items: numBuf }); numBuf = []; }
      grouped.push(seg);
    }
  }
  if (numBuf.length) grouped.push({ type: "numbered-list", items: numBuf });

  // Collect consecutive official lines
  const final = [];
  let offBuf = [];
  for (const seg of grouped) {
    if (seg.type === "official") {
      offBuf.push(seg.text);
    } else {
      if (offBuf.length) { final.push({ type: "official-block", lines: offBuf }); offBuf = []; }
      final.push(seg);
    }
  }
  if (offBuf.length) final.push({ type: "official-block", lines: offBuf });

  return (
    <div className="space-y-4">
      {final.map((seg, i) => {
        if (seg.type === "prose") {
          const sentences = seg.lines.join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
          const paras = [];
          for (let j = 0; j < sentences.length; j += 3)
            paras.push(sentences.slice(j, j + 3).join(" "));
          return (
            <div key={i} className="space-y-3">
              {paras.map((p, j) => (
                <p key={j} className="text-sm text-gray-700 leading-relaxed">{renderInline(p)}</p>
              ))}
            </div>
          );
        }

        if (seg.type === "numbered-list") {
          return (
            <div key={i} className="space-y-0 divide-y divide-gray-100 rounded-xl overflow-hidden border border-gray-100">
              {seg.items.map((item, j) => (
                <div key={j} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                    style={{ backgroundColor: "#c0392b", minWidth: "1.25rem" }}
                  >
                    {item.num}
                  </span>
                  <div className="min-w-0">
                    {item.title && (
                      <p className="text-sm font-semibold text-gray-900 mb-0.5">{renderInline(item.title)}</p>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed">{renderInline(item.text)}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (seg.type === "official-block") {
          return (
            <div
              key={i}
              className="rounded-xl px-4 py-3"
              style={{ background: "#faeeda", borderLeft: "3px solid #f0c040" }}
            >
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-1.5">
                Official Sources
              </p>
              {seg.lines.map((line, j) => (
                <p key={j} className="text-sm text-amber-900 leading-relaxed">{renderInline(line)}</p>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

// ─── config ─────────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  accurate: {
    pill: "bg-green-100 text-green-800",
    title: "No issues found",
  },
  misleading: {
    pill: "bg-red-100 text-kaypoh",
    title: "This content is misleading",
  },
  unverified: {
    pill: "bg-amber-100 text-amber-800",
    title: "Could not verify this",
  },
};

const CONFIDENCE_COLORS = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-500",
};

const SEVERITY_STYLES = {
  low:      { bg: "#eaf3de", color: "#3b6d11" },
  medium:   { bg: "#faeeda", color: "#854f0b" },
  high:     { bg: "#fcebeb", color: "#a32d2d" },
  critical: { bg: "#fcebeb", color: "#c0392b" },
};

const PLATFORM_META = {
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  tiktok:   { label: "TikTok",   color: "#000000" },
  facebook: { label: "Facebook", color: "#1877F2" },
};

const LANG_TABS = [
  { key: "en", label: "EN" },
  { key: "zh", label: "中文" },
  { key: "ms", label: "BM" },
  { key: "ta", label: "தமிழ்" },
];

const PLATFORM_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { value: "tiktok",   label: "TikTok",   color: "#000000" },
  { value: "facebook", label: "Facebook", color: "#1877F2" },
  { value: "instagram", label: "Instagram", color: "#E1306C" },
  { value: "other",    label: "Other",    color: "#999999" },
];

// ─── page ────────────────────────────────────────────────────────────────────

export default function Results() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [langTab, setLangTab] = useState("en");
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [showMoreConsequences, setShowMoreConsequences] = useState(false);

  // Voting state
  const [votes, setVotes] = useState(null);
  const [votingLoading, setVotingLoading] = useState(false);

  // Platform tagging state
  const [selectedPlatform, setSelectedPlatform] = useState(
    state?.result?.platform_tag ?? null
  );
  const [platformSaving, setPlatformSaving] = useState(false);

  // Viral spread state
  const [spread, setSpread] = useState(null);

  const submissionId = state?.result?.submission_id;

  // Load existing vote tally + platform spread on mount
  useEffect(() => {
    if (!submissionId) return;
    fetch(`/api/submission/${submissionId}/votes`)
      .then((r) => r.json())
      .then(setVotes)
      .catch(() => {});
    fetch(`/api/submission/${submissionId}/platform-spread`)
      .then((r) => r.json())
      .then(setSpread)
      .catch(() => {});
  }, [submissionId]);

  if (!state?.result) {
    navigate("/");
    return null;
  }

  const { result } = state;
  const vc = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.unverified;
  const isCrisis = result.harm_severity === "critical";

  const cleanExplanation = stripMarkdown(result.explanation);
  const explanationSentences = splitSentences(cleanExplanation);
  const shortExplanation = explanationSentences.slice(0, 3).join(" ");
  const hasMoreExplanation = explanationSentences.length > 3;

  const consequenceSentences = splitSentences(result.consequence_mapping);
  const visibleConsequences = showMoreConsequences
    ? consequenceSentences
    : consequenceSentences.slice(0, 3);
  const hasMoreConsequences = consequenceSentences.length > 3;

  const demographicPills = Array.isArray(result.demographic_vulnerability)
    ? result.demographic_vulnerability
    : [];

  const sevStyle = SEVERITY_STYLES[result.harm_severity] ?? SEVERITY_STYLES.medium;

  async function castVote(vote) {
    if (!user) { navigate("/login"); return; }
    setVotingLoading(true);
    try {
      const res = await fetch(`/api/submission/${submissionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(user) },
        body: JSON.stringify({ vote }),
      });
      if (res.ok) setVotes(await res.json());
    } catch {}
    setVotingLoading(false);
  }

  async function tagPlatform(platform) {
    if (selectedPlatform === platform) return;
    setPlatformSaving(true);
    setSelectedPlatform(platform);
    try {
      await fetch(`/api/submission/${submissionId}/platform`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(user) },
        body: JSON.stringify({ platform }),
      });
      // Refresh spread counts after tagging
      const r = await fetch(`/api/submission/${submissionId}/platform-spread`);
      if (r.ok) setSpread(await r.json());
    } catch {}
    setPlatformSaving(false);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f4ef" }}>
      <Nav back />

      {isCrisis && (
        <div className="fixed top-14 inset-x-0 z-10 bg-kaypoh text-white px-6 py-3 text-sm font-medium text-center">
          ⚠️ Critical harm risk — do not share this content
        </div>
      )}

      <main
        className={`max-w-2xl mx-auto px-6 pb-20 space-y-4 ${isCrisis ? "pt-28" : "pt-20"}`}
      >
        {/* ── Similar claims banner ── */}
        {result.similar_claims_count > 0 && (
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{ background: "#faeeda", border: "1px solid #f0d8b0", borderRadius: "10px" }}
          >
            <span className="text-amber-700 text-lg">🔁</span>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{result.similar_claims_count}</span> other{" "}
              {result.similar_claims_count === 1 ? "person" : "people"} checked similar claims
              {result.similar_claims_topic ? (
                <> about <span className="font-medium">"{result.similar_claims_topic}"</span></>
              ) : null}
            </p>
          </div>
        )}

        {/* ── Verdict card ── */}
        <div
          className="p-6"
          style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "12px" }}
        >
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest ${vc.pill}`}>
                {result.verdict}
              </span>
              {votes?.is_disputed && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 uppercase tracking-widest">
                  ⚡ Disputed
                </span>
              )}
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${CONFIDENCE_COLORS[result.confidence]}`}>
              {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence
            </span>
          </div>

          <h1 className="font-serif text-2xl text-gray-900 mb-3">{vc.title}</h1>

          <div
            style={{
              overflow: "hidden",
              transition: "max-height 0.35s ease",
              maxHeight: showFullExplanation ? "9999px" : "6rem",
            }}
          >
            {showFullExplanation
              ? <div className="max-w-prose">{renderExplanation(result.explanation)}</div>
              : <p className="text-gray-700 leading-relaxed text-sm">{shortExplanation}</p>
            }
          </div>
          {hasMoreExplanation && (
            <button
              onClick={() => setShowFullExplanation((v) => !v)}
              className="mt-3 text-xs font-medium text-kaypoh hover:underline flex items-center gap-1"
            >
              {showFullExplanation ? "Show less ↑" : "Read more ↓"}
            </button>
          )}

          {result.sources?.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Sources
              </p>
              <ul className="space-y-1.5">
                {result.sources.map((s, i) => (
                  <li key={i} className="text-xs text-gray-500 break-all leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Community vote ── */}
          {submissionId && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Do you agree with this verdict?
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => castVote("agree")}
                  disabled={votingLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 border-green-200 text-green-700 hover:bg-green-50"
                >
                  <span>👍</span>
                  <span>Yes</span>
                </button>
                <button
                  onClick={() => castVote("disagree")}
                  disabled={votingLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 border-red-200 text-kaypoh hover:bg-red-50"
                >
                  <span>👎</span>
                  <span>No</span>
                </button>
                {!user && (
                  <Link to="/login" className="text-xs text-gray-400 hover:text-kaypoh transition-colors">
                    Sign in to vote
                  </Link>
                )}
              </div>
              {votes && (votes.agree > 0 || votes.disagree > 0) && (
                <p className="text-xs text-gray-400 mt-2.5">
                  <span className="text-green-600 font-medium">{votes.agree} agreed</span>
                  {" · "}
                  <span className="text-kaypoh font-medium">{votes.disagree} disagreed</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Platform tagging ── */}
        {submissionId && (
          <div
            className="px-6 py-5"
            style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "12px" }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Where did you see this?
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const isActive = selectedPlatform === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => tagPlatform(p.value)}
                    disabled={platformSaving}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50"
                    style={{
                      borderColor: isActive ? p.color : "#e0dbd2",
                      backgroundColor: isActive ? `${p.color}15` : "transparent",
                      color: isActive ? p.color : "#6b7280",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Viral spread warning ── */}
        {spread?.viral_platform && (
          <div
            className="px-5 py-4 flex items-start gap-3"
            style={{ background: "#faeeda", border: "1px solid #f0c84a", borderRadius: "12px" }}
          >
            <span className="text-xl shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-0.5">
                Spreading on{" "}
                {PLATFORM_OPTIONS.find((p) => p.value === spread.viral_platform)?.label ?? spread.viral_platform}
              </p>
              <p className="text-sm text-amber-800">
                This content has been reported as seen on{" "}
                <span className="font-medium">
                  {PLATFORM_OPTIONS.find((p) => p.value === spread.viral_platform)?.label ?? spread.viral_platform}
                </span>{" "}
                by <span className="font-medium">{spread.viral_count} users</span>. Verify before sharing.
              </p>
            </div>
          </div>
        )}

        {/* ── Claims ── */}
        {result.claims?.length > 0 && (
          <Card>
            <SectionTitle>
              {result.claims.length} claim{result.claims.length !== 1 ? "s" : ""} extracted
            </SectionTitle>
            <ul className="space-y-3 mt-4">
              {result.claims.map((claim, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                  <span className="text-kaypoh font-bold shrink-0 mt-0.5">—</span>
                  <span>{stripMarkdown(claim)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ── Platform likelihood ── */}
        <Card>
          <SectionTitle>Platform spread likelihood</SectionTitle>
          <div className="space-y-4 mt-4">
            {Object.entries(result.platform_likelihood).map(([key, pct]) => {
              const meta = PLATFORM_META[key] ?? { label: key, color: "#999" };
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span
                        className="inline-block rounded-full shrink-0"
                        style={{ width: 6, height: 6, backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </span>
                    <span className="font-semibold text-gray-900">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ backgroundColor: "#c0392b", width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Harm assessment ── */}
        <Card>
          <SectionTitle>Harm assessment</SectionTitle>

          <div className="flex flex-wrap gap-2 mt-4 mb-6">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
              style={{ backgroundColor: sevStyle.bg, color: sevStyle.color }}
            >
              {result.harm_severity} severity
            </span>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
              style={{ backgroundColor: "#fce8e6", color: "#c0392b" }}
            >
              {result.harm_category.replace(/_/g, " ")}
            </span>
          </div>

          <div className="pl-4 mb-5" style={{ borderLeft: "3px solid #f0c040" }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
              Demographics at risk
            </p>
            <div className="flex flex-wrap gap-2">
              {demographicPills.map((d, i) => (
                <span
                  key={i}
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#faeeda", color: "#854f0b" }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="pl-4" style={{ borderLeft: "3px solid #c0392b" }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
              Real-world consequences
            </p>
            <ul className="space-y-2">
              {visibleConsequences.map((sentence, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "#c0392b" }}
                  />
                  <span>{stripMarkdown(sentence)}</span>
                </li>
              ))}
            </ul>
            {hasMoreConsequences && (
              <button
                onClick={() => setShowMoreConsequences((v) => !v)}
                className="mt-2.5 text-xs font-medium text-kaypoh hover:underline"
              >
                {showMoreConsequences ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </Card>

        {/* ── Multilingual summaries ── */}
        {result.multilingual_summaries && Object.keys(result.multilingual_summaries).length > 0 ? (
          <Card>
            <SectionTitle>Summary in Singapore's languages</SectionTitle>
            <div className="flex mt-4 border-b border-gray-100">
              {LANG_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setLangTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    langTab === tab.key
                      ? "border-kaypoh text-kaypoh"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mt-4">
              {result.multilingual_summaries[langTab] || "Not available in this language"}
            </p>
          </Card>
        ) : (
          <Card>
            <SectionTitle>Summary in Singapore's languages</SectionTitle>
            <p className="text-sm text-gray-500 italic mt-4">Language summaries could not be generated. Check backend logs for details.</p>
          </Card>
        )}
      </main>
    </div>
  );
}

// ─── shared components ────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div
      className="p-6"
      style={{ background: "#fff", border: "1px solid #e0dbd2", borderRadius: "12px" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="font-serif text-lg text-gray-900">{children}</h2>;
}
