import { useLeague } from "../state/LeagueContext";
import { useAsync } from "../lib/useAsync";
import { backtest, type SweepResult } from "../lib/backtest";
import { leagueById, SPORTS } from "../api/catalog";
import LeagueSelector from "../components/LeagueSelector";
import ProbBar from "../components/ProbBar";
import TeamBadge from "../components/TeamBadge";
import { Loading, ErrorState, Empty } from "../components/States";
import { pct } from "../lib/format";
import "./ModelPage.css";

export default function ModelPage() {
  const { sport, leagueId } = useLeague();
  const league = leagueById(leagueId);
  const meta = SPORTS[sport];
  const { data, loading, error } = useAsync(() => backtest(sport, leagueId), [sport, leagueId]);

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-hero-top">
          <div>
            <p className="eyebrow">{meta.label} · model report</p>
            <h1>
              Backtest &amp; <span className="accent">Tuning</span>
            </h1>
            <p className="sub">
              The Oracle replayed recent finished {league?.name} matches using only the form known
              <em> before</em> kickoff, then scored every prediction. Lower Brier / log-loss is better.
            </p>
          </div>
        </div>
        <LeagueSelector />
      </div>

      {loading && <Loading label="Replaying finished matches…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && data.n === 0 && (
        <Empty message="Not enough finished matches with results to backtest this competition yet." />
      )}
      {!loading && !error && data && data.n > 0 && (
        <>
          <div className="metric-row">
            <Metric label="Matches tested" value={String(data.n)} />
            <Metric label="Hit rate" value={pct(data.accuracy)} accent good={data.accuracy >= 0.5} />
            <Metric label="Brier score" value={data.brier.toFixed(3)} hint="0 = perfect" />
            <Metric label="Log loss" value={data.logLoss.toFixed(3)} hint="lower is better" />
          </div>

          {data.sweep && <SweepCard sweep={data.sweep} />}

          <div className="panel silver-edge bt-table">
            <div className="bt-head">
              <span>Recent predictions vs actual</span>
              <span className="faint">{data.rows.length} shown</span>
            </div>
            {data.rows.slice(0, 30).map((r) => (
              <div key={r.match.id} className={`bt-row ${r.correct ? "hit" : "miss"}`}>
                <span className={`bt-flag ${r.correct ? "hit" : "miss"}`}>{r.correct ? "✓" : "✗"}</span>
                <div className="bt-fixture">
                  <TeamBadge name={r.match.home.name} badge={r.match.home.badge} size={20} />
                  <span className="bt-score">
                    {r.match.homeScore}–{r.match.awayScore}
                  </span>
                  <TeamBadge name={r.match.away.name} badge={r.match.away.badge} size={20} />
                </div>
                <div className="bt-bar">
                  <ProbBar home={r.predHome} draw={r.predDraw} away={r.predAway} hasDraw={meta.hasDraw} compact />
                </div>
                <span className="bt-actual">{r.actual}</span>
              </div>
            ))}
          </div>

          <p className="faint bt-note">
            A quick walk-forward backtest over the recent window — useful for sanity-checking and tuning, not a
            long-run guarantee. Bookmaker odds aren't included here (ESPN drops them once a game finishes), so
            this measures the model's standalone skill. Predictions are for analysis, not betting.
          </p>
        </>
      )}
    </div>
  );
}

function SweepCard({ sweep }: { sweep: SweepResult }) {
  const max = Math.max(...sweep.values.map((c) => c.logLoss));
  const min = Math.min(...sweep.values.map((c) => c.logLoss));
  const fmt = (v: number) => (sweep.unit === "×" ? `${v.toFixed(2)}×` : `+${v.toFixed(1)}`);
  const improved = Math.abs(sweep.best - sweep.current) > (sweep.unit === "×" ? 0.015 : 0.3);

  return (
    <div className="panel silver-edge calib">
      <div className="bt-head">
        <span>{sweep.param} tuning</span>
        <span className="faint">log-loss by value</span>
      </div>
      <p className="calib-intro faint">
        Re-scoring every match across candidate {sweep.param.toLowerCase()} values. Current setting{" "}
        <b>{fmt(sweep.current)}</b>; backtest optimum for this sample{" "}
        <b className="calib-best">{fmt(sweep.best)}</b>
        {improved ? " — worth nudging toward." : " — current setting is already near-optimal."}
      </p>
      <div className="calib-bars">
        {sweep.values.map((c) => {
          const isBest = c.v === sweep.best;
          const isCurrent = Math.abs(c.v - sweep.current) < 1e-6;
          const h = 16 + (1 - (c.logLoss - min) / (max - min || 1)) * 84;
          return (
            <div
              key={c.v}
              className={`calib-col ${isBest ? "best" : ""} ${isCurrent ? "current" : ""}`}
              title={`${fmt(c.v)} · log-loss ${c.logLoss.toFixed(3)} · hit ${pct(c.accuracy)}`}
            >
              <span className="calib-loss">{c.logLoss.toFixed(2)}</span>
              <span className="calib-bar" style={{ height: `${h}px` }} />
              <span className="calib-w">{sweep.unit === "×" ? c.v.toFixed(2) : `+${c.v.toFixed(1)}`}</span>
            </div>
          );
        })}
      </div>
      <p className="faint calib-axis">{sweep.param} value →</p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  good?: boolean;
}) {
  return (
    <div className={`metric panel silver-edge ${accent ? "accent" : ""}`}>
      <span className="faint metric-label">{label}</span>
      <strong className={`metric-value ${good ? "good" : ""}`}>{value}</strong>
      {hint && <span className="faint metric-hint">{hint}</span>}
    </div>
  );
}
