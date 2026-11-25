const refreshIntervalMs = 60_000;

const contentTypes = new Map([
  ["avif", "image/avif"],
  ["css", "text/css; charset=utf-8"],
  ["html", "text/html; charset=utf-8"],
  ["ico", "image/x-icon"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["js", "text/javascript; charset=utf-8"],
  ["json", "application/json; charset=utf-8"],
  ["mjs", "text/javascript; charset=utf-8"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["txt", "text/plain; charset=utf-8"],
  ["xml", "application/xml; charset=utf-8"],
  ["webp", "image/webp"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
]);

export function contentType(path) {
  return contentTypes.get(path.substring(path.lastIndexOf(".") + 1));
}

function assetPath(path) {
  try {
    const decoded = decodeURIComponent(path);
    if (decoded === "/") return "/index.html";
    if (decoded.includes("\\") || decoded.includes("\0")) return null;
    if (decoded.slice(1).split("/").some((part) => !part || part.startsWith("."))) return null;
    return decoded;
  } catch {
    return null;
  }
}

function errorResponse(status, message, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extraHeaders },
  });
}

export function createApp({ readAsset, readSignals, readSnapshot, development = false }) {
  let lastSignals;
  let cached;
  let expiresAt = 0;
  let pending;

  async function refreshSignals() {
    try {
      lastSignals = await readSignals();
      cached = lastSignals;
    } catch {
      const fallback = lastSignals ?? await readSnapshot().catch(() => null);
      cached = fallback ? { ...fallback, refreshError: true } : null;
    } finally {
      expiresAt = Date.now() + refreshIntervalMs;
    }
    return cached;
  }

  async function loadSignals(ctx) {
    if (Date.now() < expiresAt) return cached;
    if (!pending) {
      pending = refreshSignals().finally(() => { pending = null; });
      ctx?.waitUntil(pending);
    }
    return pending;
  }

  return {
    async fetch(request, _env, ctx) {
      const { method } = request;
      const { pathname } = new URL(request.url);
      if (method !== "GET" && method !== "HEAD") {
        return errorResponse(405, "Method not allowed", { allow: "GET, HEAD" });
      }

      if (pathname === "/api/signals" || pathname === "/data/signals.json") {
        const signals = await loadSignals(ctx);
        return new Response(method === "HEAD" ? null : JSON.stringify(signals ?? {
          error: "Signals are temporarily unavailable.",
        }), {
          status: signals ? 200 : 503,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff",
          },
        });
      }

      const path = assetPath(pathname);
      const type = path && contentType(path);
      const bytes = type ? await readAsset(path) : null;
      if (bytes == null) {
        if (request.headers.get("accept")?.includes("text/html")) {
          const notFound = await readAsset("/404.html");
          if (notFound != null) {
            return new Response(method === "HEAD" ? null : notFound, {
              status: 404,
              headers: { "content-type": contentType("/404.html"), "cache-control": "no-cache" },
            });
          }
        }
        return errorResponse(404, method === "HEAD" ? null : "Not found");
      }

      const cacheableAsset = path.startsWith("/assets/");
      return new Response(method === "HEAD" ? null : bytes, {
        headers: {
          "cache-control": cacheableAsset && !development ? "public, max-age=3600" : "no-cache",
          "content-type": type,
          "x-content-type-options": "nosniff",
        },
      });
    },
  };
}
