import { useState } from "react";
import { useLeague } from "../state/LeagueContext";
import { useAsync } from "../lib/useAsync";
import { fetchRecent } from "../api/espn";
import { leagueById, SPORTS } from "../api/catalog";
import LeagueSelector from "../components/LeagueSelector";
import MatchCard from "../components/MatchCard";
import { CardSkeletons, ErrorState, Empty } from "../components/States";

const WINDOWS = [
  { days: 3, label: "Last 3 days" },
  { days: 7, label: "Last week" },
  { days: 14, label: "Last fortnight" },
];

export default function ResultsPage() {
  const { sport, leagueId } = useLeague();
  const league = leagueById(leagueId);
  const meta = SPORTS[sport];
  const [days, setDays] = useState(3);
  const { data, loading, error } = useAsync(
    () => fetchRecent(sport, leagueId, meta.hasDraw, days),
    [sport, leagueId, days]
  );

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-hero-top">
          <div>
            <p className="eyebrow">{meta.label} · recent results</p>
            <h1>
              Latest <span className="accent">Scores</span>
            </h1>
            <p className="sub">
              Finished matches from {league?.name}. The Oracle feeds these back into its form and
              head-to-head model.
            </p>
          </div>
          <div className="row gap-sm wrap">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                className={`chip ${days === w.days ? "active" : ""}`}
                onClick={() => setDays(w.days)}
                style={{ cursor: "pointer" }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <LeagueSelector />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && data.length === 0 && (
        <Empty message="No finished matches in this window. Widen the range or pick another league." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="card-grid">
          {data.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
