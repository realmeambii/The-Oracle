import "./States.css";

export function Loading({ label = "Consulting the Oracle…" }: { label?: string }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block panel silver-edge">
      <p className="eyebrow" style={{ color: "var(--loss)" }}>Connection lost</p>
      <p className="muted">{message}</p>
      <p className="faint" style={{ fontSize: ".82rem" }}>
        Public sports APIs can rate-limit or sleep. Try again in a moment.
      </p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 12 }}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="state-block panel">
      <p className="muted">{message}</p>
    </div>
  );
}

export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 132 }} />
      ))}
    </div>
  );
}
