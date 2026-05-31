import { accountResponse, requireAccount } from "../../_lib/auth.js";
import { jsonResponse, optionsResponse } from "../../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env = {} }) {
  try {
    const auth = await requireAccount(request, env);
    if (auth.response) return auth.response;
    return jsonResponse(request, env, { ok: true, account: accountResponse(auth.account, auth.subscription) });
  } catch (error) {
    return jsonResponse(request, env, { error: error.message || "Account unavailable.", code: "account_unavailable" }, 500);
  }
}
