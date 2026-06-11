import { SPORTS, SPORT_ORDER } from "../api/catalog";
import { useLeague } from "../state/LeagueContext";
import "./SportSwitcher.css";

export default function SportSwitcher() {
  const { sport, setSport } = useLeague();
  return (
    <div className="sport-switcher" role="tablist" aria-label="Select sport">
      {SPORT_ORDER.map((kind) => {
        const s = SPORTS[kind];
        const active = kind === sport;
        return (
          <button
            key={kind}
            role="tab"
            aria-selected={active}
            className={`sport-tab ${active ? "active" : ""}`}
            onClick={() => setSport(kind)}
          >
            <span className="sport-icon" aria-hidden>
              {s.icon}
            </span>
            <span className="sport-label">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
