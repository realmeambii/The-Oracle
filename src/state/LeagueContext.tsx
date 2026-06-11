import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SportKind } from "../types";
import { defaultLeagueFor, leagueById, SPORT_ORDER } from "../api/catalog";

interface Ctx {
  sport: SportKind;
  leagueId: string;
  setSport: (s: SportKind) => void;
  setLeagueId: (id: string) => void;
}

const SportCtx = createContext<Ctx>({
  sport: "soccer",
  leagueId: defaultLeagueFor("soccer"),
  setSport: () => {},
  setLeagueId: () => {},
});

const STORE = "oracle.selection";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ sport: SportKind; leagueId: string }>(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw) as { sport: SportKind; leagueId: string };
        if (SPORT_ORDER.includes(parsed.sport) && leagueById(parsed.leagueId)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return { sport: "soccer", leagueId: defaultLeagueFor("soccer") };
  });

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify(state));
  }, [state]);

  const setSport = (s: SportKind) => setState({ sport: s, leagueId: defaultLeagueFor(s) });
  const setLeagueId = (id: string) => setState((prev) => ({ ...prev, leagueId: id }));

  return (
    <SportCtx.Provider value={{ sport: state.sport, leagueId: state.leagueId, setSport, setLeagueId }}>
      {children}
    </SportCtx.Provider>
  );
}

export function useLeague() {
  return useContext(SportCtx);
}
