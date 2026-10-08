// Graphiques légers en SVG (aucune dépendance) pour le tableau de bord.
const DARK = "#1A6FD4";
const LIGHT = "#A9CDF5";

// Courbe remplie (tendance sur quelques points).
export function Sparkline({ values }: { values: number[] }) {
  const width = 90;
  const height = 36;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, i) => [i * step, height - 2 - (value / max) * (height - 6)]);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-24" aria-hidden>
      <defs>
        <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={DARK} stopOpacity="0.25" />
          <stop offset="100%" stopColor={DARK} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#sparkline-fill)" />
      <path d={line} fill="none" stroke={DARK} strokeWidth="1.8" />
    </svg>
  );
}

// Petites barres (la plus haute en couleur foncée).
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-9 items-end gap-1" aria-hidden>
      {values.map((value, i) => (
        <div
          key={i}
          className="w-2.5 rounded-sm"
          style={{
            height: `${Math.max((value / max) * 100, 8)}%`,
            backgroundColor: value === max && value > 0 ? DARK : LIGHT,
          }}
        />
      ))}
    </div>
  );
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// Histogramme mensuel à deux séries (une barre par mois, alternance foncé / clair).
export function MonthlyBars({ primary, secondary }: { primary: number[]; secondary: number[] }) {
  const max = Math.max(...primary, ...secondary, 1);
  const ticks = [max, Math.round((max * 3) / 4), Math.round(max / 2), Math.round(max / 4), 0];
  return (
    <div className="flex h-56 gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-xs text-zinc-400">
        {ticks.map((tick, i) => (
          <span key={i}>{tick}</span>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-2 border-t border-zinc-100">
        {MONTHS.map((month, i) => (
          <div key={month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t-md"
                style={{ height: `${(primary[i] / max) * 100}%`, backgroundColor: DARK }}
                title={`${primary[i]} consultation(s)`}
              />
              <div
                className="w-1/2 rounded-t-md"
                style={{ height: `${(secondary[i] / max) * 100}%`, backgroundColor: LIGHT }}
                title={`${secondary[i]} examen(s)`}
              />
            </div>
            <span className="text-xs text-zinc-400">{month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Jauge en demi-cercle faite de segments arrondis.
export function SegmentGauge({ done, pending }: { done: number; pending: number }) {
  const total = done + pending;
  const segments = 22;
  const filled = total > 0 ? Math.round((done / total) * segments) : 0;
  const cx = 130;
  const cy = 125;
  return (
    <svg viewBox="0 0 260 140" className="w-full max-w-[280px]" aria-hidden>
      {Array.from({ length: segments }, (_, i) => {
        const angle = Math.PI - (i / (segments - 1)) * Math.PI;
        const x1 = cx + Math.cos(angle) * 82;
        const y1 = cy - Math.sin(angle) * 82;
        const x2 = cx + Math.cos(angle) * 115;
        const y2 = cy - Math.sin(angle) * 115;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i < filled ? DARK : LIGHT}
            strokeWidth="9"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

// Camembert à deux parts (+ éventuellement une troisième grise).
export function Pie({ slices }: { slices: { value: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) {
    return <div className="h-40 w-40 rounded-full bg-zinc-100" aria-hidden />;
  }
  let start = -Math.PI / 2;
  const radius = 80;
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40" aria-hidden>
      {slices
        .filter((slice) => slice.value > 0)
        .map((slice, i, visible) => {
          if (visible.length === 1) return <circle key={i} cx="80" cy="80" r={radius} fill={slice.color} />;
          const angle = (slice.value / total) * Math.PI * 2;
          const end = start + angle;
          const path = `M80,80 L${80 + radius * Math.cos(start)},${80 + radius * Math.sin(start)} A${radius},${radius} 0 ${
            angle > Math.PI ? 1 : 0
          } 1 ${80 + radius * Math.cos(end)},${80 + radius * Math.sin(end)} Z`;
          start = end;
          return <path key={i} d={path} fill={slice.color} />;
        })}
    </svg>
  );
}

export const CHART_COLORS = { dark: DARK, light: LIGHT };
