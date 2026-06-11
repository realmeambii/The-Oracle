import { leaguesForSport } from "../api/catalog";
import { useLeague } from "../state/LeagueContext";
import "./LeagueSelector.css";

export default function LeagueSelector() {
  const { sport, leagueId, setLeagueId } = useLeague();
  const leagues = leaguesForSport(sport);
  if (leagues.length <= 1) return null;
  return (
    <div className="league-selector" role="tablist" aria-label="Select league">
      {leagues.map((l) => (
        <button
          key={l.id}
          role="tab"
          aria-selected={l.id === leagueId}
          className={`chip ${l.id === leagueId ? "active" : ""}`}
          onClick={() => setLeagueId(l.id)}
          title={`${l.name} · ${l.country}`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
