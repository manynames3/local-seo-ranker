import { loginWithAccessCode } from "../../_lib/auth.js";
import { jsonResponse, optionsResponse, readJson } from "../../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env = {} }) {
  const body = await readJson(request);
  if (!body) return jsonResponse(request, env, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);

  try {
    const result = await loginWithAccessCode(request, env, body);
    if (result.response) return result.response;
    return jsonResponse(request, env, { ok: true, account: result.account }, 200, result.headers);
  } catch (error) {
    return jsonResponse(request, env, { error: error.message || "Could not sign in.", code: "login_failed" }, 500);
  }
}
