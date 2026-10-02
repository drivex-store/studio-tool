import { NextResponse } from "next/server";
import { getSanityWriteClient, getSanityReadClient } from "@/lib/sanity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sanity/documents/[id]
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const client = getSanityReadClient(request);
    const doc = await client.getDocument(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (err) {
    console.error("[document GET]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch document" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sanity/documents/[id]
 * Body: { document: {...}, operation?: "patch" | "createOrReplace" }
 * For patch we merge the provided fields.
 * For createOrReplace we replace the whole document.
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const body = await request.json();
    const document = body.document;
    const operation = body.operation || "createOrReplace";

    if (!document || typeof document !== "object") {
      return NextResponse.json(
        { error: "Body must contain a document object" },
        { status: 400 }
      );
    }

    // Ensure _id matches route
    const payload = { ...document, _id: id };

    if (!payload._type) {
      return NextResponse.json(
        { error: "Document must have a _type field" },
        { status: 400 }
      );
    }

    const client = getSanityWriteClient(request);
    let result;

    if (operation === "patch") {
      // Use mutation for partial update
      result = await client
        .patch(id)
        .set(payload)
        .commit({ returnDocuments: true });
    } else {
      result = await client.createOrReplace(payload);
    }

    return NextResponse.json({
      success: true,
      document: result,
      id: result._id,
      type: result._type,
    });
  } catch (err) {
    console.error("[document PATCH]", err?.message || err);

    const status = err?.statusCode || 500;
    let message = err?.message || "Failed to update document";
    if (status === 401) message = "Unauthorized – check your write token in Settings";
    if (status === 404) message = "Document not found";

    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/sanity/documents/[id]
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const client = getSanityWriteClient(request);
    const result = await client.delete(id);

    return NextResponse.json({
      success: true,
      deleted: result,
      id,
    });
  } catch (err) {
    console.error("[document DELETE]", err?.message || err);

    const status = err?.statusCode || 500;
    let message = err?.message || "Failed to delete document";
    if (status === 401) message = "Unauthorized – check your write token in Settings";
    if (status === 404) message = "Document not found";

    return NextResponse.json({ error: message }, { status });
  }
}
