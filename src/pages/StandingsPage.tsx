import { useLeague } from "../state/LeagueContext";
import { useAsync } from "../lib/useAsync";
import { fetchStandings, type StandingsGroup } from "../api/espn";
import { leagueById, SPORTS } from "../api/catalog";
import LeagueSelector from "../components/LeagueSelector";
import TeamBadge from "../components/TeamBadge";
import { Loading, ErrorState, Empty } from "../components/States";
import "./StandingsPage.css";

export default function StandingsPage() {
  const { sport, leagueId } = useLeague();
  const league = leagueById(leagueId);
  const meta = SPORTS[sport];
  const enabled = meta.hasStandings;
  const { data, loading, error } = useAsync(
    () => (enabled ? fetchStandings(sport, leagueId) : Promise.resolve([] as StandingsGroup[])),
    [sport, leagueId]
  );

  const pointsLabel = meta.scoring === "points" ? "PF" : meta.scoring === "goals" ? "GF" : "F";

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-hero-top">
          <div>
            <p className="eyebrow">{meta.label} · league table</p>
            <h1>
              Current <span className="accent">Standings</span>
            </h1>
            <p className="sub">{league?.name}. Position and record feed directly into the prediction model.</p>
          </div>
        </div>
        <LeagueSelector />
      </div>

      {!enabled && (
        <Empty message="Standings aren't applicable to this sport — head to Fixtures for tournament draws and predictions." />
      )}
      {enabled && loading && <Loading label="Loading the table…" />}
      {enabled && error && <ErrorState message={error} />}
      {enabled && !loading && !error && (!data || data.length === 0) && (
        <Empty message="No standings published for this competition right now." />
      )}
      {enabled && !loading && !error && data && data.length > 0 && (
        <div className="standings-groups">
          {data.map((g, i) => (
            <Group key={g.name || i} group={g} showName={data.length > 1} ptsCol={pointsLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ group, showName, ptsCol }: { group: StandingsGroup; showName: boolean; ptsCol: string }) {
  return (
    <div className="panel silver-edge table-wrap">
      {showName && group.name && <h3 className="group-title">{group.name}</h3>}
      <table className="standings">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th className="club">Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th className="hide-sm">{ptsCol}</th>
            <th className="hide-sm">A</th>
            <th>±</th>
            <th className="pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r) => (
            <tr key={r.team.id}>
              <td className="rank">{r.rank}</td>
              <td className="club">
                <TeamBadge name={r.team.name} badge={r.team.badge} size={24} />
                <span className="club-name">{r.team.name}</span>
              </td>
              <td>{r.played}</td>
              <td>{r.win}</td>
              <td>{r.draw}</td>
              <td>{r.loss}</td>
              <td className="hide-sm">{r.goalsFor}</td>
              <td className="hide-sm">{r.goalsAgainst}</td>
              <td className={r.goalDiff > 0 ? "pos" : r.goalDiff < 0 ? "neg" : ""}>
                {r.goalDiff > 0 ? "+" : ""}
                {r.goalDiff}
              </td>
              <td className="pts">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
