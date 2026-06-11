import type { League, Sport, SportKind } from "../types";

/**
 * Sport catalogue. `kind` doubles as ESPN's sport path segment
 * (soccer / basketball / hockey / tennis), and each league's `id` is the ESPN
 * league slug. Scoring params drive the prediction engine per sport.
 */
export const SPORTS: Record<SportKind, Sport> = {
  soccer: {
    kind: "soccer",
    label: "Football",
    icon: "⚽",
    scoring: "goals",
    hasDraw: true,
    unit: "goals",
    avgScore: 1.35,
    homeEdge: 1.18,
    awayEdge: 0.88,
    hasStandings: true,
  },
  basketball: {
    kind: "basketball",
    label: "Basketball",
    icon: "🏀",
    scoring: "points",
    hasDraw: false,
    unit: "points",
    avgScore: 112,
    homeEdge: 3.0, // points added to the home margin (backtest-tuned, interior optimum)
    awayEdge: 0,
    spread: 11.5, // std-dev of margin
    hasStandings: true,
  },
  hockey: {
    kind: "hockey",
    label: "Ice Hockey",
    icon: "🏒",
    scoring: "goals",
    hasDraw: false, // OT/shootout always resolves
    unit: "goals",
    avgScore: 3.05,
    homeEdge: 1.09,
    awayEdge: 0.94,
    hasStandings: true,
  },
  tennis: {
    kind: "tennis",
    label: "Tennis",
    icon: "🎾",
    scoring: "sets",
    hasDraw: false,
    unit: "sets",
    avgScore: 2,
    homeEdge: 1, // neutral
    awayEdge: 1,
    hasStandings: false,
  },
};

export const SPORT_ORDER: SportKind[] = ["soccer", "basketball", "hockey", "tennis"];

export const LEAGUES: League[] = [
  // ⚽ Football
  { id: "fifa.world", sport: "soccer", short: "World Cup", name: "FIFA World Cup", country: "International" },
  { id: "eng.1", sport: "soccer", short: "EPL", name: "Premier League", country: "England" },
  { id: "esp.1", sport: "soccer", short: "LaLiga", name: "La Liga", country: "Spain" },
  { id: "ger.1", sport: "soccer", short: "BL", name: "Bundesliga", country: "Germany" },
  { id: "ita.1", sport: "soccer", short: "SerieA", name: "Serie A", country: "Italy" },
  { id: "uefa.champions", sport: "soccer", short: "UCL", name: "Champions League", country: "Europe" },
  { id: "usa.1", sport: "soccer", short: "MLS", name: "Major League Soccer", country: "USA" },
  // 🏀 Basketball
  { id: "nba", sport: "basketball", short: "NBA", name: "NBA", country: "USA" },
  { id: "wnba", sport: "basketball", short: "WNBA", name: "WNBA", country: "USA" },
  // 🏒 Ice Hockey
  { id: "nhl", sport: "hockey", short: "NHL", name: "NHL", country: "N. America" },
  // 🎾 Tennis
  { id: "atp", sport: "tennis", short: "ATP", name: "ATP Tour", country: "Men" },
  { id: "wta", sport: "tennis", short: "WTA", name: "WTA Tour", country: "Women" },
];

export function leaguesForSport(sport: SportKind): League[] {
  return LEAGUES.filter((l) => l.sport === sport);
}

export function leagueById(id: string): League | undefined {
  return LEAGUES.find((l) => l.id === id);
}

export function defaultLeagueFor(sport: SportKind): string {
  return leaguesForSport(sport)[0]?.id ?? "";
}
