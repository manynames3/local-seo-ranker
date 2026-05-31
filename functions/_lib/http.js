const SESSION_COOKIE = "lsr_session";

export function jsonResponse(request, env = {}, payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(request, env),
      ...headers
    }
  });
}

export function optionsResponse(request, env = {}) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export function corsHeaders(request, env = {}) {
  const origin = request?.headers?.get("origin") || "";
  const allowedOrigins = new Set(
    [
      new URL(request?.url || "https://local-seo-ranker.pages.dev").origin,
      ...(env.SCAN_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean)
    ]
  );
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : [...allowedOrigins][0];
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function sessionTokenFromRequest(request) {
  return parseCookies(request)[SESSION_COOKIE] || "";
}

export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
