import { NextResponse } from "next/server";
import { getSanityReadClient, resolveSanityConfig } from "@/lib/sanity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { projectId, dataset, apiVersion, token } = resolveSanityConfig(request);
  const hasWriteToken = Boolean(token);

  try {
    if (!projectId || !dataset) {
      return NextResponse.json({
        connected: false,
        projectId: projectId || null,
        dataset: dataset || null,
        apiVersion,
        hasWriteToken,
        error: "Missing project ID or dataset",
      });
    }

    // Lightweight connectivity check
    const client = getSanityReadClient(request);
    await client.fetch("count(*)");

    return NextResponse.json({
      connected: true,
      projectId,
      dataset,
      apiVersion,
      hasWriteToken,
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      projectId: projectId || null,
      dataset: dataset || null,
      apiVersion,
      hasWriteToken,
      error: err?.message || "Connection failed",
    });
  }
}
