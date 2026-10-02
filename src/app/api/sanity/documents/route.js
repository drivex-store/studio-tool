import { NextResponse } from "next/server";
import { getSanityWriteClient, getSanityReadClient } from "@/lib/sanity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET – list recent documents (optional type filter + search)
 * Query params: type, q, limit
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || null;
    const q = searchParams.get("q") || null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const client = getSanityReadClient(request);

    let query = `*[_type != null]`;
    const params = {};

    if (type) {
      query = `*[_type == $type]`;
      params.type = type;
    }

    if (q) {
      // Search by _id or title-like fields
      if (type) {
        query = `*[_type == $type && (_id match $q || title match $q || name match $q)]`;
      } else {
        query = `*[(_id match $q || _type match $q || title match $q || name match $q)]`;
      }
      params.q = `*${q}*`;
    }

    query += ` | order(_updatedAt desc) [0...$limit] {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      title,
      name,
      slug
    }`;

    params.limit = limit;

    const docs = await client.fetch(query, params);

    return NextResponse.json({ success: true, documents: docs, count: docs.length });
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
