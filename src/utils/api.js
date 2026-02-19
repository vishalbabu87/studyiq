export function apiUrl(path) {
  // Default to relative path (empty string) to avoid localhost/127.0.0.1 mismatches
  let base = import.meta.env.VITE_API_BASE_URL || "";
  if (base.endsWith('/')) base = base.slice(0, -1);
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}