/** Marque textuelle neutre. Le logo officiel LECA n'est pas fourni : aucun logo n'est inventé. */
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'wordmark wordmark--sm' : 'wordmark'}>
      <span className="wordmark__brand">LECA</span>
      <span className="wordmark__hq">HQ</span>
    </span>
  );
}
