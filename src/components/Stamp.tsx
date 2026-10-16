/** Tampon encré, bords irréguliers via un masque de bruit SVG. */
export function Stamp({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`stamp ${className}`} aria-hidden="true">
      <span className="stamp__inner">{children}</span>
    </span>
  );
}
