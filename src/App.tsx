import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import SportSwitcher from "./components/SportSwitcher";
import BottomNav from "./components/BottomNav";
import { LeagueProvider } from "./state/LeagueContext";
import FixturesPage from "./pages/FixturesPage";
import ResultsPage from "./pages/ResultsPage";
import StandingsPage from "./pages/StandingsPage";
import NewsPage from "./pages/NewsPage";
import MatchPage from "./pages/MatchPage";
import ModelPage from "./pages/ModelPage";
import "./App.css";

export default function App() {
  return (
    <LeagueProvider>
      <Header />
      <div className="sport-bar">
        <div className="container">
          <SportSwitcher />
        </div>
      </div>
      <main className="container">
        <Routes>
          <Route path="/" element={<FixturesPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/match/:sport/:leagueId/:id" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container">
          <p className="faint">
            The Oracle · live multi-sport data from ESPN &amp; public feeds · predictions are statistical
            estimates, not betting advice.
          </p>
        </div>
      </footer>
      <BottomNav />
    </LeagueProvider>
  );
}
