import { useState, useEffect, useCallback } from 'react';
import DashboardContainer from '../components/Layout/DashboardContainer';

const LEVELS = [
  { key: 'all',      label: 'All' },
  { key: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
  { key: 'high',     label: 'High',     color: 'bg-orange-100 text-orange-800' },
  { key: 'medium',   label: 'Medium',   color: 'bg-gray-100 text-gray-700' },
];

function getCriticalityLabel(score) {
  if (score === null || score === undefined) return null;
  if (score >= 85) return { label: 'CRITICAL', cls: 'bg-red-500 text-white' };
  if (score >= 65) return { label: 'HIGH',     cls: 'bg-orange-500 text-white' };
  if (score >= 40) return { label: 'MEDIUM',   cls: 'bg-gray-500 text-white' };
  return null;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function HeadlineItem({ article }) {
  const badge = getCriticalityLabel(article.criticality_score);
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{article.title}</p>
          {article.criticality_reason && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.criticality_reason}</p>
          )}
          {!article.criticality_reason && article.criticality_score === null && (
            <p className="text-xs text-gray-400 mt-1 italic">Scoring…</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{article.source} · {timeAgo(article.published_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
          )}
          {article.criticality_score !== null && (
            <span className="text-xs text-gray-400 font-mono">{article.criticality_score}/100</span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function News() {
  const [articles, setArticles] = useState([]);
  const [level, setLevel]       = useState('all');
  const [search, setSearch]     = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading]     = useState(false);

  const fetchHeadlines = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/news/headlines?level=${level}&limit=50`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setArticles(data.articles || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch headlines:', e);
    } finally {
      setIsLoading(false);
    }
  }, [level]);

  useEffect(() => {
    fetchHeadlines();
    const id = setInterval(fetchHeadlines, 60_000);
    return () => clearInterval(id);
  }, [fetchHeadlines]);

  const filtered = search
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const sections = [
    { key: 'critical', label: 'CRITICAL', min: 85, cls: 'border-red-500 bg-red-50' },
    { key: 'high',     label: 'HIGH',     min: 65, max: 84, cls: 'border-orange-400 bg-orange-50' },
    { key: 'medium',   label: 'MEDIUM',   min: 40, max: 64, cls: 'border-gray-300 bg-gray-50' },
  ];

  const inSection = (a, s) => {
    if (a.criticality_score === null) return false;
    if (s.max !== undefined) return a.criticality_score >= s.min && a.criticality_score <= s.max;
    return a.criticality_score >= s.min;
  };

  const unscored = filtered.filter((a) => a.criticality_score === null);

  return (
    <DashboardContainer>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Headlines</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {lastUpdated ? `Last updated ${timeAgo(lastUpdated)}` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={fetchHeadlines}
            disabled={isLoading}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                level === l.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {l.label}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search headlines…"
            className="ml-auto text-sm border border-gray-300 rounded-md px-3 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Sections */}
        {sections.map((s) => {
          const items = filtered.filter((a) => inSection(a, s));
          if (!items.length) return null;
          return (
            <div key={s.key}>
              <div className={`text-xs font-bold tracking-widest text-gray-500 mb-2 uppercase`}>
                {s.label}
              </div>
              <div className="space-y-2">
                {items.map((a) => <HeadlineItem key={a.id} article={a} />)}
              </div>
            </div>
          );
        })}

        {/* Unscored */}
        {unscored.length > 0 && (
          <div>
            <div className="text-xs font-bold tracking-widest text-gray-400 mb-2 uppercase">Pending</div>
            <div className="space-y-2">
              {unscored.map((a) => <HeadlineItem key={a.id} article={a} />)}
            </div>
          </div>
        )}

        {!isLoading && !filtered.length && (
          <p className="text-sm text-gray-400 text-center py-12">No headlines found.</p>
        )}
      </div>
    </DashboardContainer>
  );
}
