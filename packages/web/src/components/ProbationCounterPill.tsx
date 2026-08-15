// Spec §10.1 — "Warning 3/6" pill, seal-red once count > 0, green/hidden
// text when 0.
export function ProbationCounterPill({ count }: { count: number }) {
  if (count === 0) return <span className="badge ok">Warning 0/6</span>;
  const tone = count >= 3 ? 'danger' : 'warn';
  return (
    <span className={`badge ${tone}`}>
      Warning {count}/6{count >= 3 ? ' · transfer tier' : ''}
    </span>
  );
}
