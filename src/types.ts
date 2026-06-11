/** Domain model used across The Oracle (normalized from raw API payloads). */

export type SportKind = "soccer" | "basketball" | "hockey" | "tennis";

export interface Sport {
  kind: SportKind;
  label: string;
  icon: string;
  scoring: "goals" | "points" | "sets";
  hasDraw: boolean;
  unit: string;
  /** Average score per side per game (goals/points) — model baseline. */
  avgScore: number;
  /** Home advantage: multiplier for goal sports, points added for basketball. */
  homeEdge: number;
  awayEdge: number;
  /** Std-dev of margin for points sports (basketball). */
  spread?: number;
  hasStandings: boolean;
}

export interface League {
  id: string;
  sport: SportKind;
  name: string;
  short: string;
  country: string;
}

export interface TeamRef {
  id: string;
  name: string;
  badge?: string;
}

export type MatchStatus = "upcoming" | "live" | "finished" | "postponed";

/** De-vigged bookmaker odds for a fixture (implied probabilities sum to ~1). */
export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
  /** Over/Under line for total goals, e.g. 2.5. */
  total?: number;
  provider?: string;
}

export interface Match {
  id: string;
  sport: SportKind;
  league: string;
  leagueId: string;
  season?: string;
  /** Tennis/round context, e.g. "Quarterfinal" or "Group A". */
  note?: string;
  date: string; // ISO-ish date (YYYY-MM-DD)
  time?: string;
  timestamp?: number; // ms epoch
  venue?: string;
  status: MatchStatus;
  /** True when neither side is playing at their own ground (e.g. World Cup). */
  neutral?: boolean;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  odds?: MarketOdds;
}

export interface StandingRow {
  rank: number;
  team: TeamRef;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form?: string; // e.g. "WWDLW"
}

export interface TeamProfile {
  id: string;
  name: string;
  badge?: string;
  stadium?: string;
  country?: string;
  formedYear?: string;
  description?: string;
}

/** A single result from a team's perspective, used for form & strength. */
export interface TeamResult {
  matchId: string;
  date: string;
  opponent: string;
  opponentId?: string;
  competition?: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: "W" | "D" | "L";
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  date?: string;
  summary?: string;
}

export interface Prediction {
  homeWin: number; // 0..1
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  likelyScore: { home: number; away: number };
  /** Probability both teams score (0..1) — goal sports only. */
  btts?: number;
  /** Probability of more than 2.5 total goals (0..1) — goal sports only. */
  over25?: number;
  /** Over/under line + probability for points sports (basketball). */
  totalLine?: { line: number; over: number };
  hasDraw: boolean;
  confidence: number; // 0..1
  pick: "HOME" | "DRAW" | "AWAY";
  /** Whether bookmaker odds were blended into the result. */
  marketBlended: boolean;
  /** Human-readable factors that drove the prediction. */
  rationale: string[];
}

/** A squad availability / morale note affecting one side. */
export interface SquadNote {
  side: "home" | "away";
  team: string;
  kind: "injury" | "suspension" | "personal" | "morale" | "transfer";
  text: string;
  /** Strength impact in [-1, 1]; negative hurts the side. */
  impact: number;
  source: string;
  link?: string;
}
