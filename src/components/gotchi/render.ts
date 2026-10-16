import { bake } from "../game/sprites";
import type { Mood } from "@/lib/gotchi/engine";
import { PROPS, sparrow, type Body, type Eyes, type Mouth } from "./sprites";

export type Anim =
  | "frites"
  | "salade"
  | "dofus"
  | "sieste"
  | "douche"
  | "parler"
  | "refus"
  | "rage"
  | "drop"
  | "crise"
  | "gras"
  | "event";

export const LCD_W = 64;
export const LCD_H = 44;
const GROUND = 40;

const cache = new Map<string, HTMLCanvasElement>();
function sprite(key: string, rows: () => string[]) {
  let c = cache.get(key);
  if (!c) {
    c = bake(rows());
    cache.set(key, c);
  }
  return c;
}
const hero = (e: Eyes, m: Mouth, b: Body) => sprite(`h:${e}:${m}:${b}`, () => sparrow(e, m, b));
const prop = (k: keyof typeof PROPS | string) => sprite(`p:${k}`, () => PROPS[k]);

function z(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#090909";
  ctx.fillRect(x, y, s, 1);
  for (let i = 1; i < s - 1; i++) ctx.fillRect(x + s - 1 - i, y + i, 1, 1);
  ctx.fillRect(x, y + s - 1, s, 1);
}

export interface Scene {
  mood: Mood;
  anim: Anim | null;
  /** Action à l'origine d'un refus (pour savoir quel objet jeter). */
  refusOf?: string;
  animT: number; // secondes depuis le début de l'animation
  t: number; // horloge globale (s)
}

export class GotchiRenderer {
  private x = LCD_W / 2 - 8;
  private dir = 1;
  private nextTurn = 0;

  draw(ctx: CanvasRenderingContext2D, sc: Scene) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, LCD_W, LCD_H);
    const { mood, anim, animT, t } = sc;
    const frame = Math.floor(t * 4) % 2;
    const fast = Math.floor(t * 8) % 2;

    // Sol pointillé
    ctx.fillStyle = "rgba(9,9,9,0.35)";
    for (let x = 1; x < LCD_W; x += 3) ctx.fillRect(x, GROUND, 1, 1);

    // Déplacement (il se balade quand il ne fait rien)
    const idle = !anim && (mood === "content" || mood === "neutre" || mood === "affame");
    if (idle) {
      if (t > this.nextTurn) {
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.nextTurn = t + 2 + Math.random() * 3;
      }
      this.x += this.dir * 0.12;
      if (this.x < 4 || this.x > LCD_W - 20) {
        this.dir *= -1;
        this.x = Math.max(4, Math.min(LCD_W - 20, this.x));
      }
    } else this.x += (LCD_W / 2 - 8 - this.x) * 0.15;

    let eyes: Eyes = "lunettes";
    let mouth: Mouth = "neutre";
    let body: Body = "normal";
    let shake = 0;
    let bob = frame;

    switch (mood) {
      case "content":
        mouth = "sourire";
        break;
      case "affame":
        mouth = frame ? "ouverte" : "triste";
        break;
      case "creve":
        eyes = Math.floor(t * 1.5) % 3 === 0 ? "fermes" : "lunettes";
        bob = 0;
        break;
      case "deprime":
        eyes = "triste";
        mouth = "triste";
        bob = 0;
        break;
      case "gras":
        body = "gras";
        mouth = "mache";
        break;
      case "focus":
        eyes = "focus";
        body = "manette";
        bob = 0;
        break;
      case "rage":
        eyes = "rage";
        mouth = "ouverte";
        body = "manette";
        shake = 1;
        break;
      case "dofus":
        body = "manette";
        mouth = "sourire";
        break;
      case "crise":
        eyes = "triste";
        mouth = "ouverte";
        shake = 1;
        break;
      default:
        break;
    }
    // Clignement d'yeux
    if (!anim && eyes === "lunettes" && t % 4 < 0.12) eyes = "fermes";

    // Les animations d'action priment sur l'humeur
    const props: [string, number, number][] = [];
    if (anim) {
      switch (anim) {
        case "frites":
        case "gras":
          eyes = anim === "gras" ? "grands" : "lunettes";
          mouth = fast ? "ouverte" : "mache";
          if (anim === "gras") body = "gras";
          if (animT < 1.6) props.push(["frites", 13, 10 + Math.min(0, Math.round(animT * 3))]);
          break;
        case "salade":
          mouth = fast ? "mache" : "triste";
          if (animT < 1.6) props.push(["salade", 14, 12]);
          break;
        case "refus":
          eyes = "grands";
          mouth = "triste";
          shake = 1;
          if (sc.refusOf === "salade") props.push(["salade", 16 + Math.round(animT * 30), 12 - Math.round(animT * 12)]);
          break;
        case "dofus":
          body = "manette";
          eyes = fast ? "focus" : "lunettes";
          mouth = "sourire";
          break;
        case "rage":
          body = "manette";
          eyes = "rage";
          mouth = "ouverte";
          shake = 2;
          break;
        case "drop":
          body = "manette";
          eyes = "focus";
          mouth = "sourire";
          bob = fast;
          break;
        case "sieste":
          eyes = "fermes";
          mouth = "neutre";
          bob = 0;
          break;
        case "douche":
          eyes = "fermes";
          mouth = "sourire";
          break;
        case "parler":
        case "event":
          mouth = fast ? "ouverte" : "neutre";
          break;
        case "crise":
          eyes = "triste";
          mouth = "ouverte";
          shake = 2;
          break;
      }
    }

    const sx = Math.round(this.x + (shake ? (fast ? shake : -shake) : 0));
    const sy = GROUND - 20 - bob;

    // Décor derrière lui
    if (anim === "sieste") ctx.drawImage(prop("canape"), sx - 2, GROUND - 5);
    const tv = body === "manette";
    if (tv) ctx.drawImage(prop("ecran"), sx + 18 > LCD_W - 10 ? sx - 12 : sx + 18, GROUND - 7);

    ctx.drawImage(hero(eyes, mouth, body), sx, sy);
    for (const [k, px, py] of props) ctx.drawImage(prop(k), sx + px, sy + py);

    // Effets
    if (anim === "sieste" || mood === "creve") {
      const k = (t * 1.2) % 1;
      z(ctx, sx + 16, Math.round(sy + 1 - k * 6), 4);
      z(ctx, sx + 21, Math.round(sy - 6 - k * 6), 5);
    }
    if (anim === "douche") {
      for (let i = 0; i < 7; i++) {
        const dy = ((t * 30 + i * 9) % 26) - 4;
        ctx.drawImage(prop("goutte"), sx - 2 + i * 3, Math.round(sy + dy));
      }
    }
    if (mood === "deprime" || mood === "crise" || anim === "crise") {
      ctx.drawImage(prop("goutte"), sx + 3, Math.round(sy + 8 + ((t * 8) % 6)));
    }
    if (mood === "rage" || anim === "rage") {
      ctx.drawImage(prop("vapeur"), sx - 4, sy - 4 - fast);
      ctx.drawImage(prop("vapeur"), sx + 14, sy - 4 - (1 - fast));
    }
    if (anim === "drop") {
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + (i * Math.PI) / 2;
        ctx.drawImage(prop("etoile"), Math.round(sx + 5 + Math.cos(a) * 14), Math.round(sy + 6 + Math.sin(a) * 9));
      }
    }
    if (mood === "content" && !anim && Math.floor(t / 3) % 3 === 0) {
      ctx.drawImage(prop("coeur"), sx + 16, Math.round(sy - 2 - ((t * 4) % 4)));
    }
    if (mood === "affame" && !anim) {
      ctx.drawImage(prop("bulle"), sx + 14, sy - 6);
      ctx.drawImage(prop("frites"), sx + 23, sy - 12);
    }
    if (body === "gras") {
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(sx + 1, Math.round(sy + 14 + ((t * 6) % 5)), 1, 2);
      ctx.fillRect(sx + 15, Math.round(sy + 15 + ((t * 5) % 5)), 1, 2);
    }
  }
}
