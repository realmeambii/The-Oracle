# The Oracle ⚪️🔵

A real-time **sports analysis & match-outcome predictor** built with React + TypeScript + Vite.
The Oracle pulls live fixtures, recent results, league tables, head-to-head history and transfer
news from public sports APIs, then computes a prediction for each fixture.

> ⚠️ Predictions are statistical estimates for entertainment/analysis — **not betting advice**.

## Features

- **Live fixtures** and **recent results** (last 3 / 7 / 14 days) across 8 major leagues.
- **Match predictions** — a Poisson goal model blended with recent form, league standing and
  head-to-head history. Each prediction shows win/draw/loss probabilities, a most-likely scoreline,
  expected goals, a confidence dial and the factors behind it.
- **League tables** with form indicators.
- **Transfers & news** aggregated from The Guardian, BBC Sport, ESPN and Sky Sports.
- **Fully responsive**, black / white / silver design with electric-blue accents.

## Data sources (all free & public)

| Data | Source |
| --- | --- |
| Fixtures, live scores, results, standings, team logos, form & H2H | **ESPN public site API** (`site.api.espn.com`) — keyless & CORS-enabled |
| Transfer / football news | **ESPN news API** across the World Cup and Europe's top leagues |

Each team's recent form is pulled from ESPN's aggregated team schedule, so it works for clubs and
national teams (qualifiers, friendlies, finals) alike — which is why World Cup predictions are
grounded in real qualifying form even before a ball is kicked.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173). **No API key required** — every data
source is public and keyless.

## How the prediction works

1. **Team strength** — recency-weighted, blowout-capped goals scored/conceded from the last ~8 games,
   blended with season-long standings rates, then expressed as attack/defence strength *relative to the
   league average*.
2. **Shrinkage** — thin-sample estimates are pulled toward the league mean (empirical Bayes), so a side
   with only two games isn't treated as world-beating.
3. **Expected goals (λ)** — `leagueAvg × homeAttack × awayDefence × homeAdvantage` (home advantage is
   dropped at neutral venues such as the World Cup), then nudged by current form and head-to-head.
4. **Dixon–Coles Poisson grid** — a scoreline grid with the Dixon–Coles low-score correction (fixing
   Poisson's under-prediction of draws / 0-0 / 1-1) yields win/draw/loss, BTTS, Over 2.5 and the single
   most-likely scoreline. Computed with an O(N) PMF recurrence — no per-cell `factorial`/`pow`.
5. **Market blend** — when ESPN exposes bookmaker odds, the de-vigged moneyline is blended into the 1X2
   result and expected goals are pulled toward the Over/Under line. Falls back cleanly to the pure model.
6. **Confidence** — scales with how decisive the favourite is, how much data was available, and whether a
   market signal was present.

See [`src/lib/predict.ts`](src/lib/predict.ts).

## Project structure

```
src/
  api/        ESPN + news clients, league catalogue
  components/ Reusable UI (MatchCard, ProbBar, FormDots, TeamBadge, …)
  lib/        Prediction engine, formatting, async hook
  pages/      Fixtures, Results, Standings, News, Match detail
  state/      Selected-league context
  styles/     Global theme (CSS variables)
```

## Build

```bash
npm run build && npm run preview
```
