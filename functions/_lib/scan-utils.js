const EARTH_KM_PER_DEGREE_LAT = 111.32;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.href.replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function domainFromUrl(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return normalizeText(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export function normalizeScanInput(body = {}) {
  const gridSize = normalizeGridSize(body.gridSize);
  const centerLat = toNumber(body.centerLat);
  const centerLon = toNumber(body.centerLon);
  const spacingKm = clamp(toNumber(body.pointSpacingKm) || 2, 0.5, 8);

  return {
    scanMode: body.scanMode === "live" ? "live" : "estimate",
    businessName: normalizeText(body.businessName),
    websiteUrl: normalizeUrl(body.websiteUrl),
    mapsUrl: normalizeUrl(body.mapsUrl),
    keyword: normalizeText(body.keyword),
    city: normalizeText(body.city),
    state: normalizeText(body.state),
    gridSize,
    centerLat,
    centerLon,
    pointSpacingKm: spacingKm
  };
}

export function normalizeGridSize(value) {
  const parsed = Number.parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : 9;
  const bounded = clamp(safe, 3, 11);
  return bounded % 2 === 0 ? bounded - 1 : bounded;
}

export function hasValidCoordinates(input) {
  return Number.isFinite(input.centerLat) && Number.isFinite(input.centerLon);
}

export function generateGridPoints({ centerLat, centerLon, gridSize = 9, pointSpacingKm = 2 }) {
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) {
    throw new Error("Center latitude and longitude are required for live rank checks.");
  }

  const size = normalizeGridSize(gridSize);
  const center = Math.floor(size / 2);
  const lonKm = Math.max(20, EARTH_KM_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180));
  const points = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const northKm = (center - y) * pointSpacingKm;
      const eastKm = (x - center) * pointSpacingKm;
      points.push({
        x,
        y,
        lat: roundCoord(centerLat + northKm / EARTH_KM_PER_DEGREE_LAT),
        lon: roundCoord(centerLon + eastKm / lonKm)
      });
    }
  }

  return points;
}

export function summarizeRankPoints(points, gridSize, pointSpacingKm = 2) {
  const ranks = points.map((point) => point.rank).filter((rank) => Number.isFinite(rank));
  const wins = ranks.filter((rank) => rank <= 3).length;
  const nearWins = ranks.filter((rank) => rank > 3 && rank <= 7).length;
  const weak = points.filter((point) => !Number.isFinite(point.rank) || point.rank >= 11).length;
  const averageRank = ranks.length
    ? Math.round((ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) * 10) / 10
    : null;
  const radiusMiles = Math.max(1, Math.round(((gridSize - 1) * pointSpacingKm * 0.621371) / 2));

  return {
    averageRank,
    coverage: Math.round((wins / points.length) * 100),
    contested: Math.round(((nearWins + weak) / points.length) * 100),
    weak,
    wins,
    rankPoints: points.length,
    radius: `${radiusMiles} mi`,
    coverageArea: `${Math.round(Math.PI * radiusMiles * radiusMiles)} sq mi`
  };
}

export function rankTone(rank) {
  if (!Number.isFinite(rank)) return "critical";
  if (rank <= 3) return "win";
  if (rank <= 6) return "near";
  if (rank <= 10) return "watch";
  if (rank <= 14) return "losing";
  return "critical";
}

export function normalizeScrappaItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function matchBusiness(items, input) {
  const targetName = normalizeComparable(input.businessName);
  const targetDomain = domainFromUrl(input.websiteUrl).toLowerCase();
  const mapsId = extractMapsIdentifier(input.mapsUrl);
  let best = null;

  items.forEach((item, index) => {
    const itemName = normalizeComparable(item.name || item.title || item.business_name);
    const itemDomain = domainFromUrl(item.website || item.url || item.site).toLowerCase();
    const itemId = normalizeText(item.business_id || item.place_id || item.cid || item.data_id);
    const score =
      (mapsId && itemId && mapsId.includes(itemId) ? 16 : 0) +
      (targetDomain && itemDomain && targetDomain === itemDomain ? 12 : 0) +
      (targetDomain && itemDomain && (targetDomain.includes(itemDomain) || itemDomain.includes(targetDomain)) ? 8 : 0) +
      nameScore(targetName, itemName);

    if (!best || score > best.score) {
      best = {
        item,
        score,
        rank: index + 1
      };
    }
  });

  return best && best.score >= 8 ? best : null;
}

export function buildTerritoryFromRankPoints({ input, points, provider = "scrappa", generatedAt = new Date().toISOString() }) {
  const size = normalizeGridSize(input.gridSize);
  const summary = summarizeRankPoints(points, size, input.pointSpacingKm);
  return {
    size,
    cells: points.map((point) => ({
      x: point.x,
      y: point.y,
      lat: point.lat,
      lon: point.lon,
      rank: Number.isFinite(point.rank) ? point.rank : null,
      displayRank: Number.isFinite(point.rank) ? String(point.rank) : "20+",
      matchedName: point.matchedName || "",
      center: point.x === Math.floor(size / 2) && point.y === Math.floor(size / 2),
      tone: rankTone(point.rank)
    })),
    ...summary,
    pointSpacing: `${input.pointSpacingKm} km`,
    market: `${input.city || "Target city"}, ${input.state || "State"}`,
    gridSize: `${size} x ${size}`,
    dataStatus: provider === "scrappa" ? "Live Scrappa Maps data." : "Estimated fallback grid.",
    provider,
    generatedAt
  };
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

function nameScore(targetName, itemName) {
  if (!targetName || !itemName) return 0;
  if (targetName === itemName) return 12;
  if (targetName.includes(itemName) || itemName.includes(targetName)) return 8;
  const targetWords = new Set(targetName.split(" ").filter((word) => word.length > 2));
  const itemWords = itemName.split(" ").filter((word) => word.length > 2);
  const matches = itemWords.filter((word) => targetWords.has(word)).length;
  return matches >= 2 ? 5 : matches;
}

function extractMapsIdentifier(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const cidMatch = text.match(/[?&]cid=([^&]+)/i);
  if (cidMatch) return decodeURIComponent(cidMatch[1]);
  const placeMatch = text.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
  return placeMatch ? placeMatch[0] : text;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCoord(value) {
  return Math.round(value * 1000000) / 1000000;
}
