/** Small presentation helpers. */

export function matchDateLabel(m: { date: string; time?: string; timestamp?: number }): string {
  const t = m.timestamp ?? (m.date ? Date.parse(`${m.date}T${m.time || "00:00"}`) : NaN);
  if (!Number.isFinite(t)) return m.date || "TBD";
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function matchTimeLabel(m: { date: string; time?: string; timestamp?: number }): string {
  const t = m.timestamp ?? (m.date && m.time ? Date.parse(`${m.date}T${m.time}`) : NaN);
  if (!Number.isFinite(t)) return m.time || "";
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Deterministic monogram colour for a team without a badge. */
export function teamHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
