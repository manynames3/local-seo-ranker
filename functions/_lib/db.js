const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    password_hash TEXT,
    password_salt TEXT,
    password_updated_at TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, org_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    monthly_credit_limit INTEGER NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    business_name TEXT NOT NULL,
    website_url TEXT NOT NULL,
    keyword TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    grid_size INTEGER NOT NULL,
    mode TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    request_credits INTEGER NOT NULL,
    charged_credits INTEGER NOT NULL,
    avg_rank REAL,
    coverage INTEGER,
    weak INTEGER,
    created_at TEXT NOT NULL,
    report_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scan_cache (
    cache_key TEXT NOT NULL,
    org_id TEXT NOT NULL,
    response_json TEXT NOT NULL,
    provider TEXT NOT NULL,
    request_credits INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (org_id, cache_key)
  )`,
  `CREATE TABLE IF NOT EXISTS geocode_cache (
    query_key TEXT NOT NULL,
    org_id TEXT NOT NULL,
    query TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (org_id, query_key)
  )`,
  `CREATE TABLE IF NOT EXISTS scan_schedules (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    business_name TEXT NOT NULL,
    website_url TEXT NOT NULL,
    keyword TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    grid_size INTEGER NOT NULL,
    center_lat REAL NOT NULL,
    center_lon REAL NOT NULL,
    point_spacing_km REAL NOT NULL,
    frequency TEXT NOT NULL,
    alert_threshold INTEGER NOT NULL,
    alert_email TEXT,
    status TEXT NOT NULL,
    next_run_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    request_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    credits INTEGER NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    route TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`
];

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)",
  "CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_scans_org_created ON scans(org_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_scan_schedules_org_updated ON scan_schedules(org_id, updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_usage_org_created ON usage_events(org_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_rate_org_route_created ON rate_events(org_id, route, created_at DESC)"
];

export async function ensureSchema(db) {
  if (!db) throw new Error("DB binding is required.");
  for (const sql of SCHEMA) {
    await db.prepare(sql).run();
  }
  await ensureColumns(db, "users", [
    ["password_hash", "TEXT"],
    ["password_salt", "TEXT"],
    ["password_updated_at", "TEXT"]
  ]);
  for (const sql of INDEXES) {
    await db.prepare(sql).run();
  }
}

async function ensureColumns(db, table, columns) {
  const existing = await db.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set((existing.results || []).map((column) => column.name));
  for (const [name, type] of columns) {
    if (!names.has(name)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run();
    }
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function monthlyCreditLimit(env = {}) {
  const parsed = Number.parseInt(env.DEFAULT_MONTHLY_CREDITS, 10);
  return Number.isFinite(parsed) ? Math.max(100, parsed) : 2500;
}

export async function getSubscription(db, orgId) {
  return db.prepare("SELECT * FROM subscriptions WHERE org_id = ?").bind(orgId).first();
}

export function creditSummary(subscription) {
  const monthlyLimit = Number(subscription?.monthly_credit_limit || 0);
  const used = Number(subscription?.credits_used || 0);
  return {
    plan: subscription?.plan || "starter",
    status: subscription?.status || "inactive",
    monthlyLimit,
    used,
    remaining: Math.max(0, monthlyLimit - used),
    periodEnd: subscription?.period_end || ""
  };
}

export async function ensureSubscription(db, orgId, env = {}) {
  const existing = await getSubscription(db, orgId);
  if (existing) return existing;
  const now = nowIso();
  const subscription = {
    id: crypto.randomUUID(),
    org_id: orgId,
    plan: "starter",
    status: "active",
    monthly_credit_limit: monthlyCreditLimit(env),
    credits_used: 0,
    period_start: now,
    period_end: addDaysIso(30),
    updated_at: now
  };
  await db
    .prepare(
      `INSERT INTO subscriptions
        (id, org_id, plan, status, monthly_credit_limit, credits_used, period_start, period_end, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      subscription.id,
      subscription.org_id,
      subscription.plan,
      subscription.status,
      subscription.monthly_credit_limit,
      subscription.credits_used,
      subscription.period_start,
      subscription.period_end,
      subscription.updated_at
    )
    .run();
  return subscription;
}

export async function consumeCredits(db, { orgId, userId, credits, kind, description }) {
  if (credits <= 0) return await getSubscription(db, orgId);
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE subscriptions
       SET credits_used = credits_used + ?, updated_at = ?
       WHERE org_id = ?
         AND status = 'active'
         AND (monthly_credit_limit - credits_used) >= ?`
    )
    .bind(credits, now, orgId, credits)
    .run();

  if (!result.meta?.changes) {
    const subscription = await getSubscription(db, orgId);
    const summary = creditSummary(subscription);
    const error = new Error("Not enough scan credits remaining.");
    error.code = "insufficient_credits";
    error.creditSummary = summary;
    throw error;
  }

  await db
    .prepare(
      `INSERT INTO usage_events (id, org_id, user_id, kind, credits, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), orgId, userId, kind, credits, description || "", now)
    .run();

  return getSubscription(db, orgId);
}

export async function enforceRateLimit(db, { orgId, userId, route, limit = 30, windowMinutes = 60 }) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const current = await db
    .prepare("SELECT COUNT(*) AS count FROM rate_events WHERE org_id = ? AND route = ? AND created_at >= ?")
    .bind(orgId, route, since)
    .first();
  if (Number(current?.count || 0) >= limit) {
    const error = new Error("Rate limit reached. Try again later.");
    error.code = "rate_limited";
    throw error;
  }
  await db
    .prepare("INSERT INTO rate_events (id, org_id, user_id, route, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), orgId, userId, route, nowIso())
    .run();
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
