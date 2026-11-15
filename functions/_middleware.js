const SETTINGS_URL = "https://student-hub.kareemahmedhussein4.workers.dev/api/site-settings";

const ADMIN_PATHS = new Set([
  "/admin",
  "/admin.html",
  "/admin.css",
  "/admin.js",
  "/admin-experience.css",
  "/admin-experience.js"
]);

const MAINTENANCE_PATHS = new Set([
  "/maintenance",
  "/maintenance.html"
]);

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Pages canonicalizes .html URLs to extensionless paths.
  // Exclude both forms so the maintenance page never redirects to itself.
  if (
    path.startsWith("/api/") ||
    MAINTENANCE_PATHS.has(path) ||
    ADMIN_PATHS.has(path) ||
    request.method !== "GET" ||
    !(request.headers.get("accept") || "").includes("text/html")
  ) {
    return next();
  }

  try {
    const response = await fetch(SETTINGS_URL, {
      headers: { "cache-control": "no-cache" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) return next();

    const data = await response.json();
    if (!data.ok || !data.maintenance?.enabled) return next();

    const destination = new URL("/maintenance", url.origin);
    destination.searchParams.set(
      "message",
      data.maintenance.message || "الموقع مغلق مؤقتًا للصيانة والتطوير."
    );
    return Response.redirect(destination.toString(), 302);
  } catch {
    // If the settings service is temporarily unavailable, keep the public site reachable.
    return next();
  }
}
