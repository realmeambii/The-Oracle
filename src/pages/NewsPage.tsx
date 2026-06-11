import { useState } from "react";
import { useLeague } from "../state/LeagueContext";
import { useAsync } from "../lib/useAsync";
import { fetchNews, filterTransfers } from "../api/news";
import { SPORTS } from "../api/catalog";
import { relativeTime } from "../lib/format";
import LeagueSelector from "../components/LeagueSelector";
import { Loading, ErrorState, Empty } from "../components/States";
import "./NewsPage.css";

export default function NewsPage() {
  const { sport, leagueId } = useLeague();
  const meta = SPORTS[sport];
  const [onlyTransfers, setOnlyTransfers] = useState(false);
  const { data, loading, error } = useAsync(() => fetchNews(sport, leagueId), [sport, leagueId]);

  const items = data ? (onlyTransfers ? filterTransfers(data) : data) : [];
  const transferLabel = sport === "soccer" ? "Transfers" : "Roster moves";

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-hero-top">
          <div>
            <p className="eyebrow">{meta.label} · news wire</p>
            <h1>
              Latest <span className="accent">Headlines</span>
            </h1>
            <p className="sub">
              Live {meta.label.toLowerCase()} news from ESPN — injuries, {transferLabel.toLowerCase()} and
              storylines that feed Squad Watch.
            </p>
          </div>
          <div className="row gap-sm">
            <button
              className={`chip ${!onlyTransfers ? "active" : ""}`}
              onClick={() => setOnlyTransfers(false)}
              style={{ cursor: "pointer" }}
            >
              All news
            </button>
            <button
              className={`chip ${onlyTransfers ? "active" : ""}`}
              onClick={() => setOnlyTransfers(true)}
              style={{ cursor: "pointer" }}
            >
              {transferLabel}
            </button>
          </div>
        </div>
        <LeagueSelector />
      </div>

      {loading && <Loading label="Pulling the latest wire…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <Empty message="The news wire is quiet right now. Try again shortly or switch league." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="news-list">
          {items.map((n, i) => (
            <a key={i} href={n.link} target="_blank" rel="noreferrer" className="news-item panel">
              <div className="news-meta">
                <span className="news-source">{n.source}</span>
                {n.date && <span className="faint">{relativeTime(n.date)}</span>}
              </div>
              <p className="news-title">{n.title}</p>
              {n.summary && <p className="news-summary faint">{n.summary.slice(0, 130)}…</p>}
              <span className="news-read">Read on ESPN →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
