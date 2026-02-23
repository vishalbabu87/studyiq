/**
 * API Utility
 * Ensures the mobile app uses absolute URLs to talk to the AI engine
 */

const DEFAULT_API_BASE = "https://studyiq-7gzk.onrender.com";

function normalizeBase(base) {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function apiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL || "");

  let savedBase = "";
  if (typeof window !== "undefined") {
    try {
      savedBase = normalizeBase(window.localStorage.getItem("studyiq-api-base") || "");
    } catch {
      savedBase = "";
    }
  }

  const configuredBase = savedBase || envBase;
  if (configuredBase) return `${configuredBase}${cleanPath}`;

  const defaultBase = normalizeBase(DEFAULT_API_BASE);
  return `${defaultBase}${cleanPath}`;
}
