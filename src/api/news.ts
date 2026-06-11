import type { NewsItem, SportKind } from "../types";

/**
 * News from ESPN's public news API (keyless, CORS-enabled). Scoped to the
 * selected sport so each section shows relevant headlines & transfer rumours.
 */
const SITE = "https://site.api.espn.com/apis/site/v2/sports";

interface RawArticle {
  headline: string;
  description?: string;
  published?: string;
  links?: { web?: { href?: string } };
}

async function fetchFeed(sport: SportKind, league: string, label: string): Promise<NewsItem[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`${SITE}/${sport}/${league}/news?limit=30`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const json = (await res.json()) as { articles?: RawArticle[] };
    return (json.articles || [])
      .filter((a) => a.headline && a.links?.web?.href)
      .map((a) => ({ title: a.headline, link: a.links!.web!.href!, source: label, date: a.published, summary: a.description }));
  } catch {
    return [];
  }
}

const SPORT_LABEL: Record<SportKind, string> = {
  soccer: "ESPN FC",
  basketball: "ESPN NBA",
  hockey: "ESPN NHL",
  tennis: "ESPN Tennis",
};

/** News for the active sport: the league feed plus the sport-wide feed. */
export async function fetchNews(sport: SportKind, league: string): Promise<NewsItem[]> {
  const feeds: Promise<NewsItem[]>[] = [fetchFeed(sport, league, SPORT_LABEL[sport])];
  if (league !== "all") feeds.push(fetchFeed(sport, "all", SPORT_LABEL[sport]));
  const batches = await Promise.all(feeds);
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  for (const item of batches.flat()) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    all.push(item);
  }
  all.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  return all.slice(0, 48);
}

const TRANSFER_KW = [
  "transfer", "sign", "signing", "deal", "move", "loan", "fee", "bid", "agree",
  "join", "contract", "rumor", "rumour", "target", "swoop", "linked", "trade", "waive",
];

export function filterTransfers(items: NewsItem[]): NewsItem[] {
  const hits = items.filter((i) => {
    const t = `${i.title} ${i.summary || ""}`.toLowerCase();
    return TRANSFER_KW.some((k) => t.includes(k));
  });
  return hits.length ? hits : items;
}
