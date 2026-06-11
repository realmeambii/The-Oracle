import { useLeague } from "../state/LeagueContext";
import { useAsync } from "../lib/useAsync";
import { fetchUpcoming } from "../api/espn";
import { leagueById, SPORTS } from "../api/catalog";
import LeagueSelector from "../components/LeagueSelector";
import MatchCard from "../components/MatchCard";
import { CardSkeletons, ErrorState, Empty } from "../components/States";

export default function FixturesPage() {
  const { sport, leagueId } = useLeague();
  const league = leagueById(leagueId);
  const meta = SPORTS[sport];
  const { data, loading, error } = useAsync(() => fetchUpcoming(sport, leagueId, meta.hasDraw), [sport, leagueId]);

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-hero-top">
          <div>
            <p className="eyebrow">{meta.label} · live fixtures</p>
            <h1>
              Upcoming <span className="accent">Matches</span>
            </h1>
            <p className="sub">
              Real-time schedule for {league?.name}. Tap any fixture for form, head-to-head, Squad Watch and
              The Oracle's computed prediction.
            </p>
          </div>
          <span className="chip blue">{league?.country}</span>
        </div>
        <LeagueSelector />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && data.length === 0 && (
        <Empty message="No upcoming fixtures listed right now — competitions may be between seasons. Try another league or the Results tab." />
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
