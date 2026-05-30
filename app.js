const form = document.querySelector("#seo-form");
const demoButton = document.querySelector("#demo-button");
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
const exportButtons = {
  copy: document.querySelector("#copy-report"),
  json: document.querySelector("#download-json"),
  csv: document.querySelector("#download-csv"),
  print: document.querySelector("#print-report")
};

let currentReport = null;

const scoreDefinitions = [
  ["topicalAuthority", "Topical Authority Score", "Depth of service and supporting content around the target keyword."],
  ["localRelevance", "Local Relevance Score", "How clearly the site connects service intent to the target city and state."],
  ["serviceCoverage", "Service Coverage Score", "Breadth of exact-intent service, modifier, and sub-service pages."],
  ["trustSignals", "Trust Signal Score", "Proof elements, reviews, licenses, project examples, and business identity clarity."],
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
  { label: "Before and after projects", impact: "High", difficulty: "Medium", kind: "Proof" },
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
  ["Project examples", "Completed work pages help prove prominence, service depth, and local experience."],
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
  ["Clear proof", "Reviews, photos, projects, licensing, and years of experience should support authority claims."],
  ["Clear pricing or cost guidance", "Cost ranges, factors, and quote process content help answer commercial-intent questions."],
  ["Clear process", "The site should explain inspection, scheduling, repair, replacement, financing, and follow-up steps."],
  ["Clear FAQs", "FAQ content should answer objections and long-tail questions in plain language."],
  ["Structured data", "Schema should identify the business, services, breadcrumbs, FAQs, and relevant reviews."],
  ["Author or company credibility", "About content should show who stands behind the advice and service."],
  ["Updated content", "Fresh project examples, seasonal guidance, and current service details reduce ambiguity."]
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
    notes: normalizeText(data.get("notes")),
    competitors
  };
}

function inferInputSignals(input) {
  const notes = input.notes.toLowerCase();
  const keywordWords = input.keyword.split(/\s+/).filter(Boolean).length;
  const hasGeoKeyword = input.keyword.toLowerCase().includes(input.city.toLowerCase());
  const hasEmergencyIntent = /emergency|urgent|same day|24/.test(input.keyword.toLowerCase());
  const hasTrustHints = /review|license|certif|project|photo|testimonial|insured|warranty/.test(notes);
  const hasContentHints = /blog|guide|faq|city|service area|neighborhood|case study|project/.test(notes);
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
            : item.label === "Before and after projects"
              ? `${city} ${keyword} project examples`
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
    "Before and after projects": `Project pages provide local proof, visual trust, and internal links back to ${keyword} and ${city} pages.`,
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
  if (name.includes("Project")) return `Publish local ${keyword} project examples with photos, scope, location context, and links.`;
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
      from: "Project pages",
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
  if (name.includes("proof")) return "Attach proof to claims: reviews, projects, photos, credentials, and warranties.";
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
      why: "Project examples connect local proof, trust signals, entity clarity, and internal links.",
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

function analyzeLocalSeo(input) {
  const signals = inferInputSignals(input);
  const scores = scoreUser(input, signals);
  const competitors = analyzeCompetitors(input, scores, signals);
  const topics = buildTopicGaps(input, scores);
  const entities = buildEntitySignals(input, scores, signals);
  const links = buildInternalLinks(input);
  const ai = buildAiReadiness(input, scores);
  const roadmapGroups = buildRoadmap(input, scores, topics, links);

  return {
    generatedAt: new Date().toISOString(),
    modelStatus: "Estimated / placeholder until live crawl, GBP, SERP, GSC, and citation APIs are connected.",
    input,
    scores,
    competitors,
    topics,
    entities,
    links,
    ai,
    roadmap: roadmapGroups,
    futureIntegrations: [
      "Google Search Console API",
      "Google Business Profile API",
      "SERP API",
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
  reportTitle.textContent = `${input.businessName || domainFromUrl(input.websiteUrl)} local SEO authority gap`;
  reportSubtitle.textContent = `Here is where competitors may have stronger local authority for "${input.keyword}" in ${input.city}, ${input.state}, and the highest-leverage build plan to close the gap.`;
  totalScore.textContent = scores.totalOpportunity;
  renderScorecards(scores);
  renderComparison(report.competitors);
  renderTopics(report.topics);
  renderEntities(report.entities);
  renderLinks(report.links);
  renderAiReadiness(report.ai);
  renderRoadmap(report.roadmap);
  setExportsEnabled(true);
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
    `Local SEO Authority Gap Report`,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `Status: ${report.modelStatus}`,
    ``,
    `Business: ${report.input.businessName}`,
    `Website: ${report.input.websiteUrl}`,
    `Market: ${report.input.city}, ${report.input.state}`,
    `Keyword: ${report.input.keyword}`,
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
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = readInput();
  const report = analyzeLocalSeo(input);
  renderReport(report);
});

demoButton.addEventListener("click", () => {
  const demo = {
    websiteUrl: "https://atlanta-hometownroofing.example",
    businessName: "Hometown Roofing Atlanta",
    city: "Atlanta",
    state: "GA",
    keyword: "roof repair",
    mapsUrl: "https://maps.google.com/?cid=123456789",
    competitor1: "https://atlantaroofrepairpros.example",
    competitor2: "https://stormroofatlanta.example",
    competitor3: "https://georgiaroofexperts.example",
    notes:
      "GBP exists, but service pages are thin. Good reviews and licenses. Need neighborhood pages, project examples, cost guide, and stronger internal links."
  };
  Object.entries(demo).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
  form.requestSubmit();
});

exportButtons.copy.addEventListener("click", async () => {
  if (!currentReport) return;
  await navigator.clipboard.writeText(reportToText(currentReport));
  showToast("Report copied to clipboard.");
});

exportButtons.json.addEventListener("click", () => {
  if (!currentReport) return;
  downloadFile("local-seo-authority-report.json", JSON.stringify(currentReport, null, 2), "application/json");
});

exportButtons.csv.addEventListener("click", () => {
  if (!currentReport) return;
  downloadFile("local-seo-authority-report.csv", reportToCsv(currentReport), "text/csv");
});

exportButtons.print.addEventListener("click", () => {
  if (!currentReport) return;
  window.print();
});

// API integration seam: replace analyzeLocalSeo with a pipeline that enriches the same report shape from
// GSC, GBP, SERP, PageSpeed, crawler, Places, review, citation, and link intelligence providers.
