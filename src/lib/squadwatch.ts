import type { NewsItem, SquadNote } from "../types";

/**
 * Squad Watch — an availability & morale signal.
 *
 * Real-time scraping of athletes' personal social accounts isn't feasible
 * keylessly (and is privacy/ToS-fraught), so this reads the live news wire for
 * *major* life/availability updates that plausibly affect performance —
 * injuries, suspensions, bereavements/personal leave, locker-room unrest and
 * unsettling transfer sagas — and maps them to a small strength adjustment.
 *
 * The classifier is deliberately conservative: only clearly impactful keywords
 * count, and the total swing per side is capped. The data source is pluggable —
 * a curated override list or a real social feed can be merged in later.
 */

interface Rule {
  kind: SquadNote["kind"];
  impact: number; // per match, negative hurts
  words: string[];
}

const RULES: Rule[] = [
  { kind: "injury", impact: -0.06, words: ["injury", "injured", "ruled out", "sidelined", "out for", "hamstring", "acl", "surgery", "knock", "doubtful", "fitness doubt", "torn"] },
  { kind: "suspension", impact: -0.055, words: ["suspended", "suspension", "banned", "ban", "red card", "sent off", "ineligible"] },
  { kind: "personal", impact: -0.05, words: ["bereavement", "passed away", "death of", "family reasons", "personal reasons", "personal leave", "mourning", "illness", "hospital"] },
  { kind: "morale", impact: -0.035, words: ["crisis", "sacked", "dressing-room", "locker room", "unrest", "fallout", "bust-up", "training-ground", "rift", "axed", "turmoil"] },
  { kind: "transfer", impact: -0.025, words: ["unsettled", "wants to leave", "hand in transfer", "transfer request", "exit", "future in doubt", "saga"] },
];

const POSITIVE = { impact: 0.04, words: ["returns", "back in training", "fit again", "passed fit", "available again", "boost", "cleared to play", "recovered"] };

const CAP_NEG = -0.18;
const CAP_POS = 0.12;

function mentionsTeam(text: string, team: string): boolean {
  const t = text.toLowerCase();
  if (t.includes(team.toLowerCase())) return true;
  // also match the most distinctive word (e.g. "United", "Lakers")
  const tokens = team.split(/\s+/).filter((w) => w.length > 3 && !/^(the|club|city|fc|afc)$/i.test(w));
  return tokens.some((w) => t.includes(w.toLowerCase()));
}

export interface SquadSignal {
  notes: SquadNote[];
  /** Strength multiplier to apply to the side's attack (≈ 0.82 – 1.12). */
  multiplier: number;
}

function analyseSide(items: NewsItem[], team: string, side: "home" | "away"): SquadSignal {
  const notes: SquadNote[] = [];
  let impact = 0;
  for (const item of items) {
    // Match on the headline only — precise attribution, far fewer false positives.
    if (!mentionsTeam(item.title, team)) continue;
    const lower = item.title.toLowerCase();

    let matched: Rule | null = null;
    for (const r of RULES) {
      if (r.words.some((w) => lower.includes(w))) {
        matched = r;
        break;
      }
    }
    const positive = POSITIVE.words.some((w) => lower.includes(w));

    if (matched) {
      impact += matched.impact;
      notes.push({
        side,
        team,
        kind: matched.kind,
        text: item.title,
        impact: matched.impact,
        source: item.source,
        link: item.link,
      });
    } else if (positive) {
      impact += POSITIVE.impact;
      notes.push({ side, team, kind: "morale", text: item.title, impact: POSITIVE.impact, source: item.source, link: item.link });
    }
    if (notes.length >= 4) break;
  }
  const clamped = Math.max(CAP_NEG, Math.min(CAP_POS, impact));
  return { notes, multiplier: 1 + clamped };
}

export function squadWatch(
  news: NewsItem[],
  homeTeam: string,
  awayTeam: string
): { home: SquadSignal; away: SquadSignal } {
  return {
    home: analyseSide(news, homeTeam, "home"),
    away: analyseSide(news, awayTeam, "away"),
  };
}
