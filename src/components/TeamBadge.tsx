import { useState } from "react";
import { teamHue } from "../lib/format";
import "./TeamBadge.css";

interface Props {
  name: string;
  badge?: string;
  size?: number;
}

/** Team crest with a generated monogram fallback when no badge is available. */
export default function TeamBadge({ name, badge, size = 34 }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.4 } as const;

  if (badge && !failed) {
    return (
      <img
        className="team-badge"
        style={{ width: size, height: size }}
        src={badge}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const hue = teamHue(name);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="team-badge monogram"
      style={{
        ...style,
        background: `linear-gradient(135deg, hsl(${hue} 14% 30%), hsl(${hue} 18% 16%))`,
      }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
