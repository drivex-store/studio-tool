import { createClient } from "@sanity/client";

/**
 * Resolve Sanity settings for a request.
 * Priority: values sent from the UI (request headers) → environment variables.
 * This lets the app work with NO env vars on deploy — the user enters
 * the settings in the Settings dialog instead.
 */
export function resolveSanityConfig(request) {
  const h = (name) => request?.headers?.get(name)?.trim() || "";

  return {
    projectId: h("x-sanity-project-id") || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "",
    dataset: h("x-sanity-dataset") || process.env.NEXT_PUBLIC_SANITY_DATASET || "",
    apiVersion:
      h("x-sanity-api-version") || process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01",
    token: h("x-sanity-token") || process.env.SANITY_API_WRITE_TOKEN || "",
  };
}

/**
 * Server-side Sanity client with write token.
 * NEVER import this into client components.
 */
export function getSanityWriteClient(request) {
  const { projectId, dataset, apiVersion, token } = resolveSanityConfig(request);

  if (!projectId || !dataset) {
    throw new Error("Missing Project ID or Dataset. Open Settings and fill them in.");
  }

  if (!token) {
    throw new Error("Missing write token. Open Settings and add your Sanity write token.");
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });
}

/**
 * Read client. Uses the token too when available (needed for private datasets).
 */
export function getSanityReadClient(request) {
  const { projectId, dataset, apiVersion, token } = resolveSanityConfig(request);

  if (!projectId || !dataset) {
    throw new Error("Missing Project ID or Dataset. Open Settings and fill them in.");
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    ...(token ? { token } : {}),
    useCdn: false,
  });
}
