interface Props {
  /** e.g. "WWDLW" or array of outcomes; newest can be first or last per `reverse`. */
  form: string | ("W" | "D" | "L")[];
  max?: number;
}

/** Compact W/D/L form indicator. */
export default function FormDots({ form, max = 5 }: Props) {
  const arr = (typeof form === "string" ? form.split("") : form)
    .filter((c) => c === "W" || c === "D" || c === "L")
    .slice(0, max) as ("W" | "D" | "L")[];

  if (!arr.length) return <span className="faint" style={{ fontSize: ".78rem" }}>—</span>;

  return (
    <span className="form-row">
      {arr.map((c, i) => (
        <span key={i} className={`form-dot ${c}`} title={c === "W" ? "Win" : c === "D" ? "Draw" : "Loss"}>
          {c}
        </span>
      ))}
    </span>
  );
}
