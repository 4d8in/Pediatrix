// Logo Pédiatrix : soleil stylisé (SVG local, aucune ressource distante).
// Même dessin que l'icône de l'application (build/icon.svg).
interface LogoProps {
  className?: string;
}

function Rays({ color, width }: { color: string; width: number }) {
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <line
          key={i}
          x1="24"
          y1="17"
          x2="24"
          y2="8"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          transform={`rotate(${i * 22.5} 24 24)`}
        />
      ))}
    </>
  );
}

// Soleil seul, dans la couleur du texte courant.
export function LogoMark({ className }: LogoProps) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className}>
      <Rays color="currentColor" width={2.6} />
    </svg>
  );
}

// Logo complet : soleil blanc sur pastille bleue (icône de l'application).
export function LogoBadge({ className }: LogoProps) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className}>
      <defs>
        <linearGradient id="pediatrix-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2F86E8" />
          <stop offset="1" stopColor="#1557A8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23.25" fill="url(#pediatrix-logo-bg)" />
      <Rays color="#FFFFFF" width={2.8} />
    </svg>
  );
}
