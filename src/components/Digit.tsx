"use client";

import { memo, useRef } from "react";

/** Chiffre animé : l'ancien glisse vers le bas, le nouveau tombe d'en haut. */
function DigitImpl({ value, dim = false }: { value: string; dim?: boolean }) {
  const prev = useRef(value);
  const gen = useRef(0);
  const last = useRef(value);
  if (last.current !== value) {
    prev.current = last.current;
    last.current = value;
    gen.current += 1;
  }
  const changed = gen.current > 0;
  return (
    <span className={`digit${dim ? " digit--dim" : ""}`} aria-hidden="true">
      <span className="digit__sizer">0</span>
      {changed && (
        <span key={`o${gen.current}`} className="digit__glyph digit__glyph--out">
          {prev.current}
        </span>
      )}
      <span key={`i${gen.current}`} className={`digit__glyph${changed ? " digit__glyph--in" : ""}`}>
        {value}
      </span>
    </span>
  );
}

export const Digit = memo(DigitImpl);
