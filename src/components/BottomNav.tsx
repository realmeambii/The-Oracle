import { NavLink } from "react-router-dom";
import "./BottomNav.css";

const ITEMS = [
  { to: "/", end: true, label: "Fixtures", icon: CalendarIcon },
  { to: "/results", end: false, label: "Scores", icon: ScoresIcon },
  { to: "/standings", end: false, label: "Tables", icon: TableIcon },
  { to: "/news", end: false, label: "News", icon: NewsIcon },
  { to: "/model", end: false, label: "Model", icon: TargetIcon },
];

/** App-style bottom tab bar shown on phones. */
export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map(({ to, end, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={end} className="bn-item">
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...P}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
function ScoresIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...P}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M3.6 9.5h16.8M3.6 14.5h16.8" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...P}>
      <path d="M4 6h16M4 12h16M4 18h16M9 6v12" />
    </svg>
  );
}
function NewsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...P}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 9h7M7 12.5h7M7 16h4" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...P}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
