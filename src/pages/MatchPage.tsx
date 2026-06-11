import { Link, useParams } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import {
  fetchLeagueEvents,
  fetchStandings,
  flattenStandings,
  fetchTeamForm,
  teamResultsFrom,
  h2hFromForm,
} from "../api/espn";
import { fetchNews } from "../api/news";
import { SPORTS } from "../api/catalog";
import { predict } from "../lib/predict";
import { squadWatch, type SquadSignal } from "../lib/squadwatch";
import type { Match, Prediction, SportKind, StandingRow, TeamResult } from "../types";
import TeamBadge from "../components/TeamBadge";
import ProbBar from "../components/ProbBar";
import FormDots from "../components/FormDots";
import { Loading, ErrorState } from "../components/States";
import { matchDateLabel, matchTimeLabel, pct } from "../lib/format";
import "./MatchPage.css";

interface Bundle {
  match: Match;
  prediction: Prediction;
  homeForm: TeamResult[];
  awayForm: TeamResult[];
  h2h: TeamResult[];
  homeStanding?: StandingRow;
  awayStanding?: StandingRow;
  squad: { home: SquadSignal; away: SquadSignal };
}

async function loadMatch(sport: SportKind, league: string, id: string): Promise<Bundle> {
  const meta = SPORTS[sport];
  const [events, standingsGroups, news] = await Promise.all([
    fetchLeagueEvents(sport, league, meta.hasDraw),
    meta.hasStandings ? fetchStandings(sport, league).catch(() => []) : Promise.resolve([]),
    fetchNews(sport, league).catch(() => []),
  ]);

  const match = events.find((m) => m.id === id);
  if (!match) throw new Error("Match not found.");

  const [homeSched, awaySched] = await Promise.all([
    fetchTeamForm(sport, league, match.home.id).catch(() => []),
    fetchTeamForm(sport, league, match.away.id).catch(() => []),
  ]);
  const homeForm = homeSched.length ? homeSched : teamResultsFrom(events, match.home.id);
  const awayForm = awaySched.length ? awaySched : teamResultsFrom(events, match.away.id);
  const h2h = h2hFromForm(homeForm, match.away.id);

  const standings = flattenStandings(standingsGroups);
  const homeStanding = standings.find((s) => s.team.id === match.home.id);
  const awayStanding = standings.find((s) => s.team.id === match.away.id);

  const squad = squadWatch(news, match.home.name, match.away.name);

  const prediction = predict({
    sport: meta,
    homeForm,
    awayForm,
    h2h,
    homeStanding,
    awayStanding,
    neutral: match.neutral,
    market: match.odds,
    squadHome: squad.home.multiplier,
    squadAway: squad.away.multiplier,
  });

  return { match, prediction, homeForm, awayForm, h2h, homeStanding, awayStanding, squad };
}

const KIND_ICON: Record<string, string> = {
  injury: "➕",
  suspension: "🟥",
  personal: "🕊️",
  morale: "🔥",
  transfer: "🔄",
};

export default function MatchPage() {
  const { sport = "soccer", leagueId = "", id = "" } = useParams();
  const { data, loading, error } = useAsync(() => loadMatch(sport as SportKind, leagueId, id), [sport, leagueId, id]);

  if (loading) return <div className="page"><Loading /></div>;
  if (error || !data)
    return (
      <div className="page">
        <BackLink />
        <ErrorState message={error || "Could not load this match."} />
      </div>
    );

  const { match, prediction: p, homeForm, awayForm, h2h, homeStanding, awayStanding, squad } = data;
  const meta = SPORTS[match.sport];
  const finished = match.status === "finished";
  const scoreLabel = meta.scoring === "points" ? "Projected score" : meta.scoring === "sets" ? "Likely sets" : "Most likely score";
  const expLabel = meta.scoring === "points" ? "Projected points" : meta.scoring === "sets" ? "Sets" : "Expected goals";
  const expFixed = meta.scoring === "goals" ? 1 : 0;
  const allNotes = [...squad.home.notes, ...squad.away.notes];

  return (
    <div className="page match-detail">
      <BackLink />

      <section className="scoreboard panel silver-edge">
        <div className="sb-meta">
          <span className="chip blue">{match.league}{match.note ? ` · ${match.note}` : ""}</span>
          <span className="muted">
            {matchDateLabel(match)} {matchTimeLabel(match) && `· ${matchTimeLabel(match)}`}
          </span>
        </div>
        <div className="sb-teams">
          <div className="sb-team">
            <TeamBadge name={match.home.name} badge={match.home.badge} size={64} />
            <h2>{match.home.name}</h2>
            <span className="faint">{meta.scoring === "sets" ? "Player 1" : "Home"}</span>
          </div>
          <div className="sb-center">
            {finished && match.homeScore != null ? (
              <div className="sb-score">
                {match.homeScore}<i>-</i>{match.awayScore}
              </div>
            ) : (
              <div className="sb-vs">VS</div>
            )}
            <span className="sb-status">{finished ? "Full time" : match.status === "live" ? "Live" : "Scheduled"}</span>
            {match.venue && <span className="faint sb-venue">{match.venue}</span>}
          </div>
          <div className="sb-team">
            <TeamBadge name={match.away.name} badge={match.away.badge} size={64} />
            <h2>{match.away.name}</h2>
            <span className="faint">{meta.scoring === "sets" ? "Player 2" : "Away"}</span>
          </div>
        </div>
      </section>

      {/* ---- Prediction ---- */}
      <section className="predict-panel panel silver-edge">
        <div className="predict-head">
          <div>
            <p className="eyebrow">The Oracle predicts</p>
            <h3>
              {p.pick === "HOME" ? match.home.name : p.pick === "AWAY" ? match.away.name : "A draw"}
              {p.pick !== "DRAW" ? " to win" : ""}
            </h3>
            {p.marketBlended && <span className="chip blue" style={{ marginTop: 8 }}>Model + market odds</span>}
          </div>
          <ConfidenceDial value={p.confidence} />
        </div>

        <ProbBar home={p.homeWin} draw={p.draw} away={p.awayWin} pick={p.pick} hasDraw={p.hasDraw} />

        <div className="predict-grid">
          <div className="predict-stat">
            <span className="faint">{scoreLabel}</span>
            <strong>
              {p.likelyScore.home} – {p.likelyScore.away}
            </strong>
          </div>
          {meta.scoring === "goals" && (
            <div className="predict-stat">
              <span className="faint">{expLabel}</span>
              <strong>
                {p.expectedHomeGoals.toFixed(expFixed)} – {p.expectedAwayGoals.toFixed(expFixed)}
              </strong>
            </div>
          )}
          {p.btts != null && (
            <div className="predict-stat">
              <span className="faint">Both teams to score</span>
              <strong>{pct(p.btts)}</strong>
            </div>
          )}
          {p.totalLine && (
            <div className="predict-stat">
              <span className="faint">Over {p.totalLine.line} {meta.unit}</span>
              <strong>{pct(p.totalLine.over)}</strong>
            </div>
          )}
          <div className="predict-stat">
            <span className="faint">Top probability</span>
            <strong>{pct(Math.max(p.homeWin, p.draw, p.awayWin))}</strong>
          </div>
        </div>

        {p.rationale.length > 0 && (
          <ul className="rationale">
            {p.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {finished && (
          <p className="predict-actual">
            Actual result: <b>{match.homeScore} – {match.awayScore}</b> · this fixture has already been played.
          </p>
        )}
      </section>

      {/* ---- Squad Watch ---- */}
      <section className="compare panel">
        <h3 className="section-title">
          Squad Watch
          <span className="sw-tag">availability &amp; morale</span>
        </h3>
        {allNotes.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            No major availability or morale flags detected in the news wire for either side.
          </p>
        ) : (
          <ul className="sw-list">
            {allNotes.map((nx, i) => (
              <li key={i} className={`sw-item ${nx.impact >= 0 ? "good" : "bad"}`}>
                <span className="sw-kind" title={nx.kind}>{KIND_ICON[nx.kind] || "•"}</span>
                <div className="sw-body">
                  <a href={nx.link} target="_blank" rel="noreferrer" className="sw-text">{nx.text}</a>
                  <span className="faint sw-src">
                    {nx.side === "home" ? match.home.name : match.away.name} · {nx.source} ·{" "}
                    {nx.impact >= 0 ? "+" : ""}
                    {Math.round(nx.impact * 100)}% form impact
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Recent form ---- */}
      <section className="compare panel">
        <h3 className="section-title">Recent form</h3>
        <div className="compare-grid">
          <FormColumn name={match.home.name} results={homeForm} standing={homeStanding} align="left" unit={meta.unit} />
          <FormColumn name={match.away.name} results={awayForm} standing={awayStanding} align="right" unit={meta.unit} />
        </div>
      </section>

      {/* ---- Head to head ---- */}
      <section className="compare panel">
        <h3 className="section-title">Head to head</h3>
        {h2h.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>No recent meetings found between these two in the public record.</p>
        ) : (
          <ul className="h2h-list">
            {h2h.slice(0, 6).map((m) => (
              <li key={m.matchId} className="h2h-row">
                <span className="faint">{m.date}</span>
                <span className="h2h-fixture">
                  {match.home.name} {m.isHome ? m.goalsFor : m.goalsAgainst}
                  <i>-</i>
                  {m.isHome ? m.goalsAgainst : m.goalsFor} {m.opponent}
                </span>
                <span className={`h2h-out ${m.outcome}`}>{m.outcome}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="back-link">
      ← All fixtures
    </Link>
  );
}

function ConfidenceDial({ value }: { value: number }) {
  const deg = Math.round(value * 360);
  return (
    <div className="conf-dial" style={{ background: `conic-gradient(var(--blue) ${deg}deg, rgba(255,255,255,0.07) 0)` }}>
      <div className="conf-inner">
        <strong>{pct(value)}</strong>
        <span className="faint">conf.</span>
      </div>
    </div>
  );
}

function FormColumn({
  name,
  results,
  standing,
  align,
  unit,
}: {
  name: string;
  results: TeamResult[];
  standing?: StandingRow;
  align: "left" | "right";
  unit: string;
}) {
  const last5 = results.slice(0, 5);
  const gf = last5.reduce((s, r) => s + r.goalsFor, 0);
  const ga = last5.reduce((s, r) => s + r.goalsAgainst, 0);
  return (
    <div className={`form-col ${align}`}>
      <strong className="form-col-name">{name}</strong>
      <FormDots form={last5.map((r) => r.outcome)} />
      <div className="form-col-stats">
        {standing && (
          <span>
            <b>{standing.points}</b> pts · {ordinalish(standing.rank)}
          </span>
        )}
        <span>
          Last {last5.length || 5}: <b>{gf}</b> {unit} for, <b>{ga}</b> against
        </span>
      </div>
    </div>
  );
}

function ordinalish(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
