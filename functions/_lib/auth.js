import { clearSessionCookie, jsonResponse, sessionCookie, sessionTokenFromRequest } from "./http.js";
import { addDaysIso, creditSummary, ensureSchema, ensureSubscription, normalizeEmail, nowIso, sha256Hex } from "./db.js";

export async function loginWithAccessCode(request, env, body = {}) {
  if (!env.DB) {
    return { response: jsonResponse(request, env, { error: "Account database is not configured.", code: "db_missing" }, 503) };
  }
  await ensureSchema(env.DB);
  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim();
  const accessCode = String(body.accessCode || "").trim();

  if (!email || !email.includes("@")) {
    return { response: jsonResponse(request, env, { error: "Enter a valid email address.", code: "invalid_email" }, 400) };
  }

  const configuredCode = String(env.APP_ACCESS_CODE || "").trim();
  const openSignup = String(env.ALLOW_OPEN_SIGNUPS || "").toLowerCase() === "true";
  const userCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  const firstUserBootstrap = !configuredCode && Number(userCount?.count || 0) === 0;
  if (!openSignup && !firstUserBootstrap && (!configuredCode || accessCode !== configuredCode)) {
    return { response: jsonResponse(request, env, { error: "Access code is required.", code: "invalid_access_code" }, 401) };
  }

  const account = await getOrCreateAccount(env.DB, { email, name, env, forceAdmin: firstUserBootstrap });
  const token = await createSession(env.DB, account.user.id);
  const subscription = await ensureSubscription(env.DB, account.org.id, env);
  return {
    account: accountResponse(account, subscription),
    headers: {
      "set-cookie": sessionCookie(token)
    }
  };
}

export async function requireAccount(request, env) {
  if (!env.DB) {
    return { response: jsonResponse(request, env, { error: "Account database is not configured.", code: "db_missing" }, 503) };
  }
  await ensureSchema(env.DB);
  const token = sessionTokenFromRequest(request);
  if (!token) {
    return { response: jsonResponse(request, env, { error: "Sign in to run live scans.", code: "auth_required" }, 401) };
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB
    .prepare(
      `SELECT sessions.*, users.email, users.name, users.role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`
    )
    .bind(tokenHash)
    .first();

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return {
      response: jsonResponse(request, env, { error: "Session expired. Sign in again.", code: "session_expired" }, 401, {
        "set-cookie": clearSessionCookie()
      })
    };
  }

  const membership = await env.DB.prepare("SELECT * FROM memberships WHERE user_id = ? LIMIT 1").bind(session.user_id).first();
  if (!membership) {
    return { response: jsonResponse(request, env, { error: "No workspace found for this account.", code: "workspace_missing" }, 403) };
  }

  const org = await env.DB.prepare("SELECT * FROM organizations WHERE id = ?").bind(membership.org_id).first();
  const subscription = await ensureSubscription(env.DB, org.id, env);
  await env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(nowIso(), session.id).run();
  await env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(nowIso(), session.user_id).run();

  const account = {
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name || "",
      role: adminEmails(env).has(session.email) ? "admin" : session.role || "member"
    },
    org,
    membership
  };

  return { account, subscription, creditSummary: creditSummary(subscription) };
}

export function accountResponse(account, subscription) {
  return {
    user: account.user,
    organization: account.org,
    membership: account.membership,
    credits: creditSummary(subscription),
    admin: account.user.role === "admin"
  };
}

export async function logout(request, env) {
  const token = sessionTokenFromRequest(request);
  if (token && env.DB) {
    const tokenHash = await sha256Hex(token);
    await ensureSchema(env.DB);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return jsonResponse(request, env, { ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

export function adminEmails(env = {}) {
  return new Set(
    String(env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );
}

async function getOrCreateAccount(db, { email, name, env, forceAdmin = false }) {
  const now = nowIso();
  const isAdmin = forceAdmin || adminEmails(env).has(email);
  let user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      role: isAdmin ? "admin" : "member",
      created_at: now,
      last_seen_at: now
    };
    await db
      .prepare("INSERT INTO users (id, email, name, role, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, user.email, user.name, user.role, user.created_at, user.last_seen_at)
      .run();
  } else {
    await db.prepare("UPDATE users SET name = COALESCE(NULLIF(?, ''), name), last_seen_at = ? WHERE id = ?").bind(name, now, user.id).run();
    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
  }

  let membership = await db.prepare("SELECT * FROM memberships WHERE user_id = ? LIMIT 1").bind(user.id).first();
  let org;
  if (!membership) {
    org = {
      id: crypto.randomUUID(),
      name: name ? `${name}'s workspace` : `${email.split("@")[0]}'s workspace`,
      created_at: now
    };
    await db.prepare("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)").bind(org.id, org.name, org.created_at).run();
    membership = {
      user_id: user.id,
      org_id: org.id,
      role: "owner",
      created_at: now
    };
    await db
      .prepare("INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, ?, ?)")
      .bind(membership.user_id, membership.org_id, membership.role, membership.created_at)
      .run();
  } else {
    org = await db.prepare("SELECT * FROM organizations WHERE id = ?").bind(membership.org_id).first();
  }

  user.role = isAdmin ? "admin" : user.role;
  return { user, org, membership };
}

async function createSession(db, userId) {
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256Hex(token);
  const now = nowIso();
  await db
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, addDaysIso(30), now, now)
    .run();
  return token;
}
