"use client";

import { useEffect, useRef, useState } from "react";
import { greeting, pickBulletin } from "@/data/messages";
import { formatClock, now, type Remaining } from "@/lib/time";
import { parisHour } from "@/lib/calendar";

interface Line {
  id: number;
  stamp: string;
  text: string;
}

const ROTATE_MS = 7000;

/** Fil de surveillance : bulletins aléatoires tapés façon terminal. */
export function Feed({ r, fx }: { r: Remaining | null; fx: boolean }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState(0);
  const recent = useRef<number[]>([]);
  const rRef = useRef(r);
  rRef.current = r;
  const ready = r != null;

  useEffect(() => {
    if (!ready) return;
    let id = 0;
    const push = (text: string) => {
      id += 1;
      setLines((ls) => [{ id, stamp: formatClock(now()), text }, ...ls].slice(0, 4));
      setTyped(0);
    };
    push(greeting(parisHour(now())));
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || !rRef.current) return;
      const b = pickBulletin(rRef.current, recent.current);
      recent.current = [b.index, ...recent.current].slice(0, 12);
      push(b.text);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [ready]);

  const current = lines[0];
  useEffect(() => {
    if (!current) return;
    if (!fx) {
      setTyped(current.text.length);
      return;
    }
    if (typed >= current.text.length) return;
    const t = setTimeout(() => setTyped((n) => Math.min(current.text.length, n + 2)), 22);
    return () => clearTimeout(t);
  }, [current, typed, fx]);

  return (
    <section className="feed reveal" style={{ ["--d" as string]: "0.75s" }} aria-label="Fil de surveillance">
      <header className="feed__head mono">
        <span className="feed__live">
          <i /> EN DIRECT
        </span>
        <span>FIL DE SURVEILLANCE · MIN. DU CALENDRIER</span>
      </header>
      <div className="feed__body mono" aria-live="polite" aria-atomic="false">
        {lines.length === 0 && <p className="feed__line">&gt; Connexion au fil…</p>}
        {lines.map((l, i) => (
          <p key={l.id} className={`feed__line${i === 0 ? " feed__line--now" : ""}`} style={{ opacity: i === 0 ? 1 : 0.55 - i * 0.12 }}>
            <span className="feed__stamp">[{l.stamp}]</span>{" "}
            {i === 0 ? (
              <>
                <span aria-hidden="true">{l.text.slice(0, typed)}</span>
                <span className="feed__cursor" aria-hidden="true" />
                <span className="sr-only">{l.text}</span>
              </>
            ) : (
              l.text
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
