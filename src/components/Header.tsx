import { NavLink } from "react-router-dom";
import "./Header.css";

export default function Header() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 64 64" width="30" height="30">
              <circle cx="32" cy="32" r="20" fill="none" stroke="url(#bg)" strokeWidth="3.5" />
              <circle cx="32" cy="32" r="6.5" fill="url(#bg)" />
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#e9edf2" />
                  <stop offset="0.6" stopColor="#9aa3ad" />
                  <stop offset="1" stopColor="#3da9fc" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="brand-text">
            THE <strong>ORACLE</strong>
          </span>
        </NavLink>

        <nav className="site-nav">
          <NavLink to="/" end className="nav-link">
            Fixtures
          </NavLink>
          <NavLink to="/results" className="nav-link">
            Results
          </NavLink>
          <NavLink to="/standings" className="nav-link">
            Tables
          </NavLink>
          <NavLink to="/news" className="nav-link">
            News
          </NavLink>
          <NavLink to="/model" className="nav-link">
            Model
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
