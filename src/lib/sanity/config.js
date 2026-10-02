/**
 * Public Sanity configuration (safe for client components).
 * Write token is never exposed here.
 */
export function getPublicSanityConfig() {
  return {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "",
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01",
    studioUrl: process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || "",
  };
}

export function isConfigured() {
  const cfg = getPublicSanityConfig();
  return Boolean(cfg.projectId && cfg.dataset);
}
