import { timingSafeEqual } from "node:crypto";
import { del, list, put } from "@vercel/blob";

/**
 * PIÈCES DÉPOSÉES PAR LES TÉMOINS
 *  GET    → liste des photos (publique)
 *  POST   → dépôt d'une photo (code des potes requis : variable UPLOAD_CODE)
 *  DELETE → suppression (code administrateur requis : variable ADMIN_CODE)
 * Stockage : Vercel Blob (variable BLOB_READ_WRITE_TOKEN, créée par Vercel).
 */

export const dynamic = "force-dynamic";

const PREFIX = "temoins/";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS = 300;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const enabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.UPLOAD_CODE);

function same(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function role(code: string | null): "admin" | "pote" | null {
  if (!code) return null;
  if (same(code, process.env.ADMIN_CODE)) return "admin";
  if (same(code, process.env.UPLOAD_CODE)) return "pote";
  return null;
}

/** Vérifie la signature binaire (JPEG, PNG, WebP) : le type annoncé ne suffit pas. */
function looksLikeImage(b: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/webp")
    return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}

async function all() {
  const blobs = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...res.blobs);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
}

export async function GET(req: Request) {
  if (!enabled()) return json({ enabled: false, photos: [] });
  const r = role(req.headers.get("x-code"));
  try {
    const blobs = await all();
    return json({
      enabled: true,
      role: r,
      photos: blobs.map((b) => ({ url: b.url, at: b.uploadedAt })),
    });
  } catch {
    return json({ enabled: true, role: r, photos: [], error: "lecture" }, 502);
  }
}

export async function POST(req: Request) {
  if (!enabled()) return json({ error: "Dépôt pas encore activé." }, 503);
  if (!role(req.headers.get("x-code"))) return json({ error: "Code des potes incorrect." }, 401);

  const type = req.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const ext = TYPES[type];
  if (!ext) return json({ error: "Format refusé : photo JPEG, PNG ou WebP uniquement." }, 415);

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return json({ error: "Photo trop lourde (3 Mo max)." }, 413);
  if (!looksLikeImage(buf, type)) return json({ error: "Ce fichier n'est pas une photo." }, 415);

  const count = (await all()).length;
  if (count >= MAX_PHOTOS) return json({ error: "Les archives sont pleines. Le Ministère fait le ménage." }, 507);

  const blob = await put(`${PREFIX}${Date.now()}.${ext}`, buf, {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
    cacheControlMaxAge: 31_536_000,
  });
  return json({ url: blob.url, at: new Date().toISOString() }, 201);
}

export async function DELETE(req: Request) {
  if (!enabled()) return json({ error: "Dépôt pas encore activé." }, 503);
  if (role(req.headers.get("x-code")) !== "admin") return json({ error: "Réservé au Ministère." }, 403);
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !new URL(url).pathname.startsWith(`/${PREFIX}`)) return json({ error: "Pièce inconnue." }, 400);
  await del(url);
  return json({ ok: true });
}
