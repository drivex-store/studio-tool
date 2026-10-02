"use client";

import { createClient } from "@sanity/client";

/**
 * Browser-side storage for Sanity settings entered in the UI.
 * - "remember" = true  → localStorage   (kept on this device)
 * - "remember" = false → sessionStorage (cleared when the tab closes)
 */
const KEY = "sanity-upload-tool:settings";

export const EMPTY_SETTINGS = {
  projectId: "",
  dataset: "",
  apiVersion: "",
  token: "",
  remember: true,
};

export function loadSettings() {
  if (typeof window === "undefined") return { ...EMPTY_SETTINGS };
  try {
    const raw = window.localStorage.getItem(KEY) || window.sessionStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_SETTINGS };
    return { ...EMPTY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_SETTINGS };
  }
}

export function saveSettings(settings) {
  const clean = {
    projectId: settings.projectId?.trim() || "",
    dataset: settings.dataset?.trim() || "",
    apiVersion: settings.apiVersion?.trim() || "",
    token: settings.token?.trim() || "",
    remember: Boolean(settings.remember),
  };
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
    (clean.remember ? window.localStorage : window.sessionStorage).setItem(
      KEY,
      JSON.stringify(clean)
    );
  } catch {
    /* storage unavailable – settings just won't persist */
  }
  return clean;
}

export function clearSettings() {
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {}
}

/**
 * Drop-in replacement for fetch() that attaches the saved Sanity settings
 * as headers. The server falls back to env vars for anything left empty.
 */
export function sanityFetch(url, options = {}) {
  const s = loadSettings();
  const headers = new Headers(options.headers || {});
  if (s.projectId) headers.set("x-sanity-project-id", s.projectId);
  if (s.dataset) headers.set("x-sanity-dataset", s.dataset);
  if (s.apiVersion) headers.set("x-sanity-api-version", s.apiVersion);
  if (s.token) headers.set("x-sanity-token", s.token);
  return fetch(url, { ...options, headers });
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/**
 * Upload a file straight from the browser to Sanity (bypasses the Next.js /
 * Vercel function body limit of ~4.5 MB). Requires this site's origin to be
 * added under Sanity Manage -> API -> CORS origins.
 */
export async function uploadAssetDirect(file, assetType = "image") {
  const s = loadSettings();
  if (!s.projectId || !s.dataset) {
    throw new Error("Missing Project ID or Dataset. Open Settings and fill them in.");
  }
  if (!s.token) {
    throw new Error("Missing write token. Open Settings and add your Sanity write token.");
  }

  const client = createClient({
    projectId: s.projectId,
    dataset: s.dataset,
    apiVersion: s.apiVersion || "2024-01-01",
    token: s.token,
    useCdn: false,
    withCredentials: false,
  });

  const contentType = file.type || "application/octet-stream";
  const asImage = assetType === "image" || IMAGE_MIME_TYPES.has(contentType);

  let asset;
  try {
    asset = await client.assets.upload(asImage ? "image" : "file", file, {
      filename: file.name || "upload",
      contentType,
    });
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      throw new Error("Unauthorized – check your write token in Settings");
    }
    if (!err?.statusCode && /network|fetch|cors/i.test(err?.message || "")) {
      throw new Error(
        "Upload blocked (likely CORS). Add this site's URL in Sanity Manage → API → CORS origins."
      );
    }
    throw err;
  }

  const isImage = asset._type === "sanity.imageAsset";
  const ref = { _type: "reference", _ref: asset._id };
  return {
    _id: asset._id,
    _type: asset._type,
    url: asset.url,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    size: asset.size,
    extension: asset.extension,
    ...(isImage && asset.metadata
      ? {
          dimensions: asset.metadata.dimensions,
          hasAlpha: asset.metadata.hasAlpha,
          isOpaque: asset.metadata.isOpaque,
        }
      : {}),
    reference: ref,
    imageField: isImage ? { _type: "image", asset: ref } : null,
    fileField: !isImage ? { _type: "file", asset: ref } : null,
  };
}
