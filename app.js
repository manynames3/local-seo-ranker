const form = document.querySelector("#seo-form");
const exampleButton = document.querySelector("#example-button");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const accountCard = document.querySelector("#account-card");
const accountEmail = document.querySelector("#account-email");
const accountOrg = document.querySelector("#account-org");
const creditBalance = document.querySelector("#credit-balance");
const creditPeriod = document.querySelector("#credit-period");
const findCenterButton = document.querySelector("#find-center");
const scanHistory = document.querySelector("#scan-history");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleList = document.querySelector("#schedule-list");
const scheduleButton = document.querySelector("#save-schedule");
const scheduleEmail = document.querySelector("#schedule-email");
const adminPanel = document.querySelector("#admin-panel");
const adminOverview = document.querySelector("#admin-overview");
const scorecards = document.querySelector("#scorecards");
const comparisonTable = document.querySelector("#comparison-table");
const topicGaps = document.querySelector("#topic-gaps");
const entitySignals = document.querySelector("#entity-signals");
const internalLinks = document.querySelector("#internal-links");
const aiReadiness = document.querySelector("#ai-readiness");
const roadmap = document.querySelector("#roadmap");
const reportTitle = document.querySelector("#report-title");
const reportSubtitle = document.querySelector("#report-subtitle");
const totalScore = document.querySelector("#total-score");
const territoryMap = document.querySelector("#territory-map");
const marketPulse = document.querySelector("#market-pulse");
const quickRead = document.querySelector("#quick-read");
const submitButton = document.querySelector("#generate-report");
const scanStatus = document.querySelector("#scan-status");
const costEstimate = document.querySelector("#cost-estimate");
const gridSizeField = document.querySelector("#gridSize");
const modelKicker = document.querySelector("#model-kicker");
const modelState = document.querySelector("#model-state");
const modelNote = document.querySelector("#model-note");
const scanModeControls = [...document.querySelectorAll('input[name="scanMode"]')];
const exportButtons = {
  copy: document.querySelector("#copy-report"),
  json: document.querySelector("#download-json"),
  csv: document.querySelector("#download-csv"),
  print: document.querySelector("#print-report")
};

let currentReport = null;
let isGenerating = false;
let currentAccount = null;

const estimatedModelStatus = "Strategy estimate only. No live Google Maps/SERP request was made; use live mode before presenting rank cells as observed evidence.";

const scoreDefinitions = [
  ["topicalAuthority", "Topical Authority Score", "Depth of service and supporting content around the target keyword."],
  ["localRelevance", "Local Relevance Score", "How clearly the site connects service intent to the target city and state."],
  ["serviceCoverage", "Service Coverage Score", "Breadth of exact-intent service, modifier, and sub-service pages."],
  ["trustSignals", "Trust Signal Score", "Proof elements, reviews, licenses, case examples, and business identity clarity."],
  ["internalLinking", "Internal Linking Score", "Whether authority flows from broad pages into service and city money pages."],
  ["gbpReadiness", "GBP / Maps Readiness Score", "Google Business Profile alignment, category clarity, and local prominence signals."],
  ["aiSearchReadiness", "AI Search Readiness Score", "Clear entities, proof, process, FAQs, and structured data for AI answers."],
  ["totalOpportunity", "Total Local SEO Opportunity Score", "Estimated upside if the highest-priority gaps are closed."]
];

const serviceModifiers = [
  { label: "Emergency", impact: "High", difficulty: "Medium", kind: "Service-depth" },
  { label: "Storm damage", impact: "High", difficulty: "Medium", kind: "Problem-aware" },
  { label: "Leak", impact: "High", difficulty: "Low", kind: "Urgency" },
  { label: "Cost guide", impact: "High", difficulty: "Medium", kind: "Helpful content" },
  { label: "Insurance claim", impact: "Medium", difficulty: "Medium", kind: "Trust" },
  { label: "Commercial", impact: "Medium", difficulty: "Medium", kind: "Segment" },
  { label: "Residential", impact: "Medium", difficulty: "Low", kind: "Segment" },
  { label: "Financing", impact: "Medium", difficulty: "Low", kind: "Conversion" },
  { label: "Before/after proof", impact: "High", difficulty: "Medium", kind: "Proof" },
  { label: "FAQ", impact: "Medium", difficulty: "Low", kind: "AI readiness" },
  { label: "Service process", impact: "Medium", difficulty: "Low", kind: "Trust" },
  { label: "Neighborhood service-area pages", impact: "High", difficulty: "High", kind: "Local relevance" }
];

const entitySignalTemplates = [
  ["Business name consistency", "The business name should be identical across site footer, contact page, GBP, citations, and schema."],
  ["Address and phone consistency", "NAP details should be crawlable and match GBP and citation sources."],
  ["Primary service category", "The site should reinforce the main service category in navigation, headings, GBP, and schema."],
  ["City and state mentions", "Priority service pages should connect the keyword to the target city and state naturally."],
  ["Nearby neighborhood mentions", "Neighborhood and service-area references can support local relevance without doorway-page copy."],
  ["Team or about page", "People-first trust improves credibility for both search systems and homeowners."],
  ["Reviews and testimonials", "Review proof should be visible, specific, and mapped to services where appropriate."],
  ["Proof examples", "Completed work, menu, portfolio, case, or customer-result pages help prove prominence and local experience."],
  ["Licenses and certifications", "Credentials should be easy to find and included in organization-level trust signals."],
  ["Service area page", "A service area hub should connect city, neighborhood, and nearby market pages."],
  ["GBP alignment", "Services, categories, descriptions, and photos should match the site content strategy."],
  ["LocalBusiness schema", "Organization and local business entities should be machine-readable."],
  ["FAQ schema", "FAQ content should answer real buying questions and use eligible structured data where appropriate."],
  ["Review schema where appropriate", "Review markup must follow current guidelines and avoid self-serving misuse."],
  ["Breadcrumb schema", "Breadcrumbs help clarify hierarchy from homepage to service to city pages."]
];

const aiReadinessTemplates = [
  ["Clear business identity", "AI systems should be able to name the company, location, and category with confidence."],
  ["Clear services", "Primary, secondary, and emergency services should be explicit and internally linked."],
  ["Clear service area", "Target city, nearby areas, and practical travel/service boundaries should be unambiguous."],
  ["Clear proof", "Reviews, photos, case examples, credentials, and years of experience should support authority claims."],
  ["Clear pricing or cost guidance", "Cost ranges, factors, and quote process content help answer commercial-intent questions."],
  ["Clear process", "The site should explain inspection, scheduling, repair, replacement, financing, and follow-up steps."],
  ["Clear FAQs", "FAQ content should answer objections and long-tail questions in plain language."],
  ["Structured data", "Schema should identify the business, services, breadcrumbs, FAQs, and relevant reviews."],
  ["Author or company credibility", "About content should show who stands behind the advice and service."],
  ["Updated content", "Fresh proof examples, seasonal guidance, and current service details reduce ambiguity."]
];

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.href.replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function domainFromUrl(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return normalizeText(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGridSize(value) {
  const parsed = Number.parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : 9;
  const bounded = Math.max(3, Math.min(11, safe));
  return bounded % 2 === 0 ? bounded - 1 : bounded;
}

function toneFor(score) {
  if (score >= 75) return "strong";
  if (score >= 52) return "moderate";
  return "weak";
}

function statusFor(score) {
  if (score >= 75) return "Strong";
  if (score >= 52) return "Moderate";
  return "Weak";
}

function priorityValue(impact, difficulty, confidence = 0) {
  const impactValue = { High: 36, Medium: 24, Low: 14 }[impact] || 20;
  const difficultyOffset = { Low: 18, Medium: 9, High: 2 }[difficulty] || 8;
  return clamp(42 + impactValue + difficultyOffset + confidence, 45, 98);
}

function readInput() {
  const data = new FormData(form);
  const gridSize = normalizeGridSize(data.get("gridSize"));
  const competitors = [1, 2, 3]
    .map((index) => normalizeUrl(data.get(`competitor${index}`)))
    .filter(Boolean)
    .map((url, index) => ({ id: `competitor-${index + 1}`, url, label: `Competitor ${index + 1}` }));

  return {
    websiteUrl: normalizeUrl(data.get("websiteUrl")),
    businessName: normalizeText(data.get("businessName")),
    city: normalizeText(data.get("city")),
    state: normalizeText(data.get("state")),
    keyword: normalizeText(data.get("keyword")),
    mapsUrl: normalizeUrl(data.get("mapsUrl")),
    centerLat: parseNumber(data.get("centerLat")),
    centerLon: parseNumber(data.get("centerLon")),
    gridSize,
    pointSpacingKm: parseNumber(data.get("pointSpacingKm")) || 2,
    scanMode: data.get("scanMode") === "live" ? "live" : "estimate",
    notes: normalizeText(data.get("notes")),
    competitors
  };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw Object.assign(new Error(`Request failed with status ${response.status}.`), { status: response.status });
  }
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || payload.reason || `Request failed with status ${response.status}.`), {
      status: response.status,
      code: payload.code || payload.reason || "",
      payload
    });
  }
  return payload;
}

function setAccount(account) {
  currentAccount = account || null;
  const signedIn = Boolean(currentAccount);
  loginForm?.classList.toggle("is-hidden", signedIn);
  accountCard?.classList.toggle("is-hidden", !signedIn);

  if (!signedIn) {
    if (scanHistory) {
      scanHistory.className = "list-stack empty-copy";
      scanHistory.textContent = "Sign in to view saved scans for this workspace.";
    }
    if (scheduleList) {
      scheduleList.className = "list-stack empty-copy";
      scheduleList.textContent = "Sign in to view scheduled scans for this workspace.";
    }
    adminPanel?.classList.add("is-hidden");
    return;
  }

  const credits = currentAccount.credits || {};
  if (accountEmail) accountEmail.textContent = currentAccount.user?.email || "";
  if (accountOrg) accountOrg.textContent = currentAccount.organization?.name || "Workspace";
  if (creditBalance) creditBalance.textContent = `${credits.remaining ?? 0}/${credits.monthlyLimit ?? 0}`;
  if (creditPeriod) creditPeriod.textContent = credits.periodEnd ? `Resets ${new Date(credits.periodEnd).toLocaleDateString()}` : "Current cycle";
  if (scheduleEmail && !scheduleEmail.value) scheduleEmail.value = currentAccount.user?.email || "";
  loadHistory();
  loadSchedules();
  if (currentAccount.admin) {
    adminPanel?.classList.remove("is-hidden");
    loadAdminOverview();
  } else {
    adminPanel?.classList.add("is-hidden");
  }
}

async function loadAccount() {
  try {
    const payload = await apiFetch("/api/auth/me");
    setAccount(payload.account);
  } catch {
    setAccount(null);
  }
}

async function loadHistory() {
  if (!currentAccount || !scanHistory) return;
  try {
    const payload = await apiFetch("/api/history?limit=8");
    renderHistory(payload.scans || []);
  } catch (error) {
    scanHistory.className = "list-stack empty-copy";
    scanHistory.textContent = error.message || "Could not load scan history.";
  }
}

function renderHistory(scans) {
  if (!scanHistory) return;
  if (!scans.length) {
    scanHistory.className = "list-stack empty-copy";
    scanHistory.textContent = "No saved scans yet. Run a live Maps scan to start building history.";
    return;
  }
  scanHistory.className = "list-stack history-list";
  scanHistory.innerHTML = scans
    .map(
      (scan) => `
        <div class="history-item">
          <div>
            <strong>${escapeHtml(scan.businessName)}</strong>
            <p>${escapeHtml(scan.keyword)} in ${escapeHtml(scan.city)}, ${escapeHtml(scan.state)} · ${escapeHtml(scan.gridSize)}</p>
          </div>
          <div>
            <span class="mini-chip">${escapeHtml(scan.status)}</span>
            <small>${new Date(scan.createdAt).toLocaleDateString()}</small>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadSchedules() {
  if (!currentAccount || !scheduleList) return;
  try {
    const payload = await apiFetch("/api/schedules?limit=6");
    renderSchedules(payload.schedules || []);
  } catch (error) {
    scheduleList.className = "list-stack empty-copy";
    scheduleList.textContent = error.message || "Could not load scheduled scans.";
  }
}

function renderSchedules(schedules) {
  if (!scheduleList) return;
  if (!schedules.length) {
    scheduleList.className = "list-stack empty-copy";
    scheduleList.textContent = "No monitoring rules yet. Use the current market setup to track rank changes over time.";
    return;
  }
  scheduleList.className = "list-stack history-list";
  scheduleList.innerHTML = schedules
    .map(
      (schedule) => `
        <div class="history-item">
          <div>
            <strong>${escapeHtml(schedule.businessName)}</strong>
            <p>${escapeHtml(schedule.keyword)} in ${escapeHtml(schedule.city)}, ${escapeHtml(schedule.state)} · ${escapeHtml(schedule.frequency)} · ${escapeHtml(schedule.gridSize)}</p>
            <small class="schedule-meta">Alert when average rank is worse than ${escapeHtml(schedule.threshold)} · ${escapeHtml(schedule.alertEmail || "No alert email")}</small>
          </div>
          <div>
            <span class="mini-chip">${escapeHtml(schedule.status)}</span>
            <small>Next ${new Date(schedule.nextRunAt).toLocaleDateString()}</small>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadAdminOverview() {
  if (!currentAccount?.admin || !adminOverview) return;
  try {
    const payload = await apiFetch("/api/admin/overview");
    const totals = payload.totals || {};
    adminOverview.className = "pulse-grid";
    adminOverview.innerHTML = `
      <div class="pulse-metric"><span>Users</span><strong>${totals.users ?? 0}</strong><p>Total registered accounts.</p></div>
      <div class="pulse-metric"><span>Workspaces</span><strong>${totals.organizations ?? 0}</strong><p>Active customer workspaces.</p></div>
      <div class="pulse-metric"><span>Saved scans</span><strong>${totals.scans ?? 0}</strong><p>Scan records stored in history.</p></div>
      <div class="pulse-metric"><span>Schedules</span><strong>${totals.schedules ?? 0}</strong><p>Recurring scan rules saved.</p></div>
      <div class="pulse-metric"><span>Credits used</span><strong>${totals.creditsUsed ?? 0}</strong><p>Live lookup credits consumed.</p></div>
    `;
  } catch (error) {
    adminOverview.className = "pulse-grid empty-copy";
    adminOverview.textContent = error.message || "Could not load admin metrics.";
  }
}

function inferInputSignals(input) {
  const notes = input.notes.toLowerCase();
  const keywordWords = input.keyword.split(/\s+/).filter(Boolean).length;
  const hasGeoKeyword = input.keyword.toLowerCase().includes(input.city.toLowerCase());
  const hasEmergencyIntent = /emergency|urgent|same day|24/.test(input.keyword.toLowerCase());
  const hasTrustHints = /review|license|certif|case|photo|testimonial|insured|warranty|portfolio/.test(notes);
  const hasContentHints = /blog|guide|faq|city|service area|neighborhood|case study|proof|portfolio/.test(notes);
  const hasGbpHints = /gbp|google business|maps|profile|citation|nap/.test(notes) || Boolean(input.mapsUrl);
  const competitorCount = input.competitors.length;

  return {
    keywordWords,
    hasGeoKeyword,
    hasEmergencyIntent,
    hasTrustHints,
    hasContentHints,
    hasGbpHints,
    competitorCount,
    inputCompleteness: [
      input.websiteUrl,
      input.businessName,
      input.city,
      input.state,
      input.keyword,
      input.mapsUrl,
      input.notes
    ].filter(Boolean).length
  };
}

function scoreUser(input, signals) {
  const base = 38;
  const topicalAuthority = clamp(base + signals.keywordWords * 5 + (signals.hasContentHints ? 12 : 0) - signals.competitorCount * 3);
  const localRelevance = clamp(42 + (input.city ? 10 : 0) + (input.state ? 6 : 0) + (signals.hasGeoKeyword ? 10 : 0) + (signals.hasGbpHints ? 7 : 0));
  const serviceCoverage = clamp(36 + signals.keywordWords * 4 + (signals.hasEmergencyIntent ? 7 : 0) + (signals.hasContentHints ? 9 : 0));
  const trustSignals = clamp(34 + (input.businessName ? 9 : 0) + (signals.hasTrustHints ? 16 : 0) + (signals.hasGbpHints ? 7 : 0));
  const internalLinking = clamp(33 + (signals.hasContentHints ? 14 : 0) + signals.keywordWords * 3);
  const gbpReadiness = clamp(35 + (input.mapsUrl ? 22 : 0) + (signals.hasGbpHints ? 10 : 0) + (input.city ? 5 : 0));
  const aiSearchReadiness = clamp(39 + signals.inputCompleteness * 3 + (signals.hasTrustHints ? 8 : 0) + (signals.hasContentHints ? 8 : 0));
  const competitivePressure = signals.competitorCount * 4;
  const average = (topicalAuthority + localRelevance + serviceCoverage + trustSignals + internalLinking + gbpReadiness + aiSearchReadiness) / 7;
  const totalOpportunity = clamp(100 - average + 38 + competitivePressure, 12, 96);

  return {
    topicalAuthority,
    localRelevance,
    serviceCoverage,
    trustSignals,
    internalLinking,
    gbpReadiness,
    aiSearchReadiness,
    totalOpportunity
  };
}

function competitorScore(url, index, input, signals) {
  const domain = domainFromUrl(url);
  const text = domain.toLowerCase();
  const exactDomainHint = input.keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .some((word) => text.includes(word.replace(/s$/, "")));
  const cityHint = text.includes(input.city.toLowerCase().replace(/\s+/g, "")) || text.includes(input.state.toLowerCase());
  const sizeHint = Math.min(domain.length, 22);
  const base = 58 + index * 5 + signals.competitorCount * 2;

  return {
    topicalCoverage: clamp(base + (exactDomainHint ? 9 : 0) + sizeHint * 0.4),
    servicePageDepth: clamp(base + 4 + (exactDomainHint ? 7 : 0)),
    cityRelevance: clamp(base - 3 + (cityHint ? 12 : 0)),
    trustSignals: clamp(base + 1 + (index === 0 ? 7 : 0)),
    internalLinking: clamp(base - 2 + index * 2),
    schemaReadiness: clamp(base - 5 + (exactDomainHint ? 4 : 0)),
    contentFreshness: clamp(base - 6 + index * 3),
    overallStrength: 0
  };
}

function analyzeCompetitors(input, userScores, signals) {
  const userRow = {
    id: "user",
    label: input.businessName || "Your website",
    website: input.websiteUrl,
    topicalCoverage: userScores.topicalAuthority,
    servicePageDepth: userScores.serviceCoverage,
    cityRelevance: userScores.localRelevance,
    trustSignals: userScores.trustSignals,
    internalLinking: userScores.internalLinking,
    schemaReadiness: Math.round((userScores.aiSearchReadiness + userScores.gbpReadiness) / 2),
    contentFreshness: clamp(userScores.topicalAuthority - 8 + (signals.hasContentHints ? 7 : 0)),
    overallStrength: 0
  };

  const competitors = input.competitors.map((competitor, index) => {
    const scores = competitorScore(competitor.url, index, input, signals);
    scores.overallStrength = averageCompetitor(scores);
    return {
      id: competitor.id,
      label: competitor.label,
      website: competitor.url,
      ...scores
    };
  });

  userRow.overallStrength = averageCompetitor(userRow);
  return [userRow, ...competitors];
}

function averageCompetitor(row) {
  return clamp(
    (row.topicalCoverage +
      row.servicePageDepth +
      row.cityRelevance +
      row.trustSignals +
      row.internalLinking +
      row.schemaReadiness +
      row.contentFreshness) /
      7
  );
}

function buildTopicGaps(input, scores) {
  const keyword = input.keyword || "primary service";
  const city = input.city || "target city";
  const baseTopics = [
    {
      topic: `${keyword} in ${city}`,
      why: `Build an exact-intent local service page that connects ${keyword} demand to ${city} proof, process, and calls to action.`,
      impact: "High",
      difficulty: "Medium",
      kind: "Core local page"
    },
    ...serviceModifiers.map((item) => ({
      topic:
        item.label === "Cost guide"
          ? `${keyword} cost guide in ${city}`
          : item.label === "FAQ"
            ? `${keyword} FAQ for ${city} customers`
            : item.label === "Before/after proof"
              ? `${city} ${keyword} proof examples`
              : item.label === "Neighborhood service-area pages"
                ? `${city} neighborhood and service-area pages`
                : `${item.label} ${keyword}`,
      why: topicWhy(item.label, keyword, city),
      impact: item.impact,
      difficulty: item.difficulty,
      kind: item.kind
    }))
  ];

  return baseTopics.map((item, index) => ({
    ...item,
    priority: priorityValue(item.impact, item.difficulty, scores.totalOpportunity / 12 - index * 0.5)
  }));
}

function topicWhy(label, keyword, city) {
  const options = {
    Emergency: `Emergency modifiers catch high-intent searches and clarify whether the business handles urgent ${keyword} requests.`,
    "Storm damage": `Storm and damage content helps match problem-aware queries and supports local proof after weather events.`,
    Leak: `Leak content captures urgent symptoms and routes visitors toward inspection, quote, and repair paths.`,
    "Cost guide": `Helpful cost guidance supports people-first content and gives AI/search systems clearer answers for commercial-intent queries.`,
    "Insurance claim": `Insurance content can close trust gaps when customers need documentation and process clarity.`,
    Commercial: `Commercial content separates business-intent searches from residential needs and can improve service-depth coverage.`,
    Residential: `Residential content clarifies homeowner fit, process, proof, and common repair scenarios.`,
    Financing: `Financing content reduces conversion friction and can support trust and affordability questions.`,
    "Before/after proof": `Proof pages provide local evidence, visual trust, and internal links back to ${keyword} and ${city} pages.`,
    FAQ: `FAQ content improves long-tail coverage and makes answers easier for AI search systems to cite or summarize.`,
    "Service process": `Process content builds confidence by explaining what happens before, during, and after the job.`,
    "Neighborhood service-area pages": `Neighborhood pages can support local relevance when they provide real service-area context, proof, and unique usefulness.`
  };
  return options[label] || `This topic expands ${keyword} authority in ${city}.`;
}

function buildEntitySignals(input, scores, signals) {
  return entitySignalTemplates.map(([name, guidance], index) => {
    const scoreBias = [
      scores.trustSignals,
      scores.gbpReadiness,
      scores.serviceCoverage,
      scores.localRelevance,
      scores.localRelevance - 8,
      scores.trustSignals,
      scores.trustSignals,
      scores.topicalAuthority,
      scores.trustSignals,
      scores.localRelevance,
      scores.gbpReadiness,
      scores.aiSearchReadiness,
      scores.aiSearchReadiness - 3,
      scores.aiSearchReadiness - 8,
      scores.internalLinking
    ][index];
    const state = scoreBias >= 74 ? "pass" : scoreBias >= 52 ? "warn" : "fail";
    return {
      name,
      guidance,
      state,
      score: clamp(scoreBias),
      action: actionForSignal(name, input, signals)
    };
  });
}

function actionForSignal(name, input, signals) {
  const city = input.city || "target city";
  const keyword = input.keyword || "primary service";
  if (name.includes("City")) return `Add natural ${city} references to the homepage, main ${keyword} page, and proof sections.`;
  if (name.includes("GBP")) return "Align GBP categories, services, description, photos, and landing pages with the site strategy.";
  if (name.includes("schema")) return "Add or audit structured data after the page hierarchy is finalized.";
  if (name.includes("Proof")) return `Publish local ${keyword} proof examples with photos, context, outcomes, and links.`;
  if (name.includes("Reviews")) return "Surface specific review themes near matching service pages and conversion points.";
  if (name.includes("Address")) return "Make NAP details crawlable and consistent across site, GBP, and citations.";
  if (signals.hasTrustHints) return "Audit current proof and make it more visible on money pages.";
  return "Document this signal clearly so search systems can connect the entity, service, and market.";
}

function buildInternalLinks(input) {
  const keyword = input.keyword || "main service";
  const city = input.city || "target city";
  return [
    {
      from: "Homepage",
      to: `${keyword} page`,
      why: "Route broad authority into the main commercial-intent service page.",
      impact: "High",
      difficulty: "Low"
    },
    {
      from: `${keyword} page`,
      to: `${city} ${keyword} page`,
      why: "Connect service relevance to the target local market.",
      impact: "High",
      difficulty: "Medium"
    },
    {
      from: `${city} page`,
      to: "Supporting service pages",
      why: "Help crawlers and users understand the full service menu in the target location.",
      impact: "Medium",
      difficulty: "Medium"
    },
    {
      from: "Cost guides and FAQs",
      to: "Money pages",
      why: "Move helpful informational traffic toward quote-ready pages without forcing the copy.",
      impact: "High",
      difficulty: "Low"
    },
    {
      from: "Proof pages",
      to: `${keyword} + ${city} pages`,
      why: "Use local proof to reinforce service authority and location relevance.",
      impact: "High",
      difficulty: "Medium"
    },
    {
      from: "Footer and service area hub",
      to: "Priority city pages",
      why: "Make the market architecture easy to crawl without stuffing navigation.",
      impact: "Medium",
      difficulty: "Low"
    }
  ].map((item) => ({
    ...item,
    priority: priorityValue(item.impact, item.difficulty)
  }));
}

function buildAiReadiness(input, scores) {
  return aiReadinessTemplates.map(([name, guidance], index) => {
    const bias = scores.aiSearchReadiness + (index % 3 === 0 ? 4 : index % 3 === 1 ? -3 : -8);
    const state = bias >= 74 ? "pass" : bias >= 52 ? "warn" : "fail";
    return {
      name,
      guidance,
      state,
      score: clamp(bias),
      action: aiAction(name, input)
    };
  });
}

function aiAction(name, input) {
  const keyword = input.keyword || "service";
  const city = input.city || "target city";
  if (name.includes("services")) return `Create a clear service taxonomy for ${keyword}, modifiers, and supporting pages.`;
  if (name.includes("area")) return `State the ${city} service area clearly and link to nearby markets only when useful.`;
  if (name.includes("proof")) return "Attach proof to claims: reviews, photos, credentials, policies, and outcomes.";
  if (name.includes("pricing")) return "Publish cost factors, quote process, and ranges where legally and commercially appropriate.";
  if (name.includes("Structured")) return "Use schema only to describe real visible page content.";
  return "Make the answer explicit in visible copy, then support it with structure and internal links.";
}

function buildRoadmap(input, scores, topicItems, linkItems) {
  const city = input.city || "target city";
  const keyword = input.keyword || "main service";
  const tasks = [
    {
      group: "Fix this week",
      name: `Map homepage links to the ${keyword} page and ${city} page`,
      why: "Search systems and users need a clear path from broad authority to local commercial intent.",
      impact: "High",
      difficulty: "Low",
      priority: Math.max(88, linkItems[0].priority)
    },
    {
      group: "Fix this week",
      name: "Audit GBP, NAP, and primary category alignment",
      why: "Local rankings rely on relevance, distance, and prominence signals across GBP, site, reviews, and citations.",
      impact: "High",
      difficulty: "Low",
      priority: priorityValue("High", "Low", scores.gbpReadiness < 65 ? 8 : 0)
    },
    {
      group: "Build this month",
      name: `Build dedicated "${topicItems[0].topic}" page`,
      why: "Competitors often win because they have exact-intent local coverage and service-depth pages.",
      impact: "High",
      difficulty: "Medium",
      priority: Math.max(90, topicItems[0].priority)
    },
    {
      group: "Build this month",
      name: `Publish ${city} ${keyword} proof pages`,
      why: "Proof examples connect local evidence, trust signals, entity clarity, and internal links.",
      impact: "High",
      difficulty: "Medium",
      priority: priorityValue("High", "Medium", scores.trustSignals < 60 ? 8 : 0)
    },
    {
      group: "Build this month",
      name: `Create ${keyword} cost and FAQ content`,
      why: "Helpful answers support people-first content and improve AI-search readability.",
      impact: "High",
      difficulty: "Medium",
      priority: priorityValue("High", "Medium", scores.aiSearchReadiness < 65 ? 7 : 0)
    },
    {
      group: "Build next quarter",
      name: "Create a service-area hub with neighborhood pages",
      why: "A useful local architecture can improve relevance without thin doorway pages.",
      impact: "High",
      difficulty: "High",
      priority: priorityValue("High", "High", scores.localRelevance < 62 ? 9 : 0)
    },
    {
      group: "Build next quarter",
      name: "Connect live crawl, SERP, GBP, GSC, and PageSpeed data",
      why: "The deterministic model is useful for planning, but live data will improve evidence, confidence, and prioritization.",
      impact: "High",
      difficulty: "High",
      priority: 86
    }
  ];

  return ["Fix this week", "Build this month", "Build next quarter"].map((group) => ({
    group,
    tasks: tasks.filter((task) => task.group === group)
  }));
}

function deterministicNoise(input, x, y) {
  const seed = `${input.websiteUrl}|${input.businessName}|${input.city}|${input.keyword}`
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((seed + x * 17 + y * 31 + x * y * 7) % 9) - 4;
}

function buildTerritory(input, scores, competitors) {
  const size = normalizeGridSize(input.gridSize);
  const center = (size - 1) / 2;
  const cells = [];
  const ranks = [];
  const userStrength =
    (scores.topicalAuthority +
      scores.localRelevance +
      scores.serviceCoverage +
      scores.trustSignals +
      scores.gbpReadiness) /
    5;
  const baseRank = clamp(8 - userStrength / 12 + competitors.length * 0.65, 1, 16);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const competitorPocket = x < center - 2 && y > center + 1 ? 4.2 : 0;
      const localCoreLift = distance < 2.3 ? -2.6 : 0;
      const neighborhoodDrag = distance > 5.2 ? 1.7 : 0;
      const rank = clamp(
        baseRank +
          distance * 0.55 +
          deterministicNoise(input, x, y) * 0.38 +
          competitorPocket +
          localCoreLift +
          neighborhoodDrag,
        1,
        20
      );
      ranks.push(rank);
      cells.push({
        x,
        y,
        rank,
        displayRank: String(rank),
        center: x === Math.floor(center) && y === Math.floor(center),
        tone: rankTone(rank)
      });
    }
  }

  const wins = ranks.filter((rank) => rank <= 3).length;
  const nearWins = ranks.filter((rank) => rank > 3 && rank <= 7).length;
  const weak = ranks.filter((rank) => rank >= 11).length;
  const averageRank = clamp(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length, 1, 20);
  const coverage = clamp((wins / ranks.length) * 100);
  const contested = clamp(((nearWins + weak) / ranks.length) * 100);
  const radiusMiles = Math.max(3, Math.round(((size - 1) * (input.pointSpacingKm || 2) * 0.621371) / 2));
  const radius = `${radiusMiles} mi`;

  return {
    size,
    cells,
    averageRank,
    coverage,
    contested,
    weak,
    wins,
    radius,
    rankPoints: ranks.length,
    coverageArea: `${Math.round(Math.PI * radiusMiles * radiusMiles)} sq mi`,
    pointSpacing: `${input.pointSpacingKm || 2} km`,
    market: `${input.city || "Target city"}, ${input.state || "State"}`,
    gridSize: `${size} x ${size}`,
    dataStatus: "Strategy estimate only. Run a live Maps scan to replace modeled cells with observed rank evidence.",
    provider: "client-estimate"
  };
}

function rankTone(rank) {
  if (rank <= 3) return "win";
  if (rank <= 6) return "near";
  if (rank <= 10) return "watch";
  if (rank <= 14) return "losing";
  return "critical";
}

function weakestLayer(scores) {
  return scoreDefinitions
    .filter(([key]) => key !== "totalOpportunity")
    .map(([key, label]) => ({ key, label, score: scores[key] }))
    .sort((a, b) => a.score - b.score)[0];
}

function analyzeLocalSeo(input) {
  const signals = inferInputSignals(input);
  const scores = scoreUser(input, signals);
  const competitors = analyzeCompetitors(input, scores, signals);
  const topics = buildTopicGaps(input, scores);
  const entities = buildEntitySignals(input, scores, signals);
  const links = buildInternalLinks(input);
  const ai = buildAiReadiness(input, scores);
  const roadmapGroups = buildRoadmap(input, scores, topics, links);
  const territory = buildTerritory(input, scores, input.competitors);

  return {
    generatedAt: new Date().toISOString(),
    modelStatus: estimatedModelStatus,
    input,
    scores,
    competitors,
    topics,
    entities,
    links,
    ai,
    roadmap: roadmapGroups,
    territory,
    scan: {
      mode: "estimate",
      provider: "strategy-model",
      requestCostCredits: 0,
      chargedCredits: 0,
      reason: "estimate_mode"
    },
    futureIntegrations: [
      "Google Search Console API",
      "Google Business Profile API",
      "Live Maps/SERP provider API",
      "PageSpeed Insights API",
      "Firecrawl, Crawl4AI, or site crawler",
      "Ahrefs, Semrush, or DataForSEO",
      "Places API",
      "Review and citation data source"
    ]
  };
}

function renderReport(report) {
  currentReport = report;
  const { input, scores } = report;
  const live = report.scan?.mode === "live";
  reportTitle.textContent = `${input.city}, ${input.state}: ${input.keyword} territory`;
  reportSubtitle.textContent = live
    ? `${input.businessName || domainFromUrl(input.websiteUrl)} is mapped from observed provider-backed Maps rank checks and interpreted against topical, entity, service-depth, internal link, GBP, and AI-readable trust signals.`
    : `${input.businessName || domainFromUrl(input.websiteUrl)} is modeled from your inputs for planning. The grid is not observed ranking evidence until a live Maps scan is run.`;
  totalScore.textContent = scores.totalOpportunity;
  renderTerritory(report);
  renderMarketPulse(report);
  renderQuickRead(report);
  renderScorecards(scores);
  renderComparison(report.competitors);
  renderTopics(report.topics);
  renderEntities(report.entities);
  renderLinks(report.links);
  renderAiReadiness(report.ai);
  renderRoadmap(report.roadmap);
  setExportsEnabled(true);
}

function renderTerritory(report) {
  const territory = report.territory;
  const generatedDate = new Date(report.generatedAt).toLocaleDateString();
  const live = report.scan?.mode === "live";
  const badge = live ? "Observed live data" : "Modeled estimate";
  const rankWord = live ? "Live" : "Modeled";
  const surfaceTitle = live ? "Live Maps rank grid" : "Strategy territory grid";
  const surfaceNote = live
    ? "Rank dots are observed provider results. Map tiles are geographic context, not the rank data source."
    : "Rank dots are a planning model. Map tiles are geographic context only.";
  const providerNote = live
    ? `${territory.rankPoints} live provider checks. Matched cells show observed rank; 20+ means not found in returned results.`
    : "No provider request was made for this grid.";
  const tileLayer = renderMapTileLayer(report.input);
  territoryMap.className = "territory-map";
  territoryMap.innerHTML = `
    <div class="territory-shell ranking-shell">
      <div class="ranking-map-frame" aria-label="${live ? "Live" : "Estimated"} local rank grid for ${escapeHtml(territory.market)}">
        ${tileLayer}
        <aside class="grid-details-panel">
          <div class="grid-panel-title">Grid Details</div>
          <dl>
            <div><dt>Created date</dt><dd>${generatedDate}</dd></div>
            <div><dt>Business name</dt><dd>${escapeHtml(report.input.businessName || domainFromUrl(report.input.websiteUrl))}</dd></div>
            <div><dt>Keyword</dt><dd>${escapeHtml(report.input.keyword)}</dd></div>
            <div><dt>Center point</dt><dd>${escapeHtml(territory.market)}</dd></div>
            <div><dt>View type</dt><dd>${escapeHtml(surfaceTitle)}</dd></div>
            <div><dt>Grid size</dt><dd>${territory.gridSize}</dd></div>
            <div><dt>Distance between points</dt><dd>${territory.pointSpacing}</dd></div>
            <div><dt>Radius</dt><dd>${territory.radius}</dd></div>
            <div><dt>Coverage</dt><dd>${territory.coverageArea}</dd></div>
            <div><dt>Data source</dt><dd>${live ? "Live provider" : "Strategy model"}</dd></div>
          </dl>
          <div class="panel-stats">
            <span><b>${territory.averageRank ?? "20+"}</b><small>Average rank</small></span>
            <span><b>${territory.rankPoints}/${territory.size * territory.size}</b><small>Rank points</small></span>
          </div>
          <span class="panel-badge ${live ? "is-live" : ""}">${badge}</span>
          <p>${escapeHtml(providerNote)}</p>
        </aside>

        <div class="grid-surface-label">
          <span>${escapeHtml(surfaceTitle)}</span>
          <strong>${escapeHtml(territory.market)}</strong>
          <small>${escapeHtml(surfaceNote)}</small>
        </div>

        <div class="data-source-banner ${live ? "is-live" : ""}">
          <strong>${live ? "Observed rank evidence" : "Modeled planning estimate"}</strong>
          <span>${live ? "Live scan cells came from server-side Maps provider calls." : "No live Google Maps/SERP request was made for these cells."}</span>
        </div>

        <div class="rank-coverage" aria-hidden="true"></div>
        <div class="rank-heat rank-heat-a" aria-hidden="true"></div>
        <div class="rank-heat rank-heat-b" aria-hidden="true"></div>
        <div class="territory-grid local-ranking-grid" style="grid-template-columns: repeat(${territory.size}, minmax(18px, 1fr));">
          ${territory.cells
            .map(
              (cell) =>
                `<span class="rank-cell ${cell.tone}${cell.center ? " center" : ""}" title="${rankWord} rank ${cell.displayRank || cell.rank || "20+"}">${cell.displayRank || cell.rank || "20+"}</span>`
            )
            .join("")}
        </div>
      </div>

      <div class="map-legend" aria-label="Rank grid legend">
        <span>1-3: local pack</span>
        <span>4-6: near win</span>
        <span>7-10: contested</span>
        <span>11+: weak zone</span>
      </div>

      <div class="territory-insights grid-summary-row">
        <div class="insight-row">
          <span>Average grid rank</span>
          <strong>${territory.averageRank ?? "20+"}</strong>
          <p>${live ? "Observed" : "Directional estimate"} across a ${territory.radius} competitive radius.</p>
        </div>
        <div class="insight-row">
          <span>Local pack cells</span>
          <strong>${territory.coverage}%</strong>
          <p>${territory.wins} ${live ? "observed" : "estimated"} cells rank in positions 1-3.</p>
        </div>
        <div class="insight-row">
          <span>Weak pockets</span>
          <strong>${territory.weak}</strong>
          <p>Likely neighborhoods or service modifiers where stronger competitors can win.</p>
        </div>
        <div class="insight-row">
          <span>Evidence source</span>
          <strong>${territory.gridSize}</strong>
          <p>${escapeHtml(report.modelStatus)}</p>
        </div>
      </div>
    </div>
  `;
}

function renderMapTileLayer(input) {
  if (!Number.isFinite(input.centerLat) || !Number.isFinite(input.centerLon)) {
    return `<div class="synthetic-map-layer" aria-hidden="true"></div>`;
  }
  const zoom = 12;
  const center = latLonToTile(input.centerLat, input.centerLon, zoom);
  const tiles = [];
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      const x = wrapTile(center.x + col, zoom);
      const y = clampTile(center.y + row, zoom);
      tiles.push(`<img class="osm-tile" alt="" src="https://tile.openstreetmap.org/${zoom}/${x}/${y}.png" loading="lazy" />`);
    }
  }
  return `
    <div class="osm-tile-layer" aria-hidden="true">${tiles.join("")}</div>
    <span class="map-attribution">Map tiles: OpenStreetMap contributors</span>
  `;
}

function latLonToTile(lat, lon, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale);
  return { x, y };
}

function wrapTile(x, zoom) {
  const scale = 2 ** zoom;
  return ((x % scale) + scale) % scale;
}

function clampTile(y, zoom) {
  const scale = 2 ** zoom;
  return Math.max(0, Math.min(scale - 1, y));
}

function renderMarketPulse(report) {
  const strongestCompetitor = report.competitors
    .filter((row) => row.id !== "user")
    .sort((a, b) => b.overallStrength - a.overallStrength)[0];
  const live = report.scan?.mode === "live";
  const confidence = live
    ? "Live Maps evidence"
    : report.input.competitors.length >= 3
      ? "Strong input set"
      : report.input.competitors.length
        ? "Partial input set"
        : "Needs competitors";
  marketPulse.className = "pulse-grid";
  marketPulse.innerHTML = `
    <div class="pulse-metric">
      <span>Opportunity score</span>
      <strong>${report.scores.totalOpportunity}/100</strong>
      <p>Higher means more upside from closing authority gaps.</p>
    </div>
    <div class="pulse-metric">
      <span>Coverage pressure</span>
      <strong>${report.territory.contested}%</strong>
      <p>${live ? "Observed" : "Estimated"} grid cells that are near-win, contested, or weak.</p>
    </div>
    <div class="pulse-metric">
      <span>Competitor ceiling</span>
      <strong>${strongestCompetitor ? strongestCompetitor.overallStrength : "--"}</strong>
      <p>${strongestCompetitor ? escapeHtml(domainFromUrl(strongestCompetitor.website)) : "Add competitors to estimate the ceiling."}</p>
    </div>
    <div class="pulse-metric">
      <span>Evidence level</span>
      <strong>${confidence}</strong>
      <p>${escapeHtml(report.modelStatus)}</p>
    </div>
  `;
}

function renderQuickRead(report) {
  const weakest = weakestLayer(report.scores);
  const firstTopic = report.topics[0];
  const firstTask = report.roadmap[0]?.tasks[0];
  quickRead.className = "quick-read";
  quickRead.innerHTML = `
    <div class="quick-read-item">
      <b>1</b>
      <div>
        <strong>Weakest authority layer: ${escapeHtml(weakest.label.replace(" Score", ""))}</strong>
        <p>This layer is scoring ${weakest.score}/100, so the roadmap should prioritize proof, coverage, and structure around it.</p>
      </div>
    </div>
    <div class="quick-read-item">
      <b>2</b>
      <div>
        <strong>First content asset: ${escapeHtml(firstTopic.topic)}</strong>
        <p>${escapeHtml(firstTopic.why)}</p>
      </div>
    </div>
    <div class="quick-read-item">
      <b>3</b>
      <div>
        <strong>First operational task: ${escapeHtml(firstTask?.name || "Audit GBP and internal links")}</strong>
        <p>${escapeHtml(firstTask?.why || "Make the business, service, and market relationship explicit.")}</p>
      </div>
    </div>
  `;
}

function renderScorecards(scores) {
  scorecards.className = "score-grid";
  scorecards.innerHTML = scoreDefinitions
    .map(([key, label, description]) => {
      const score = scores[key];
      const tone = toneFor(score);
      return `
        <article class="score-card tone-${tone}">
          <div class="score-topline">
            <span class="score-number">${score}</span>
            <span class="score-status">${statusFor(score)}</span>
          </div>
          <strong>${label}</strong>
          <div class="score-bar" aria-label="${label}: ${score} out of 100"><span style="width:${score}%"></span></div>
          <p>${description}</p>
        </article>
      `;
    })
    .join("");
}

function renderComparison(rows) {
  comparisonTable.className = "table-wrap";
  const headers = [
    ["topicalCoverage", "Topical coverage"],
    ["servicePageDepth", "Service depth"],
    ["cityRelevance", "City relevance"],
    ["trustSignals", "Trust signals"],
    ["internalLinking", "Internal links"],
    ["schemaReadiness", "Schema readiness"],
    ["contentFreshness", "Freshness"],
    ["overallStrength", "Overall"]
  ];
  comparisonTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Website</th>
          ${headers.map(([, label]) => `<th>${label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>
                  <div class="website-cell">
                    <strong>${escapeHtml(row.label)}</strong>
                    <span>${escapeHtml(domainFromUrl(row.website) || row.website)}</span>
                  </div>
                </td>
                ${headers.map(([key]) => `<td>${metricChip(row[key])}</td>`).join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function metricChip(score) {
  return `<span class="metric-chip status-pill ${toneFor(score)}">${score}</span>`;
}

function renderTopics(items) {
  topicGaps.className = "list-stack";
  topicGaps.innerHTML = items
    .map(
      (item) => `
        <div class="topic-item">
          <div class="topic-row">
            <span class="dot ${priorityClass(item.priority)}"></span>
            <strong>${escapeHtml(item.topic)}</strong>
            <span class="mini-chip">${item.priority}/100</span>
          </div>
          <p>${escapeHtml(item.why)}</p>
          <div class="topic-meta">
            <span class="mini-chip">${item.kind}</span>
            <span class="mini-chip">Impact: ${item.impact}</span>
            <span class="mini-chip">Difficulty: ${item.difficulty}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderEntities(items) {
  entitySignals.className = "checklist";
  entitySignals.innerHTML = items
    .map(
      (item) => `
        <div class="signal-item">
          <span class="check-icon ${item.state}">${item.state === "pass" ? "OK" : "!"}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${escapeHtml(item.guidance)}</p>
            <p><b>Action:</b> ${escapeHtml(item.action)}</p>
          </div>
          <span class="mini-chip">${item.score}</span>
        </div>
      `
    )
    .join("");
}

function renderLinks(items) {
  internalLinks.className = "link-plan";
  internalLinks.innerHTML = items
    .map(
      (item) => `
        <div class="link-item">
          <div class="link-path">
            <span>${escapeHtml(item.from)}</span>
            <b>-&gt;</b>
            <span>${escapeHtml(item.to)}</span>
          </div>
          <p>${escapeHtml(item.why)}</p>
          <div class="link-meta">
            <span class="mini-chip">Impact: ${item.impact}</span>
            <span class="mini-chip">Difficulty: ${item.difficulty}</span>
            <span class="mini-chip">Priority: ${item.priority}/100</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderAiReadiness(items) {
  aiReadiness.className = "readiness-list";
  aiReadiness.innerHTML = items
    .map(
      (item) => `
        <div class="readiness-item">
          <span class="check-icon ${item.state}">${item.state === "pass" ? "OK" : "!"}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>${escapeHtml(item.guidance)}</p>
            <p><b>Action:</b> ${escapeHtml(item.action)}</p>
          </div>
          <span class="mini-chip">${item.score}</span>
        </div>
      `
    )
    .join("");
}

function renderRoadmap(groups) {
  roadmap.className = "roadmap";
  roadmap.innerHTML = groups
    .map(
      (group) => `
        <div class="roadmap-group">
          <h4>${escapeHtml(group.group)}</h4>
          ${group.tasks
            .map(
              (task) => `
                <div class="roadmap-task">
                  <div>
                    <strong>${escapeHtml(task.name)}</strong>
                    <p>${escapeHtml(task.why)}</p>
                    <div class="task-meta">
                      <span class="mini-chip">Impact: ${task.impact}</span>
                      <span class="mini-chip">Difficulty: ${task.difficulty}</span>
                    </div>
                  </div>
                  <span class="priority-score">${task.priority}</span>
                </div>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");
}

function priorityClass(priority) {
  if (priority >= 85) return "high";
  if (priority >= 68) return "medium";
  return "low";
}

function setExportsEnabled(enabled) {
  Object.values(exportButtons).forEach((button) => {
    button.disabled = !enabled;
  });
}

function setFormBusy(enabled, input = readInput()) {
  isGenerating = enabled;
  form.setAttribute("aria-busy", String(enabled));
  if (submitButton) {
    submitButton.disabled = enabled;
    submitButton.textContent = enabled
      ? input.scanMode === "live"
        ? "Running live Maps scan..."
        : "Generating..."
      : input.scanMode === "live"
        ? "Run live Maps scan"
        : "Generate strategy report";
  }
  exampleButton.disabled = enabled;
}

function setScanStatus(message, tone = "neutral") {
  if (!scanStatus) return;
  scanStatus.textContent = message;
  scanStatus.className = `scan-status${tone === "live" ? " is-live" : tone === "warning" ? " is-warning" : tone === "error" ? " is-error" : ""}`;
}

function setModelStatusUI({ kicker = "Workspace status", state = "Ready", note = "Strategy reports are labeled separately from live Maps evidence." } = {}) {
  if (modelKicker) modelKicker.textContent = kicker;
  if (modelState) modelState.textContent = state;
  if (modelNote) modelNote.textContent = note;
}

function updateCostEstimate() {
  const input = readInput();
  const requests = input.gridSize * input.gridSize;
  if (costEstimate) {
    const capNote =
      input.scanMode === "live" && requests > 81
        ? " Choose 7x7 or 9x9 for the current account cap."
        : " Current account cap is 81 cells per scan.";
    costEstimate.textContent = `${input.gridSize} x ${input.gridSize} grid = ${requests} credits for a live Maps scan.${capNote}`;
  }
  setFormBusy(false, input);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportToText(report) {
  const lines = [
    `Local SEO Ranker Territory Report`,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `Status: ${report.modelStatus}`,
    `Evidence source: ${report.scan?.mode === "live" ? "Live Maps scan" : "Strategy model"}`,
    `Credits charged: ${report.scan?.chargedCredits ?? 0}`,
    ``,
    `Business: ${report.input.businessName}`,
    `Website: ${report.input.websiteUrl}`,
    `Market: ${report.input.city}, ${report.input.state}`,
    `Keyword: ${report.input.keyword}`,
    ``,
    `Territory`,
    `- Average grid rank: ${report.territory.averageRank}`,
    `- Local pack coverage: ${report.territory.coverage}%`,
    `- Coverage pressure: ${report.territory.contested}%`,
    `- Weak pockets: ${report.territory.weak}`,
    `- Radius: ${report.territory.radius}`,
    `- Grid size: ${report.territory.gridSize}`,
    `- Point spacing: ${report.territory.pointSpacing}`,
    ``,
    `Scores`,
    ...scoreDefinitions.map(([, label], index) => {
      const key = scoreDefinitions[index][0];
      return `- ${label}: ${report.scores[key]}/100`;
    }),
    ``,
    `Top Topic Gaps`,
    ...report.topics.slice(0, 10).map((item) => `- ${item.topic}: ${item.why} Priority ${item.priority}/100`),
    ``,
    `Priority Roadmap`,
    ...report.roadmap.flatMap((group) => [
      group.group,
      ...group.tasks.map((task) => `- ${task.name}: ${task.why} Priority ${task.priority}/100`)
    ])
  ];
  return lines.join("\n");
}

function reportToCsv(report) {
  const rows = [["Section", "Item", "Score or Priority", "Impact", "Difficulty", "Notes"]];
  rows.push(["Scan", "Evidence source", report.scan?.mode === "live" ? "Live Maps scan" : "Strategy model", "", "", report.modelStatus]);
  rows.push(["Scan", "Credits charged", report.scan?.chargedCredits ?? 0, "", "", report.scan?.reason || ""]);
  rows.push(["Territory", "Average grid rank", report.territory.averageRank, "", "", report.territory.dataStatus]);
  rows.push(["Territory", "Local pack coverage", `${report.territory.coverage}%`, "", "", `${report.territory.wins} cells in positions 1-3`]);
  rows.push(["Territory", "Coverage pressure", `${report.territory.contested}%`, "", "", "Near-win, contested, or weak cells"]);
  rows.push(["Territory", "Weak pockets", report.territory.weak, "", "", `Radius ${report.territory.radius}`]);
  scoreDefinitions.forEach(([key, label, description]) => {
    rows.push(["Score", label, report.scores[key], "", "", description]);
  });
  report.topics.forEach((item) => {
    rows.push(["Topic gap", item.topic, item.priority, item.impact, item.difficulty, item.why]);
  });
  report.roadmap.forEach((group) => {
    group.tasks.forEach((task) => {
      rows.push([group.group, task.name, task.priority, task.impact, task.difficulty, task.why]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

async function requestProviderScan(input) {
  const response = await fetch("/api/scans", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error(`Scan API returned ${response.status}.`);
  }
  if (!response.ok) {
    throw Object.assign(new Error(liveUnavailableMessage(payload.code || payload.reason) || payload.error || `Scan API returned ${response.status}.`), {
      status: response.status,
      code: payload.code || payload.reason || "",
      payload
    });
  }
  return payload;
}

function applyProviderScan(report, scanResult) {
  report.scan = {
    mode: scanResult.mode === "live" ? "live" : "estimate",
    provider: scanResult.provider || "scrappa",
    requestCostCredits: scanResult.requestCostCredits || 0,
    chargedCredits: scanResult.chargedCredits || 0,
    reason: scanResult.reason || ""
  };

  if (scanResult.account) {
    setAccount(scanResult.account);
  }

  if (scanResult.mode === "live" && scanResult.territory) {
    report.territory = scanResult.territory;
    report.modelStatus = scanResult.modelStatus;
    report.generatedAt = scanResult.generatedAt || report.generatedAt;
    return "live";
  }

  report.modelStatus = scanResult.modelStatus || liveUnavailableMessage(scanResult.reason);
  return "fallback";
}

function liveUnavailableMessage(reason) {
  const messages = {
    auth_required: "Sign in before running a live Maps scan.",
    session_expired: "Your session expired. Sign in again to continue.",
    insufficient_credits: "Not enough credits remain for this live scan.",
    rate_limited: "Too many live lookups were requested in a short period. Try again later.",
    live_scans_disabled: "Live Maps scans are not available right now.",
    grid_too_large: "This grid is above the current live-scan cap. Choose 7x7 or 9x9.",
    missing_scrappa_key: "Live Maps scans are not configured yet.",
    missing_provider_key: "Live lookup provider is not configured yet.",
    missing_center_coordinates: "Live Maps scans require center latitude and longitude. Use Find center or enter coordinates.",
    db_missing: "Account storage is not configured yet.",
    estimate_mode: estimatedModelStatus,
    api_unavailable: "Live Maps scanning is temporarily unavailable."
  };
  return messages[reason] || "Live Maps scan unavailable.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  const input = readInput();
  setFormBusy(true, input);
  setExportsEnabled(false);
  try {
    let report = analyzeLocalSeo(input);

    if (input.scanMode === "live") {
      if (!currentAccount) {
        setScanStatus("Sign in before running a live Maps scan.", "error");
        setModelStatusUI({ kicker: "Action needed", state: "Sign in", note: "Live rank checks are tied to account credits, coordinates, and saved history." });
        showToast("Sign in before running a live Maps scan.");
        return;
      }
      setScanStatus("Running live Maps scan...", "warning");
      try {
        const scanResult = await requestProviderScan(input);
        const resultMode = applyProviderScan(report, scanResult);
        if (resultMode === "live") {
          const charged = report.scan.chargedCredits ?? report.scan.requestCostCredits;
          setScanStatus(`Live Maps scan complete. ${charged} credits used.`, "live");
          setModelStatusUI({ kicker: "Observed evidence", state: "Live Maps scan", note: `${charged} credits used. Provider-backed results saved to history.` });
          showToast("Live Maps report generated.");
          loadHistory();
        } else {
          setScanStatus(report.modelStatus, "warning");
          setModelStatusUI({ kicker: "Strategy model", state: "Not live", note: report.modelStatus });
          showToast("Strategy report generated.");
        }
      } catch (error) {
        const reason = error.code || error.payload?.code || error.payload?.reason || "api_unavailable";
        const message = liveUnavailableMessage(reason);
        setScanStatus(message, "error");
        setModelStatusUI({ kicker: "Live scan", state: "Needs attention", note: message });
        showToast(message);
        return;
      }
    } else {
      setScanStatus(estimatedModelStatus, "neutral");
      setModelStatusUI({ kicker: "Strategy estimate", state: "Not live data", note: "Planning report generated without using live scan credits or provider calls." });
      showToast("Strategy report generated.");
    }

    renderReport(report);
  } catch (error) {
    console.error(error);
    setScanStatus("Could not generate the report. Check the inputs and try again.", "error");
    showToast("Could not generate the report. Check the inputs and try again.");
  } finally {
    setFormBusy(false, input);
  }
});

exampleButton.addEventListener("click", () => {
  loadExample();
});

function loadExample() {
  const example = {
    websiteUrl: "https://atlanta-hometownroofing.example",
    businessName: "Hometown Roofing Atlanta",
    city: "Atlanta",
    state: "GA",
    keyword: "roof repair",
    mapsUrl: "https://maps.google.com/?cid=123456789",
    centerLat: "33.7490",
    centerLon: "-84.3880",
    gridSize: "9",
    pointSpacingKm: "2",
    scanMode: "estimate",
    competitor1: "https://atlantaroofrepairpros.example",
    competitor2: "https://stormroofatlanta.example",
    competitor3: "https://georgiaroofexperts.example",
    notes:
      "GBP exists, but service pages are thin. Good reviews and licenses. Need neighborhood pages, proof examples, cost guide, and stronger internal links."
  };
  Object.entries(example).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
  updateCostEstimate();
  form.requestSubmit();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginButton) loginButton.disabled = true;
  const data = new FormData(loginForm);
  try {
    const payload = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: normalizeText(data.get("email")),
        name: normalizeText(data.get("name")),
        accessCode: normalizeText(data.get("accessCode"))
      })
    });
    setAccount(payload.account);
    setModelStatusUI({ kicker: "Workspace", state: "Signed in", note: "Live Maps scans are available when credits, provider configuration, and coordinates are ready." });
    setScanStatus("Signed in. Live Maps scans will be saved to this workspace.", "live");
    showToast("Signed in.");
  } catch (error) {
    const message =
      error.code === "invalid_access_code"
        ? "This workspace requires an access code for new accounts. Returning users can continue with email."
        : error.message || "Could not enter workspace.";
    setScanStatus(message, "error");
    showToast(message);
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    setModelStatusUI();
    setScanStatus("Signed out. Strategy reports are still available without credits.", "neutral");
    showToast("Signed out.");
  } catch (error) {
    showToast(error.message || "Could not sign out.");
  } finally {
    logoutButton.disabled = false;
  }
});

findCenterButton?.addEventListener("click", async () => {
  const input = readInput();
  if (!currentAccount) {
    setScanStatus("Sign in before finding a live map center.", "error");
    showToast("Sign in before finding a live map center.");
    return;
  }
  if (!input.businessName || !input.city || !input.state) {
    setScanStatus("Business name, city, and state are required to find a map center.", "error");
    showToast("Add business name, city, and state first.");
    return;
  }

  findCenterButton.disabled = true;
  setScanStatus("Finding map center...", "warning");
  try {
    const payload = await apiFetch("/api/geocode", {
      method: "POST",
      body: JSON.stringify({
        businessName: input.businessName,
        city: input.city,
        state: input.state
      })
    });
    const selected = payload.selected;
    form.elements.namedItem("centerLat").value = selected.lat;
    form.elements.namedItem("centerLon").value = selected.lon;
    if (payload.account) setAccount(payload.account);
    const charged = payload.chargedCredits || 0;
    setScanStatus(`Map center found for ${selected.name || input.businessName}. ${charged} credit${charged === 1 ? "" : "s"} used.`, "live");
    setModelStatusUI({ kicker: "Map center", state: "Found", note: selected.address || `${selected.lat}, ${selected.lon}` });
    showToast("Map center found.");
  } catch (error) {
    const message = liveUnavailableMessage(error.code || error.payload?.code) || error.message || "Could not find a map center.";
    setScanStatus(message, "error");
    showToast(message);
  } finally {
    findCenterButton.disabled = false;
  }
});

scheduleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentAccount) {
    setScanStatus("Sign in before saving scheduled scans.", "error");
    showToast("Sign in before saving scheduled scans.");
    return;
  }

  const input = readInput();
  if (!input.businessName || !input.websiteUrl || !input.keyword || !input.city || !input.state) {
    setScanStatus("Add business, website, keyword, city, and state before saving a schedule.", "error");
    showToast("Complete the market fields first.");
    return;
  }
  if (!Number.isFinite(input.centerLat) || !Number.isFinite(input.centerLon)) {
    setScanStatus("Scheduled live scans need a center point. Use Find center or enter coordinates.", "error");
    showToast("Add a map center before scheduling.");
    return;
  }

  const formData = new FormData(scheduleForm);
  const payload = {
    input: { ...input, scanMode: "live" },
    frequency: normalizeText(formData.get("frequency")) || "weekly",
    threshold: Number.parseInt(formData.get("threshold"), 10) || 7,
    alertEmail: normalizeText(formData.get("alertEmail")) || currentAccount.user?.email || ""
  };

  if (scheduleButton) scheduleButton.disabled = true;
  try {
    const response = await apiFetch("/api/schedules", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    renderSchedules(response.schedules || [response.schedule].filter(Boolean));
    setScanStatus("Monitoring rule saved. Alert settings are tied to this workspace.", "live");
    showToast("Monitoring started.");
  } catch (error) {
    const message = error.message || "Could not save scheduled scan.";
    setScanStatus(message, "error");
    showToast(message);
  } finally {
    if (scheduleButton) scheduleButton.disabled = false;
  }
});

gridSizeField?.addEventListener("change", updateCostEstimate);
scanModeControls.forEach((control) => {
  control.addEventListener("change", () => {
    const input = readInput();
    setFormBusy(false, input);
    setScanStatus(
      input.scanMode === "live"
        ? "Live Maps scans use account credits and require center coordinates."
        : estimatedModelStatus,
      input.scanMode === "live" ? "warning" : "neutral"
    );
    setModelStatusUI(
      input.scanMode === "live"
        ? { kicker: "Live mode", state: "Maps scan", note: "Sign in, confirm center coordinates, then run the provider-backed scan." }
        : undefined
    );
    updateCostEstimate();
  });
});
updateCostEstimate();
loadAccount();

const initialParams = new URLSearchParams(window.location.search);
if (initialParams.get("example") === "1" || initialParams.get("demo") === "1") {
  loadExample();
}

exportButtons.copy.addEventListener("click", async () => {
  if (!currentReport) return;
  const reportText = reportToText(currentReport);
  try {
    await copyText(reportText);
    showToast("Report copied to clipboard.");
  } catch {
    downloadFile("local-seo-ranker-report.txt", reportText, "text/plain");
    showToast("Clipboard blocked. Downloaded a text report instead.");
  }
});

exportButtons.json.addEventListener("click", () => {
  if (!currentReport) return;
  downloadFile("local-seo-ranker-report.json", JSON.stringify(currentReport, null, 2), "application/json");
});

exportButtons.csv.addEventListener("click", () => {
  if (!currentReport) return;
  downloadFile("local-seo-ranker-report.csv", reportToCsv(currentReport), "text/csv");
});

exportButtons.print.addEventListener("click", () => {
  if (!currentReport) return;
  window.print();
});

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browser contexts where the Clipboard API is present but not focused.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard copy command failed.");
  }
}

// API integration note: replace analyzeLocalSeo with a pipeline that enriches the same report shape from
// GSC, GBP, SERP, PageSpeed, crawler, Places, review, citation, and link intelligence providers.
