import type { Match, MarketOdds, MatchStatus, SportKind, StandingRow, TeamResult } from "../types";

/**
 * ESPN public "site API" client, generalised across sports.
 * Keyless + CORS-enabled. The sport kind (soccer/basketball/hockey/tennis) is
 * also ESPN's path segment, and each league id is the ESPN league slug.
 */
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE = "https://site.api.espn.com/apis/v2/sports";

/* ----------------------------- tiny TTL cache ----------------------------- */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 1000 * 60 * 2;

async function getJSON<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 13000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    cache.set(url, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(t);
  }
}

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------- raw shapes ------------------------------- */
interface RawCompetitor {
  homeAway?: "home" | "away";
  score?: string | { value?: number; displayValue?: string };
  winner?: boolean;
  team?: { id: string; displayName: string; abbreviation?: string; logo?: string };
  athlete?: { id: string; displayName: string; flag?: { href?: string } };
}
interface RawOddsSide {
  open?: { odds?: string };
  close?: { odds?: string };
  odds?: string;
  moneyLine?: number;
}
interface RawOdds {
  overUnder?: number;
  provider?: { displayName?: string };
  drawOdds?: { moneyLine?: number };
  moneyline?: { home?: RawOddsSide; away?: RawOddsSide; draw?: RawOddsSide };
}
interface RawCompetition {
  venue?: { fullName?: string };
  neutralSite?: boolean;
  status?: { type?: { state?: string; description?: string } };
  competitors?: RawCompetitor[];
  odds?: RawOdds[];
  round?: { displayName?: string };
  notes?: { headline?: string }[];
}
interface RawEvent {
  id: string;
  date: string;
  name?: string;
  shortName?: string;
  status?: { type?: { state?: string; completed?: boolean; description?: string; detail?: string } };
  competitions?: RawCompetition[];
  groupings?: { competitions?: RawCompetition[] }[]; // tennis
}
interface RawScoreboard {
  leagues?: { name?: string }[];
  events?: RawEvent[];
}

/* ------------------------------ helpers ----------------------------------- */
function americanToProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}
function sideOdds(s?: RawOddsSide): number | null {
  const raw = s?.close?.odds ?? s?.open?.odds ?? (s?.moneyLine != null ? String(s.moneyLine) : undefined);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function parseOdds(raw: RawOdds[] | undefined, hasDraw: boolean): MarketOdds | undefined {
  const o = raw?.[0];
  const ml = o?.moneyline;
  if (!o || !ml) return undefined;
  const h = sideOdds(ml.home);
  const a = sideOdds(ml.away);
  if (h == null || a == null) return undefined;
  const ph = americanToProb(h);
  const pa = americanToProb(a);
  if (hasDraw) {
    const d = sideOdds(ml.draw) ?? (o.drawOdds?.moneyLine != null ? o.drawOdds.moneyLine : null);
    if (d == null) return undefined;
    const pd = americanToProb(d);
    const sum = ph + pd + pa || 1;
    return { home: ph / sum, draw: pd / sum, away: pa / sum, total: o.overUnder, provider: o.provider?.displayName };
  }
  const sum = ph + pa || 1;
  return { home: ph / sum, draw: 0, away: pa / sum, total: o.overUnder, provider: o.provider?.displayName };
}
function isNeutralCompetition(sport: SportKind, league: string): boolean {
  if (sport === "tennis") return true;
  return league.startsWith("fifa.") || league.includes(".nations") || league.includes("uefa.euro");
}
function num(v?: string | { value?: number; displayValue?: string }): number | null {
  if (v == null) return null;
  if (typeof v === "object") {
    if (typeof v.value === "number") return v.value;
    return num(v.displayValue);
  }
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function mapStatus(state?: string, desc?: string): MatchStatus {
  const d = (desc || "").toLowerCase();
  if (d.includes("postpone") || d.includes("cancel")) return "postponed";
  if (state === "in") return "live";
  if (state === "post") return "finished";
  return "upcoming";
}

/* ------------------------------ event mapping ----------------------------- */
function competitorName(c: RawCompetitor): string {
  return c.team?.displayName || c.athlete?.displayName || "TBD";
}
function competitorId(c: RawCompetitor): string {
  return c.team?.id || c.athlete?.id || "";
}
function competitorBadge(c: RawCompetitor): string | undefined {
  return c.team?.logo || c.athlete?.flag?.href;
}

function mapCompetition(
  comp: RawCompetition,
  event: RawEvent,
  sport: SportKind,
  league: string,
  leagueName: string,
  hasDraw: boolean,
  idOverride?: string
): Match | null {
  const cs = comp.competitors;
  if (!cs || cs.length < 2) return null;
  const home = cs.find((c) => c.homeAway === "home") || cs[0];
  const away = cs.find((c) => c.homeAway === "away") || cs[1];
  const state = comp.status?.type?.state || event.status?.type?.state;
  const status = mapStatus(state, comp.status?.type?.description || event.status?.type?.description);
  const played = status === "finished" || status === "live";
  const ts = Date.parse(event.date);
  const d = new Date(ts);
  const note = comp.round?.displayName || event.name;
  return {
    id: idOverride || event.id,
    sport,
    league: leagueName,
    leagueId: league,
    note: sport === "tennis" ? note : comp.round?.displayName,
    date: Number.isFinite(ts) ? d.toISOString().slice(0, 10) : "",
    time: Number.isFinite(ts) ? d.toTimeString().slice(0, 5) : undefined,
    timestamp: Number.isFinite(ts) ? ts : undefined,
    venue: comp.venue?.fullName,
    status,
    neutral: comp.neutralSite === true || isNeutralCompetition(sport, league),
    home: { id: competitorId(home), name: competitorName(home), badge: competitorBadge(home) },
    away: { id: competitorId(away), name: competitorName(away), badge: competitorBadge(away) },
    homeScore: played ? num(home.score) : null,
    awayScore: played ? num(away.score) : null,
    odds: parseOdds(comp.odds, hasDraw),
  };
}

/* -------------------------------- queries --------------------------------- */
export async function fetchLeagueEvents(
  sport: SportKind,
  league: string,
  hasDraw: boolean,
  opts: { back?: number; fwd?: number } = {}
): Promise<Match[]> {
  const back = opts.back ?? 30;
  const fwd = opts.fwd ?? 45;
  const from = new Date(Date.now() - back * 864e5);
  const to = new Date(Date.now() + fwd * 864e5);
  const url = `${SITE}/${sport}/${league}/scoreboard?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=400`;
  const data = await getJSON<RawScoreboard>(url);
  const leagueName = data.leagues?.[0]?.name || "";
  const out: Match[] = [];
  for (const e of data.events || []) {
    if (sport === "tennis" && e.groupings) {
      for (const g of e.groupings) {
        for (const comp of g.competitions || []) {
          const m = mapCompetition(comp, e, sport, league, leagueName, hasDraw, comp.competitors ? `${e.id}-${(comp as { id?: string }).id ?? out.length}` : undefined);
          if (m) out.push(m);
        }
      }
    } else {
      const m = mapCompetition(e.competitions?.[0] ?? {}, e, sport, league, leagueName, hasDraw);
      if (m) out.push(m);
    }
  }
  return out.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

export async function fetchUpcoming(sport: SportKind, league: string, hasDraw: boolean): Promise<Match[]> {
  const all = await fetchLeagueEvents(sport, league, hasDraw);
  const now = Date.now();
  return all
    .filter((m) => m.status === "upcoming" || m.status === "live" || (m.timestamp ?? 0) >= now - 3 * 36e5)
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    .slice(0, 60);
}

export async function fetchRecent(sport: SportKind, league: string, hasDraw: boolean, days = 3): Promise<Match[]> {
  const all = await fetchLeagueEvents(sport, league, hasDraw);
  const cutoff = Date.now() - days * 864e5;
  return all
    .filter((m) => m.status === "finished" && (m.timestamp ?? 0) >= cutoff)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

/** Recent finished results for a team, newest first (team sports). */
export async function fetchTeamForm(
  sport: SportKind,
  league: string,
  teamId: string,
  seasons?: number[]
): Promise<TeamResult[]> {
  // Soccer national/club teams aggregate across competitions via "all".
  const formLeague = sport === "soccer" ? "all" : league;
  const yrs = seasons ?? [new Date().getFullYear(), new Date().getFullYear() - 1];
  const batches = await Promise.all(
    yrs.map((y) =>
      getJSON<{ events?: RawEvent[] }>(`${SITE}/${sport}/${formLeague}/teams/${teamId}/schedule?season=${y}`).catch(
        () => ({ events: [] as RawEvent[] })
      )
    )
  );
  const seen = new Set<string>();
  const out: TeamResult[] = [];
  for (const b of batches) {
    for (const e of b.events || []) {
      const comp = e.competitions?.[0];
      const state = comp?.status?.type?.state || e.status?.type?.state;
      if (state !== "post" || !comp?.competitors) continue;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const self = comp.competitors.find((c) => competitorId(c) === teamId);
      const opp = comp.competitors.find((c) => competitorId(c) !== teamId);
      if (!self || !opp) continue;
      const gf = num(self.score);
      const ga = num(opp.score);
      if (gf == null || ga == null) continue;
      out.push({
        matchId: e.id,
        date: e.date.slice(0, 10),
        opponent: competitorName(opp),
        opponentId: competitorId(opp),
        isHome: self.homeAway === "home",
        goalsFor: gf,
        goalsAgainst: ga,
        outcome: gf > ga ? "W" : gf < ga ? "L" : "D",
      });
    }
  }
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function teamResultsFrom(events: Match[], teamId: string): TeamResult[] {
  return events
    .filter((m) => m.status === "finished" && (m.home.id === teamId || m.away.id === teamId))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .map((m) => {
      const isHome = m.home.id === teamId;
      const gf = (isHome ? m.homeScore : m.awayScore) ?? 0;
      const ga = (isHome ? m.awayScore : m.homeScore) ?? 0;
      return {
        matchId: m.id,
        date: m.date,
        opponent: isHome ? m.away.name : m.home.name,
        opponentId: isHome ? m.away.id : m.home.id,
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        outcome: gf > ga ? "W" : gf < ga ? "L" : "D",
      } as TeamResult;
    });
}

export function h2hFromForm(homeForm: TeamResult[], awayId: string): TeamResult[] {
  return homeForm.filter((r) => r.opponentId === awayId);
}

/* ------------------------------ standings --------------------------------- */
export interface StandingsGroup {
  name: string;
  rows: StandingRow[];
}
interface RawStandingsEntry {
  team: { id: string; displayName: string; logos?: { href: string }[]; logo?: string };
  stats: { name: string; value?: number; displayValue?: string }[];
}
interface RawStandings {
  children?: { name?: string; standings?: { entries?: RawStandingsEntry[] } }[];
  standings?: { entries?: RawStandingsEntry[] };
}
function stat(entry: RawStandingsEntry, name: string): number {
  const s = entry.stats.find((x) => x.name === name);
  if (!s) return 0;
  if (typeof s.value === "number") return s.value;
  const n = Number(s.displayValue);
  return Number.isFinite(n) ? n : 0;
}
function mapEntries(entries: RawStandingsEntry[]): StandingRow[] {
  const rows = entries.map((e) => ({
    rank: stat(e, "rank"),
    team: { id: e.team.id, name: e.team.displayName, badge: e.team.logos?.[0]?.href || e.team.logo },
    played: stat(e, "gamesPlayed"),
    win: stat(e, "wins"),
    draw: stat(e, "ties"),
    loss: stat(e, "losses"),
    goalsFor: stat(e, "pointsFor"),
    goalsAgainst: stat(e, "pointsAgainst"),
    goalDiff: stat(e, "pointDifferential"),
    points: stat(e, "points") || stat(e, "wins") * 2,
  }));
  rows.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.win - a.win);
  rows.forEach((r, i) => {
    if (!r.rank) r.rank = i + 1;
  });
  return rows;
}
export async function fetchStandings(sport: SportKind, league: string): Promise<StandingsGroup[]> {
  const data = await getJSON<RawStandings>(`${CORE}/${sport}/${league}/standings`);
  if (data.children && data.children.length) {
    return data.children
      .filter((c) => c.standings?.entries?.length)
      .map((c) => ({ name: c.name || "", rows: mapEntries(c.standings!.entries!) }));
  }
  if (data.standings?.entries?.length) return [{ name: "", rows: mapEntries(data.standings.entries) }];
  return [];
}
export function flattenStandings(groups: StandingsGroup[]): StandingRow[] {
  return groups.flatMap((g) => g.rows);
}
