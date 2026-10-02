"use client";

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
