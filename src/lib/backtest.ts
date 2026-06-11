import type { MarketOdds, Match, Sport, SportKind, TeamResult } from "../types";
import { SPORTS } from "../api/catalog";
import { fetchLeagueEvents, teamResultsFrom, h2hFromForm } from "../api/espn";
import { predict } from "./predict";

/**
 * Walk-forward backtest: replays finished fixtures through the model using only
 * the form known *before* each kickoff, then scores the predictions.
 *
 * Metrics:
 *  • accuracy — share of matches whose most-likely outcome was correct
 *  • Brier    — mean squared error of the probability vector (lower = better)
 *  • logLoss  — mean negative log-likelihood of the actual result (lower = better)
 *
 * It also tunes the model's home-advantage parameter against these results: the
 * sweep re-scores every match across candidate values and reports the optimum.
 * (Bookmaker odds can't be backtested — ESPN strips odds from finished games —
 * so tuning targets the model's own parameters, which need no odds.)
 */

type Outcome = "HOME" | "DRAW" | "AWAY";

export interface BacktestRow {
  match: Match;
  predHome: number;
  predDraw: number;
  predAway: number;
  actual: Outcome;
  correct: boolean;
}

export interface SweepResult {
  param: string;
  unit: string;
  current: number;
  best: number;
  values: { v: number; logLoss: number; accuracy: number }[];
}

export interface BacktestResult {
  n: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  rows: BacktestRow[];
  sweep: SweepResult | null;
}

interface Sample {
  homeForm: TeamResult[];
  awayForm: TeamResult[];
  h2h: TeamResult[];
  neutral?: boolean;
  market?: MarketOdds;
  actual: Outcome;
}

function outcomeOf(m: Match): Outcome {
  const h = m.homeScore ?? 0;
  const a = m.awayScore ?? 0;
  return h > a ? "HOME" : h < a ? "AWAY" : "DRAW";
}

function probOf(p: { homeWin: number; draw: number; awayWin: number }, o: Outcome): number {
  return o === "HOME" ? p.homeWin : o === "AWAY" ? p.awayWin : p.draw;
}

function candidates(meta: Sport): number[] {
  if (meta.scoring === "goals") {
    const out: number[] = [];
    for (let v = 1.0; v <= 1.301; v += 0.03) out.push(Math.round(v * 100) / 100);
    return out;
  }
  if (meta.scoring === "points") {
    const out: number[] = [];
    for (let v = 0; v <= 6.01; v += 0.6) out.push(Math.round(v * 10) / 10);
    return out;
  }
  return [];
}

export async function backtest(sport: SportKind, league: string, limit = 60): Promise<BacktestResult> {
  const meta = SPORTS[sport];
  const events = await fetchLeagueEvents(sport, league, meta.hasDraw, { back: 120, fwd: 5 });
  const finished = events
    .filter((m) => m.status === "finished" && m.homeScore != null && m.awayScore != null)
    .sort((x, y) => (y.timestamp ?? 0) - (x.timestamp ?? 0))
    .slice(0, limit);

  const rows: BacktestRow[] = [];
  const samples: Sample[] = [];
  let brier = 0;
  let logLoss = 0;
  let correct = 0;

  for (const m of finished) {
    const cutoff = m.timestamp ?? Date.parse(m.date);
    const prior = events.filter((e) => e.status === "finished" && (e.timestamp ?? 0) < cutoff);
    const homeForm = teamResultsFrom(prior, m.home.id);
    const awayForm = teamResultsFrom(prior, m.away.id);
    const h2h = h2hFromForm(homeForm, m.away.id);
    const actual = outcomeOf(m);

    const p = predict({ sport: meta, homeForm, awayForm, h2h, neutral: m.neutral, market: m.odds });

    const yH = actual === "HOME" ? 1 : 0;
    const yD = actual === "DRAW" ? 1 : 0;
    const yA = actual === "AWAY" ? 1 : 0;
    brier += (p.homeWin - yH) ** 2 + (p.draw - yD) ** 2 + (p.awayWin - yA) ** 2;
    logLoss += -Math.log(Math.max(probOf(p, actual), 1e-6));
    const isCorrect = p.pick === actual;
    if (isCorrect) correct++;

    samples.push({ homeForm, awayForm, h2h, neutral: m.neutral, market: m.odds, actual });
    rows.push({ match: m, predHome: p.homeWin, predDraw: p.draw, predAway: p.awayWin, actual, correct: isCorrect });
  }

  // Tune home advantage against the same results (form-only, no odds needed).
  let sweep: SweepResult | null = null;
  const cands = candidates(meta);
  if (samples.length >= 8 && cands.length) {
    const values: { v: number; logLoss: number; accuracy: number }[] = [];
    let best = cands[0];
    let bestLL = Infinity;
    for (const v of cands) {
      let ll = 0;
      let hit = 0;
      for (const s of samples) {
        const p = predict({
          sport: meta,
          homeForm: s.homeForm,
          awayForm: s.awayForm,
          h2h: s.h2h,
          neutral: s.neutral,
          market: s.market,
          tune: { homeEdge: v },
        });
        ll += -Math.log(Math.max(probOf(p, s.actual), 1e-6));
        if (p.pick === s.actual) hit++;
      }
      ll /= samples.length;
      values.push({ v, logLoss: ll, accuracy: hit / samples.length });
      if (ll < bestLL) {
        bestLL = ll;
        best = v;
      }
    }
    sweep = {
      param: "Home advantage",
      unit: meta.scoring === "goals" ? "×" : "pts",
      current: meta.homeEdge,
      best,
      values,
    };
  }

  const n = rows.length;
  return {
    n,
    accuracy: n ? correct / n : 0,
    brier: n ? brier / n : 0,
    logLoss: n ? logLoss / n : 0,
    rows,
    sweep,
  };
}
