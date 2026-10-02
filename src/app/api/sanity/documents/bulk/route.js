import { NextResponse } from "next/server";
import { getSanityWriteClient } from "@/lib/sanity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST – bulk create / createOrReplace documents
 * Body: {
 *   documents: [...],
 *   operation?: "create" | "createOrReplace",
 *   stopOnError?: boolean
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const documents = body.documents;
    const operation = body.operation || "create";
    const stopOnError = Boolean(body.stopOnError);

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: "Body must contain a non-empty documents array" },
        { status: 400 }
      );
    }

    if (documents.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 documents per bulk request" },
        { status: 400 }
      );
    }

    // Pre-validate
    const validationErrors = [];
    documents.forEach((doc, index) => {
      if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
        validationErrors.push({ index, error: "Must be an object" });
      } else if (!doc._type || typeof doc._type !== "string") {
        validationErrors.push({ index, error: "Missing or invalid _type" });
      } else if (
        (operation === "createOrReplace" || operation === "createIfNotExists") &&
        !doc._id
      ) {
        validationErrors.push({ index, error: "Missing _id for replace/ifNotExists" });
      }
    });

    if (validationErrors.length > 0 && stopOnError) {
      return NextResponse.json(
        { error: "Validation failed", validationErrors },
        { status: 400 }
      );
    }

    const client = getSanityWriteClient(request);
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const preError = validationErrors.find((e) => e.index === i);

      if (preError) {
        results.push({ index: i, success: false, error: preError.error });
        failCount++;
        if (stopOnError) break;
        continue;
      }

      try {
        let result;
        if (operation === "createOrReplace") {
          result = await client.createOrReplace(doc);
        } else if (operation === "createIfNotExists") {
          result = await client.createIfNotExists(doc);
        } else {
          result = await client.create(doc);
        }
        results.push({
          index: i,
          success: true,
          id: result._id,
          type: result._type,
        });
        successCount++;
      } catch (err) {
        results.push({
          index: i,
          success: false,
          error: err?.message || "Create failed",
        });
        failCount++;
        if (stopOnError) break;
      }
    }

    return NextResponse.json({
      success: failCount === 0,
      total: documents.length,
      successCount,
      failCount,
      results,
    });
  } catch (err) {
    console.error("[documents bulk]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Bulk operation failed" },
      { status: 500 }
    );
  }
}
