import { NextResponse } from "next/server";
import { getSanityWriteClient, getSanityReadClient } from "@/lib/sanity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN_LIMIT = 1000; // how many recent docs are scanned when searching

// Sanity fields can be strings, slug objects, or localized objects → always return a string
function toText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if (typeof v.current === "string") return v.current; // slug
    return Object.values(v).filter((x) => typeof x === "string").join(" ");
  }
  return "";
}

// Turn a pasted asset URL into the asset _id Sanity uses internally
//  https://cdn.sanity.io/images/<proj>/<ds>/<hash>-<WxH>.<ext> → image-<hash>-<WxH>-<ext>
//  https://cdn.sanity.io/files/<proj>/<ds>/<hash>.<ext>        → file-<hash>-<ext>
function assetIdFromUrl(input) {
  try {
    const u = new URL(input);
    const m = u.pathname.match(/\/(images|files)\/[^/]+\/[^/]+\/([^/]+)$/);
    if (!m) return null;
    const kind = m[1] === "images" ? "image" : "file";
    const name = decodeURIComponent(m[2]);
    const dot = name.lastIndexOf(".");
    if (dot === -1) return null;
    return `${kind}-${name.slice(0, dot)}-${name.slice(dot + 1)}`;
  } catch {
    return null;
  }
}

/**
 * GET – list recent documents (optional type filter + search)
 * Query params: type, q, limit
 *
 * NOTE: GROQ `match` is word/token based (not a substring search) and splits
 * ids on "-" "." "_", so full IDs / URLs never matched. Search is therefore:
 *   1) exact lookup by _id (incl. drafts.), or by asset URL → asset _id
 *   2) substring match in JS over _id, _type, title, name, slug, url, filename
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type")?.trim() || null;
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);

    const client = getSanityReadClient(request);

    const projection = `{
      _id,
      _type,
      _createdAt,
      _updatedAt,
      title,
      name,
      slug,
      url,
      originalFilename,
      mimeType
    }`;

    const normalize = (d) => ({
      _id: d._id,
      _type: d._type,
      _createdAt: d._createdAt,
      _updatedAt: d._updatedAt,
      title: toText(d.title),
      name: toText(d.name),
      slug: toText(d.slug),
      url: toText(d.url),
      originalFilename: toText(d.originalFilename),
      mimeType: toText(d.mimeType),
    });

    const base = type ? `_type == $type` : `defined(_type)`;
    const baseParams = type ? { type } : {};

    // No search text → just the most recent documents
    if (!q) {
      const docs = await client.fetch(
        `*[${base}] | order(_updatedAt desc) [0...$limit] ${projection}`,
        { ...baseParams, limit }
      );
      const out = docs.map(normalize);
      return NextResponse.json({ success: true, documents: out, count: out.length });
    }

    // 1) exact id / url lookup
    const ids = new Set([q]);
    if (q.startsWith("drafts.")) ids.add(q.slice(7));
    else ids.add(`drafts.${q}`);
    const fromUrl = assetIdFromUrl(q);
    if (fromUrl) ids.add(fromUrl);

    const exact = await client.fetch(
      `*[_id in $ids${type ? " && _type == $type" : ""}] ${projection}`,
      { ids: [...ids], ...baseParams }
    );

    // 2) substring search over recent documents
    const scanned = await client.fetch(
      `*[${base}] | order(_updatedAt desc) [0...$scan] ${projection}`,
      { ...baseParams, scan: SCAN_LIMIT }
    );

    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const seen = new Set();
    const results = [];

    for (const d of [...exact, ...scanned]) {
      if (seen.has(d._id)) continue;
      const doc = normalize(d);
      const isExact = exact.some((e) => e._id === d._id);
      const hay = [doc._id, doc._type, doc.title, doc.name, doc.slug, doc.url, doc.originalFilename]
        .join(" ")
        .toLowerCase();
      if (isExact || words.every((w) => hay.includes(w))) {
        seen.add(d._id);
        results.push(doc);
        if (results.length >= limit) break;
      }
    }

    return NextResponse.json({ success: true, documents: results, count: results.length });
  } catch (err) {
    console.error("[documents GET]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * POST – create a single document
 * Body: { document: {...}, operation?: "create" | "createOrReplace" | "createIfNotExists" }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const document = body.document;
    const operation = body.operation || "create";

    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return NextResponse.json(
        { error: "Body must contain a document object" },
        { status: 400 }
      );
    }

    if (!document._type || typeof document._type !== "string") {
      return NextResponse.json(
        { error: "Document must have a string _type field" },
        { status: 400 }
      );
    }

    const client = getSanityWriteClient(request);

    let result;

    if (operation === "createOrReplace") {
      if (!document._id) {
        return NextResponse.json(
          { error: "createOrReplace requires an _id" },
          { status: 400 }
        );
      }
      result = await client.createOrReplace(document);
    } else if (operation === "createIfNotExists") {
      if (!document._id) {
        return NextResponse.json(
          { error: "createIfNotExists requires an _id" },
          { status: 400 }
        );
      }
      result = await client.createIfNotExists(document);
    } else {
      // pure create – strip _id if present to avoid conflict, or keep if user wants specific id
      result = await client.create(document);
    }

    return NextResponse.json({
      success: true,
      document: result,
      id: result._id,
      type: result._type,
    });
  } catch (err) {
    console.error("[documents POST]", err?.message || err);

    const status = err?.statusCode || 500;
    let message = err?.message || "Failed to create document";

    if (status === 409) {
      message = "Document already exists (conflict). Use Update or Create or Replace.";
    } else if (status === 401) {
      message = "Unauthorized – check your write token in Settings";
    }

    return NextResponse.json(
      {
        error: message,
        details: process.env.NODE_ENV === "development" ? String(err) : undefined,
      },
      { status }
    );
  }
}