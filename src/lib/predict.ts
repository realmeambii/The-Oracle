import type { MarketOdds, Prediction, Sport, StandingRow, TeamResult } from "../types";

/**
 * The Oracle prediction engine — sport-aware.
 *
 *  • Football & ice hockey ("goals"): a Dixon-Coles-corrected Poisson model on
 *    relative attack/defence strengths (recent form blended with season data,
 *    empirical-Bayes shrinkage, home advantage, form/H2H/squad nudges), with
 *    bookmaker-odds blending. Hockey collapses the draw (OT/shootout resolves).
 *  • Basketball ("points"): an expected-points / normal-margin model.
 *  • Tennis ("sets"): a market-and-form win-probability model (two outcomes).
 *
 * Every sport blends de-vigged bookmaker odds when available and degrades
 * gracefully to a league-average baseline when data is thin.
 */

const GOAL_CAP_FACTOR = 3.7; // blowouts capped at ~3.7× the sport average
const PRIOR_STRENGTH = 4.5;
const DC_RHO = -0.13;
const MARKET_WEIGHT = 0.6;
const MAX_GOALS = 9;

interface Inputs {
  sport: Sport;
  homeForm: TeamResult[];
  awayForm: TeamResult[];
  h2h: TeamResult[];
  homeStanding?: StandingRow;
  awayStanding?: StandingRow;
  neutral?: boolean;
  market?: MarketOdds;
  /** Squad Watch strength multipliers (≈0.82–1.12), default 1. */
  squadHome?: number;
  squadAway?: number;
  /** Optional parameter overrides — used by the backtester to tune the model. */
  tune?: { homeEdge?: number; rho?: number; marketWeight?: number };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ----------------------------- shared signals ----------------------------- */
function recentRates(results: TeamResult[], avg: number): { attack: number; defense: number; n: number } {
  const recent = results.slice(0, 8);
  if (!recent.length) return { attack: avg, defense: avg, n: 0 };
  const cap = avg * GOAL_CAP_FACTOR;
  let wSum = 0;
  let gf = 0;
  let ga = 0;
  recent.forEach((r, i) => {
    const w = Math.pow(0.85, i);
    wSum += w;
    gf += Math.min(r.goalsFor, cap) * w;
    ga += Math.min(r.goalsAgainst, cap) * w;
  });
  return { attack: gf / wSum, defense: ga / wSum, n: recent.length };
}

function strength(results: TeamResult[], standing: StandingRow | undefined, avg: number) {
  const recent = recentRates(results, avg);
  let attack = recent.attack;
  let defense = recent.defense;
  let n = recent.n;
  if (standing && standing.played > 0) {
    const sa = standing.goalsFor / standing.played;
    const sd = standing.goalsAgainst / standing.played;
    if (sa > 0 || sd > 0) {
      attack = 0.6 * recent.attack + 0.4 * sa;
      defense = 0.6 * recent.defense + 0.4 * sd;
      n = Math.max(n, Math.min(standing.played, 12));
    }
  }
  const k = PRIOR_STRENGTH;
  attack = (attack * n + avg * k) / (n + k);
  defense = (defense * n + avg * k) / (n + k);
  return { attack, defense, n };
}

function formScore(results: TeamResult[]): number {
  const r = results.slice(0, 5);
  if (!r.length) return 0.5;
  const pts = r.reduce((s, m) => s + (m.outcome === "W" ? 3 : m.outcome === "D" ? 1 : 0), 0);
  return pts / (r.length * 3);
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun erf approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function poissonPmf(lambda: number, n: number): number[] {
  const p = new Array<number>(n + 1);
  p[0] = Math.exp(-lambda);
  for (let k = 1; k <= n; k++) p[k] = (p[k - 1] * lambda) / k;
  return p;
}

function dcTau(i: number, j: number, lh: number, la: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function blendMarket(
  p: { home: number; draw: number; away: number },
  market: MarketOdds | undefined,
  hasDraw: boolean,
  weight = MARKET_WEIGHT
): { probs: { home: number; draw: number; away: number }; blended: boolean } {
  if (!market) return { probs: p, blended: false };
  let home = weight * market.home + (1 - weight) * p.home;
  let draw = hasDraw ? weight * market.draw + (1 - weight) * p.draw : 0;
  let away = weight * market.away + (1 - weight) * p.away;
  const s = home + draw + away || 1;
  home /= s;
  draw /= s;
  away /= s;
  return { probs: { home, draw, away }, blended: true };
}

function confidenceOf(top: number, hasDraw: boolean, n: number, hasMarket: boolean): number {
  const base = hasDraw ? 0.34 : 0.5;
  const data = clamp((n + (hasMarket ? 8 : 0)) / 22, 0.2, 1);
  return clamp((top - base) / (1 - base), 0, 1) * 0.6 + data * 0.4;
}

function decide(home: number, draw: number, away: number): Prediction["pick"] {
  return home >= draw && home >= away ? "HOME" : away >= draw ? "AWAY" : "DRAW";
}

/* ------------------------------ goal engine ------------------------------- */
function predictGoals(inp: Inputs): Prediction {
  const { sport, homeForm, awayForm, h2h, homeStanding, awayStanding, neutral, market } = inp;
  const avg = sport.avgScore;
  const rationale: string[] = [];
  const squadHome = inp.squadHome ?? 1;
  const squadAway = inp.squadAway ?? 1;

  const h = strength(homeForm, homeStanding, avg);
  const a = strength(awayForm, awayStanding, avg);

  const homeAtt = h.attack / avg;
  const homeDef = h.defense / avg;
  const awayAtt = a.attack / avg;
  const awayDef = a.defense / avg;

  const rho = inp.tune?.rho ?? DC_RHO;
  const homeEdge = neutral ? 1 : inp.tune?.homeEdge ?? sport.homeEdge;
  const awayEdge = neutral ? 1 : sport.awayEdge;

  let lh = avg * homeAtt * awayDef * homeEdge * squadHome;
  let la = avg * awayAtt * homeDef * awayEdge * squadAway;

  if (h.n || a.n) {
    rationale.push(`Attacking strength — home ${homeAtt.toFixed(2)}× vs away ${awayAtt.toFixed(2)}× the league average.`);
  } else {
    rationale.push("Limited data — using a league-average baseline.");
  }
  if (neutral) rationale.push("Neutral venue — no home advantage applied.");

  const fH = formScore(homeForm);
  const fA = formScore(awayForm);
  lh *= 0.9 + fH * 0.2;
  la *= 0.9 + fA * 0.2;
  if (homeForm.length && awayForm.length) {
    rationale.push(`Form index — home ${Math.round(fH * 100)}% vs away ${Math.round(fA * 100)}% (last 5).`);
  }

  if (h2h.length) {
    const w = h2h.filter((m) => m.outcome === "W").length;
    const l = h2h.filter((m) => m.outcome === "L").length;
    const edge = clamp((w - l) / h2h.length, -1, 1) * 0.1;
    lh *= 1 + edge;
    la *= 1 - edge;
    rationale.push(`Head-to-head — ${w}W ${h2h.length - w - l}D ${l}L for the home side in ${h2h.length} meetings.`);
  }

  if (market?.total && market.total > 0) {
    const modelTotal = lh + la || 1;
    const scale = clamp(market.total / modelTotal, 0.7, 1.45);
    const applied = 1 + (scale - 1) * 0.6;
    lh *= applied;
    la *= applied;
  }

  lh = clamp(lh, 0.15, avg * 3);
  la = clamp(la, 0.15, avg * 3);

  const useDc = avg < 2; // Dixon-Coles correction is for low-scoring sports
  const hp = poissonPmf(lh, MAX_GOALS);
  const ap = poissonPmf(la, MAX_GOALS);
  let pH = 0;
  let pD = 0;
  let pA = 0;
  let btts = 0;
  const overLine = avg < 2 ? 2.5 : 5.5;
  let over = 0;
  let total = 0;
  let best = { home: 0, away: 0, p: -1 };
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = hp[i] * ap[j] * (useDc ? dcTau(i, j, lh, la, rho) : 1);
      total += p;
      if (i > j) pH += p;
      else if (i === j) pD += p;
      else pA += p;
      if (i >= 1 && j >= 1) btts += p;
      if (i + j > overLine) over += p;
      if (p > best.p) best = { home: i, away: j, p };
    }
  }
  const norm = total || 1;
  pH /= norm;
  pD /= norm;
  pA /= norm;
  btts /= norm;
  over /= norm;

  // Hockey/basketball-style: no draw — redistribute the tie mass (OT resolves).
  if (!sport.hasDraw && pD > 0) {
    const sum = pH + pA || 1;
    pH += pD * (pH / sum);
    pA += pD * (pA / sum);
    pD = 0;
  }

  const blend = blendMarket({ home: pH, draw: pD, away: pA }, market, sport.hasDraw, inp.tune?.marketWeight);
  ({ home: pH, draw: pD, away: pA } = blend.probs);
  if (blend.blended) {
    rationale.push(
      `${market!.provider || "Market"} odds imply ${Math.round(market!.home * 100)}% / ` +
        `${sport.hasDraw ? `${Math.round(market!.draw * 100)}% / ` : ""}${Math.round(market!.away * 100)}% — ` +
        `blended ${Math.round(MARKET_WEIGHT * 100)}% in.`
    );
  }

  const pick = decide(pH, pD, pA);
  const top = Math.max(pH, pD, pA);
  return {
    homeWin: pH,
    draw: pD,
    awayWin: pA,
    expectedHomeGoals: lh,
    expectedAwayGoals: la,
    likelyScore: best,
    btts: sport.hasDraw ? btts : undefined,
    totalLine: { line: overLine, over },
    hasDraw: sport.hasDraw,
    confidence: confidenceOf(top, sport.hasDraw, h.n + a.n + h2h.length, !!market),
    pick,
    marketBlended: blend.blended,
    rationale,
  };
}

/* ---------------------------- points engine ------------------------------- */
function predictPoints(inp: Inputs): Prediction {
  const { sport, homeForm, awayForm, homeStanding, awayStanding, neutral, market } = inp;
  const avg = sport.avgScore;
  const rationale: string[] = [];
  const squadHome = inp.squadHome ?? 1;
  const squadAway = inp.squadAway ?? 1;

  const h = strength(homeForm, homeStanding, avg);
  const a = strength(awayForm, awayStanding, avg);

  let homeExp = ((h.attack + a.defense) / 2) * squadHome;
  let awayExp = ((a.attack + h.defense) / 2) * squadAway;
  if (!neutral) homeExp += inp.tune?.homeEdge ?? sport.homeEdge; // home-court points

  if (market?.total && market.total > 0) {
    const modelTotal = homeExp + awayExp || 1;
    const scale = clamp(market.total / modelTotal, 0.85, 1.18);
    const applied = 1 + (scale - 1) * 0.6;
    homeExp *= applied;
    awayExp *= applied;
  }

  rationale.push(`Projected points — home ${homeExp.toFixed(0)} vs away ${awayExp.toFixed(0)}.`);
  if (neutral) rationale.push("Neutral court — no home advantage applied.");

  const std = sport.spread ?? 12;
  const margin = homeExp - awayExp;
  let pH = clamp(normalCdf(margin / std), 0.01, 0.99);
  let pA = 1 - pH;

  const blend = blendMarket({ home: pH, draw: 0, away: pA }, market, false, inp.tune?.marketWeight);
  pH = blend.probs.home;
  pA = blend.probs.away;
  if (blend.blended) {
    rationale.push(
      `${market!.provider || "Market"} odds imply ${Math.round(market!.home * 100)}% / ${Math.round(
        market!.away * 100
      )}% — blended ${Math.round(MARKET_WEIGHT * 100)}% in.`
    );
  }

  const total = homeExp + awayExp;
  const line = market?.total ?? Math.round(total * 2) / 2;
  const over = clamp(normalCdf((total - line) / 16), 0.01, 0.99);

  const pick = pH >= pA ? "HOME" : "AWAY";
  return {
    homeWin: pH,
    draw: 0,
    awayWin: pA,
    expectedHomeGoals: homeExp,
    expectedAwayGoals: awayExp,
    likelyScore: { home: Math.round(homeExp), away: Math.round(awayExp) },
    totalLine: { line, over },
    hasDraw: false,
    confidence: confidenceOf(Math.max(pH, pA), false, h.n + a.n, !!market),
    pick,
    marketBlended: blend.blended,
    rationale,
  };
}

/* ----------------------------- sets engine -------------------------------- */
function predictSets(inp: Inputs): Prediction {
  const { homeForm, awayForm, market } = inp;
  const rationale: string[] = [];

  let pH = 0.5;
  if (market) {
    pH = market.home / (market.home + market.away || 1);
    rationale.push(
      `${market.provider || "Market"} odds imply ${Math.round(market.home * 100)}% / ${Math.round(
        market.away * 100
      )}% — the primary signal for this match.`
    );
  } else {
    const hg = homeForm.slice(0, 10);
    const ag = awayForm.slice(0, 10);
    if (hg.length || ag.length) {
      const hw = hg.filter((r) => r.outcome === "W").length;
      const aw = ag.filter((r) => r.outcome === "W").length;
      const hr = (hw + 1) / (hg.length + 2);
      const ar = (aw + 1) / (ag.length + 2);
      pH = hr / (hr + ar);
      rationale.push(`Recent win rate — ${hw}/${hg.length} vs ${aw}/${ag.length} (recent matches).`);
    } else {
      rationale.push("No pre-match odds or recent form available — treating as an even matchup.");
    }
  }
  pH = clamp(pH, 0.05, 0.95);
  const pA = 1 - pH;

  // Best-of-3 set projection from the favourite's edge.
  const fav = Math.max(pH, pA);
  const loserSets = fav > 0.7 ? 0 : 1;
  const likely = pH >= pA ? { home: 2, away: loserSets } : { home: loserSets, away: 2 };

  return {
    homeWin: pH,
    draw: 0,
    awayWin: pA,
    expectedHomeGoals: pH >= pA ? 2 : loserSets,
    expectedAwayGoals: pH >= pA ? loserSets : 2,
    likelyScore: likely,
    hasDraw: false,
    confidence: confidenceOf(fav, false, (homeForm.length + awayForm.length) / 2, !!market),
    pick: pH >= pA ? "HOME" : "AWAY",
    marketBlended: !!market,
    rationale,
  };
}

export function predict(inp: Inputs): Prediction {
  switch (inp.sport.scoring) {
    case "points":
      return predictPoints(inp);
    case "sets":
      return predictSets(inp);
    default:
      return predictGoals(inp);
  }
}
