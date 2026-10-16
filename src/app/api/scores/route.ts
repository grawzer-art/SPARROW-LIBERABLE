import { timingSafeEqual } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import { cleanName, plausible, sortScores, type ScoreEntry } from "@/lib/scores";

/**
 * TABLEAU DES SCORES — L'Évasion de Sparrow
 *  GET    → meilleurs scores (public)
 *  POST   → enregistre un score { name, days, frites, skin, seconds }
 *  DELETE → supprime un score (code administrateur : variable ADMIN_CODE)
 * Chaque score est un petit fichier Vercel Blob dont le nom contient toutes les infos :
 * aucune écriture concurrente sur un fichier commun.
 */

export const dynamic = "force-dynamic";

const PREFIX = "scores/";
const KEEP = 300;
const SKINS = new Set(["lunettes", "masque", "lili"]);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const enabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function parse(pathname: string, url: string): (ScoreEntry & { url: string }) | null {
  // scores/<jours>_<frites>_<skin>_<horodatage>_<nom base64>.json
  const m = pathname.slice(PREFIX.length).match(/^(\d{4})_(\d{3})_([a-z]+)_(\d{13})_([A-Za-z0-9_-]+?)(?:-[A-Za-z0-9]+)?\.json$/);
  if (!m) return null;
  return {
    days: Number(m[1]),
    frites: Number(m[2]),
    skin: m[3],
    at: new Date(Number(m[4])).toISOString(),
    name: cleanName(unb64(m[5])),
    url,
  };
}

async function all() {
  const out: (ScoreEntry & { url: string })[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of res.blobs) {
      const s = parse(b.pathname, b.url);
      if (s) out.push(s);
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out.sort(sortScores);
}

/** Meilleur score par joueur (on garde le classement lisible). */
function bestPerName(scores: (ScoreEntry & { url: string })[]) {
  const seen = new Set<string>();
  return scores.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
}

const strip = ({ url: _url, ...s }: ScoreEntry & { url: string }) => s;

export async function GET() {
  if (!enabled()) return json({ enabled: false, scores: [] });
  try {
    return json({ enabled: true, scores: bestPerName(await all()).slice(0, 50).map(strip) });
  } catch {
    return json({ enabled: true, scores: [], error: "lecture" }, 502);
  }
}

export async function POST(req: Request) {
  if (!enabled()) return json({ error: "Tableau des scores pas encore activé." }, 503);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Requête invalide." }, 400);
  const name = cleanName(String(body.name ?? ""));
  const days = Number(body.days);
  const frites = Number(body.frites);
  const seconds = Number(body.seconds);
  const skin = String(body.skin ?? "");
  if (name.length < 2) return json({ error: "Pseudo trop court (2 caractères min.)." }, 400);
  if (!SKINS.has(skin)) return json({ error: "Personnage inconnu." }, 400);
  if (!plausible(days, frites, seconds)) return json({ error: "Score refusé par le Ministère (trop beau pour être vrai)." }, 422);

  const at = Date.now();
  const path = `${PREFIX}${String(days).padStart(4, "0")}_${String(frites).padStart(3, "0")}_${skin}_${at}_${b64(name)}.json`;
  const entry: ScoreEntry = { name, days, frites, skin, at: new Date(at).toISOString() };
  await put(path, JSON.stringify(entry), { access: "public", contentType: "application/json", addRandomSuffix: true });

  const scores = await all();
  // Ménage : on ne garde que les meilleurs.
  if (scores.length > KEEP) await del(scores.slice(KEEP).map((s) => s.url));
  const board = bestPerName(scores);
  const rank = board.findIndex((s) => s.name === name) + 1;
  return json({ ok: true, rank, scores: board.slice(0, 50).map(strip) }, 201);
}

function isAdmin(code: string | null) {
  const a = process.env.ADMIN_CODE;
  if (!code || !a) return false;
  const x = Buffer.from(code);
  const y = Buffer.from(a);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function DELETE(req: Request) {
  if (!enabled()) return json({ error: "Tableau des scores pas encore activé." }, 503);
  if (!isAdmin(req.headers.get("x-code"))) return json({ error: "Réservé au Ministère." }, 403);
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const target = cleanName(String(name ?? ""));
  const scores = (await all()).filter((s) => s.name === target);
  if (scores.length) await del(scores.map((s) => s.url));
  return json({ ok: true, removed: scores.length });
}
