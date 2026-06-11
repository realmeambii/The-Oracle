import { Link } from "react-router-dom";
import type { Match } from "../types";
import TeamBadge from "./TeamBadge";
import { matchDateLabel, matchTimeLabel } from "../lib/format";
import "./MatchCard.css";

interface Props {
  match: Match;
}

const STATUS_LABEL: Record<Match["status"], string> = {
  upcoming: "Upcoming",
  live: "Live",
  finished: "Full time",
  postponed: "Postponed",
};

export default function MatchCard({ match }: Props) {
  const finished = match.status === "finished";
  const homeWon = finished && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWon = finished && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  return (
    <Link to={`/match/${match.sport}/${match.leagueId}/${match.id}`} className="match-card panel silver-edge">
      <div className="match-card-head">
        <span className={`status-pill ${match.status}`}>
          {match.status === "live" && <span className="live-dot" />}
          {STATUS_LABEL[match.status]}
        </span>
        <span className="match-when">
          {matchDateLabel(match)}
          {match.status === "upcoming" && matchTimeLabel(match) ? ` · ${matchTimeLabel(match)}` : ""}
        </span>
      </div>

      <div className="match-teams">
        <div className={`team ${homeWon ? "won" : ""}`}>
          <TeamBadge name={match.home.name} badge={match.home.badge} size={30} />
          <span className="team-name">{match.home.name}</span>
        </div>

        <div className="match-score">
          {match.homeScore != null && match.awayScore != null ? (
            <span className="score">
              {match.homeScore}<i>:</i>{match.awayScore}
            </span>
          ) : (
            <span className="vs">vs</span>
          )}
        </div>

        <div className={`team away ${awayWon ? "won" : ""}`}>
          <span className="team-name">{match.away.name}</span>
          <TeamBadge name={match.away.name} badge={match.away.badge} size={30} />
        </div>
      </div>

      <div className="match-card-foot">
        <span className="faint">{match.note || match.venue || match.league}</span>
        <span className="predict-cta">Predict →</span>
      </div>
    </Link>
  );
}
