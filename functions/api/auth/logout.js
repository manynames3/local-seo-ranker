import { logout } from "../../_lib/auth.js";
import { optionsResponse } from "../../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env = {} }) {
  return logout(request, env);
}
