/** Coffre-fort en SVG : porte, boulons, volant et cadran animés en CSS. */
export type VaultState = "idle" | "trying" | "denied" | "open";

const TICKS = Array.from({ length: 60 }, (_, i) => i);
const BOLTS = Array.from({ length: 8 }, (_, i) => i * 45);
const RIVETS = [
  [22, 22],
  [298, 22],
  [22, 298],
  [298, 298],
  [160, 14],
  [160, 306],
  [14, 160],
  [306, 160],
];

export function Vault({ state, letters }: { state: VaultState; letters: number }) {
  return (
    <div className={`vault vault--${state}`} aria-hidden="true">
      <div className="vault__inside">
        <span className="vault__glow" />
        <span className="vault__count">{letters}</span>
        <span className="vault__countlbl">LETTRE{letters > 1 ? "S" : ""}</span>
      </div>
      <div className="vault__door">
        <svg viewBox="0 0 320 320" className="vault__svg">
          {/* caisson */}
          <rect x="4" y="4" width="312" height="312" rx="10" className="v-body" />
          <rect x="12" y="12" width="296" height="296" rx="6" className="v-bevel" />
          {RIVETS.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.2" className="v-rivet" />
          ))}
          {/* porte */}
          <circle cx="160" cy="160" r="132" className="v-door" />
          <circle cx="160" cy="160" r="122" className="v-ring" />
          {BOLTS.map((a) => (
            <g key={a} transform={`rotate(${a} 160 160)`}>
              <rect x="152" y="22" width="16" height="22" rx="2" className="v-bolt" />
            </g>
          ))}
          {/* volant */}
          <g className="v-wheel">
            {[0, 120, 240].map((a) => (
              <g key={a} transform={`rotate(${a} 160 160)`}>
                <rect x="156" y="70" width="8" height="90" rx="3" className="v-spoke" />
                <circle cx="160" cy="68" r="9" className="v-knob" />
              </g>
            ))}
            <circle cx="160" cy="160" r="70" className="v-wheelring" />
          </g>
          {/* cadran */}
          <g className="v-dial">
            <circle cx="160" cy="160" r="46" className="v-dialface" />
            {TICKS.map((i) => (
              <rect
                key={i}
                x="159.4"
                y={i % 5 === 0 ? 116 : 118}
                width="1.2"
                height={i % 5 === 0 ? 8 : 4}
                transform={`rotate(${i * 6} 160 160)`}
                className={i % 5 === 0 ? "v-tick v-tick--major" : "v-tick"}
              />
            ))}
            {[0, 10, 20, 30, 40, 50].map((n, i) => {
              const a = ((i * 60 - 90) * Math.PI) / 180;
              return (
                <text key={n} x={160 + Math.cos(a) * 31} y={160 + Math.sin(a) * 31 + 3} className="v-num">
                  {n}
                </text>
              );
            })}
            <circle cx="160" cy="160" r="14" className="v-hub" />
          </g>
          <path d="M160 108 l-5 -9 h10 z" className="v-index" />
          {/* voyant + plaque */}
          <circle cx="160" cy="58" r="4" className="v-led" />
          <rect x="96" y="250" width="128" height="24" rx="2" className="v-plate" />
          <text x="160" y="266" className="v-platetxt">
            OUVERTURE 12.10.2031
          </text>
        </svg>
      </div>
    </div>
  );
}
