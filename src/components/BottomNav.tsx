"use client";

import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; short?: string; icon: React.ReactNode }[] = [
  {
    href: "/",
    label: "Accueil",
    icon: (
      <path d="M4 4h11l5 5v11H4zM15 4v5h5M8 13h8M8 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    ),
  },
  {
    href: "/jeu",
    label: "Jeu",
    icon: (
      <path
        d="M7 8h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-2a4 4 0 0 1 4-4zM8 10v4M6 12h4M15.5 11.2h.01M17.5 13h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/capsule",
    label: "Capsule 2031",
    short: "Capsule",
    icon: (
      <>
        <rect x="3.5" y="4" width="17" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="11.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v1.4M12 13.6V15M8.5 11.5h1.4M14.1 11.5h1.4M6 19v1.5M18 19v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/gazette",
    label: "Gazette",
    icon: (
      <path
        d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2h-1M7 8.5h7M7 12h7M7 15.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/don",
    label: "Don",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.6 0-2.8.9-2.8 2.1 0 2.8 5.8 1.4 5.8 4.1 0 1.2-1.2 2.1-3 2.1-1.2 0-2.3-.5-2.9-1.3M12 6.5V8M12 16.3v1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
];

/** Navigation principale mobile (onglets en bas d'écran). */
export function BottomNav() {
  const path = usePathname() || "/";
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <a key={t.href} href={t.href} className={`tabbar__tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {t.icon}
            </svg>
            <span className="mono tabbar__long">{t.label}</span>
            {t.short && <span className="mono tabbar__short">{t.short}</span>}
          </a>
        );
      })}
    </nav>
  );
}
