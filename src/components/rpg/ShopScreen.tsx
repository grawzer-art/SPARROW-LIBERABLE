"use client";

/** RPG — boutique (liste d'articles, prix, FP, achat à l'unité). Commandes : croix + A/B, ou toucher. */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { CONSUMABLES, EQUIPMENT, SHOPS, priceOf } from "@/lib/rpg/bestiary";
import type { PadHandler } from "./BattleScreen";

export function ShopScreen({
  id,
  coins,
  bag,
  owned,
  pad,
  onBuy,
  onClose,
}: {
  id: string;
  coins: number;
  bag: Record<string, number>;
  owned: string[];
  pad: MutableRefObject<PadHandler | null>;
  onBuy: (item: string) => string;
  onClose: () => void;
}) {
  const shop = SHOPS[id];
  const [cur, setCur] = useState(0);
  const [msg, setMsg] = useState(shop?.hello ?? "");
  const list = useRef<HTMLDivElement>(null);
  const items = shop?.items ?? [];
  const n = items.length + 1; // + Quitter

  useEffect(() => {
    list.current?.querySelector(".is-on")?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  const pick = (i: number) => {
    if (i >= items.length) return onClose();
    setMsg(onBuy(items[i]));
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  useEffect(() => {
    pad.current = {
      a: () => pickRef.current(curRef.current),
      b: onClose,
      dir: (d) => {
        if (d === "up" || d === "left") setCur((c) => (c - 1 + n) % n);
        else setCur((c) => (c + 1) % n);
      },
    };
    return () => {
      pad.current = null;
    };
  }, [n, onClose, pad]);
  const curRef = useRef(cur);
  curRef.current = cur;

  if (!shop) return null;
  const sel = items[cur];
  const desc = sel ? (CONSUMABLES[sel]?.desc ?? EQUIPMENT[sel]?.desc) : "Quitter la boutique.";
  return (
    <div className="shop mono" role="dialog" aria-label={shop.name}>
      <header className="shop__top">
        <span>{shop.name}</span>
        <b>{coins} FP</b>
      </header>
      <div ref={list} className="shop__list" role="listbox" aria-label="Articles">
        {items.map((it, i) => {
          const eq = EQUIPMENT[it];
          const have = eq ? owned.includes(it) : (bag[it] ?? 0);
          const price = priceOf(it);
          return (
            <button key={it} type="button" role="option" aria-selected={cur === i} className={`${cur === i ? "is-on" : ""}${price > coins ? " is-dear" : ""}`} onClick={() => (cur === i ? pick(i) : setCur(i))}>
              <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
              <span className="shop__name">{eq?.name ?? CONSUMABLES[it]?.name}</span>
              <small>{eq ? (have ? "POSSÉDÉ" : eq.slot.toUpperCase()) : `×${have}`}</small>
              <b>{price} FP</b>
            </button>
          );
        })}
        <button type="button" role="option" aria-selected={cur === items.length} className={cur === items.length ? "is-on" : ""} onClick={onClose}>
          <span className="gb-cursor">{cur === items.length ? "▶" : ""}</span>
          <span className="shop__name">Quitter</span>
        </button>
      </div>
      <p className="shop__desc">{desc}</p>
      <p className="shop__msg" aria-live="polite">
        <span>{shop.keeper}</span> {msg}
      </p>
    </div>
  );
}
