import { isIP } from "node:net";
import * as cheerio from "cheerio";

export type ProductLookupCandidate = {
  title: string;
  description: string;
  imageUrl?: string;
  sourceUrl: string;
  category?: string;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
};

export type ProductLookup = (query: string) => Promise<ProductLookupCandidate[]>;

type FetchLike = typeof fetch;

type SearchResult = {
  title: string;
  description: string;
  sourceUrl: string;
  score: number;
};

const SEARCH_RESULT_LIMIT = 6;
const LOOKUP_RESULT_LIMIT = 4;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_REDIRECTS = 3;

export async function lookupProductMetadata(
  query: string,
  fetcher: FetchLike = fetch,
): Promise<ProductLookupCandidate[]> {
  const normalizedQuery = cleanText(query).slice(0, 120);
  if (normalizedQuery.length < 2) return [];

  const searchResults = await searchProductPages(normalizedQuery, fetcher);
  const enrichedResults = await Promise.all(
    searchResults.slice(0, SEARCH_RESULT_LIMIT).map(async (result) => {
      try {
        return await readProductPage(result, fetcher);
      } catch {
        return {
          title: result.title,
          description: result.description,
          sourceUrl: result.sourceUrl,
        } satisfies ProductLookupCandidate;
      }
    }),
  );

  return deduplicateCandidates(enrichedResults.map(addInferredMetadata)).slice(0, LOOKUP_RESULT_LIMIT);
}

async function searchProductPages(query: string, fetcher: FetchLike) {
  const searchQuery = `${query} 汽车美容 产品 官方`;
  const response = await fetcher(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; CarUtils/1.0; product metadata lookup)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Product search failed with HTTP ${response.status}.`);
  }

  const $ = cheerio.load((await response.text()).slice(0, MAX_HTML_LENGTH));
  const queryTokens = tokenize(query);
  const results: SearchResult[] = [];

  $(".result").each((_index, element) => {
    const result = $(element);
    const link = result.find(".result__a").first();
    const sourceUrl = unwrapSearchResultUrl(link.attr("href"));
    if (!sourceUrl || !isSafePublicUrl(sourceUrl)) return;

    const title = cleanText(link.text());
    const description = cleanText(result.find(".result__snippet").first().text());
    if (!title) return;

    results.push({
      title,
      description,
      sourceUrl,
      score: scoreSearchResult(title, description, new URL(sourceUrl).hostname, queryTokens),
    });
  });

  return results
    .sort((left, right) => right.score - left.score)
    .filter((result, index) => result.score > 0 || index < 2)
    .slice(0, SEARCH_RESULT_LIMIT);
}

async function readProductPage(result: SearchResult, fetcher: FetchLike): Promise<ProductLookupCandidate> {
  const response = await fetchPublicPage(result.sourceUrl, fetcher);

  if (!response.ok) throw new Error(`Product page failed with HTTP ${response.status}.`);

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("Product page is not HTML.");
  }

  const sourceUrl = response.url && isSafePublicUrl(response.url) ? response.url : result.sourceUrl;
  const $ = cheerio.load((await response.text()).slice(0, MAX_HTML_LENGTH));
  const title =
    readMeta($, "property", "og:title") ||
    readMeta($, "name", "twitter:title") ||
    cleanText($("title").first().text()) ||
    result.title;
  const description =
    readMeta($, "property", "og:description") ||
    readMeta($, "name", "description") ||
    readMeta($, "name", "twitter:description") ||
    result.description;
  const rawImageUrl =
    readMeta($, "property", "og:image") ||
    readMeta($, "property", "og:image:secure_url") ||
    readMeta($, "name", "twitter:image") ||
    cleanText($('link[rel="image_src"]').first().attr("href") ?? "") ||
    readJsonLdImage($);
  const imageUrl = resolvePublicUrl(rawImageUrl, sourceUrl);

  return {
    title: cleanText(title).slice(0, 180),
    description: cleanText(description).slice(0, 420),
    ...(imageUrl ? { imageUrl } : {}),
    sourceUrl,
  };
}

async function fetchPublicPage(sourceUrl: string, fetcher: FetchLike) {
  let currentUrl = sourceUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isSafePublicUrl(currentUrl)) throw new Error("Unsafe product page URL.");

    const response = await fetcher(currentUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; CarUtils/1.0; product metadata lookup)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error("Product page redirect is missing a location.");
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Product page redirected too many times.");
}

function readMeta($: cheerio.CheerioAPI, attribute: "name" | "property", value: string) {
  return cleanText($(`meta[${attribute}="${value}"]`).first().attr("content") ?? "");
}

function readJsonLdImage($: cheerio.CheerioAPI) {
  let imageUrl = "";

  $('script[type="application/ld+json"]').each((_index, element) => {
    if (imageUrl) return;

    try {
      const value = JSON.parse($(element).text()) as unknown;
      imageUrl = findJsonLdImage(value) ?? "";
    } catch {
      // Some sites publish invalid JSON-LD; other metadata can still be used.
    }
  });

  return imageUrl;
}

function findJsonLdImage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.map(findJsonLdImage).find(Boolean);
  }
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const image = record.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const stringImage = image.find((item): item is string => typeof item === "string");
    if (stringImage) return stringImage;
  }
  if (image && typeof image === "object") {
    const imageRecord = image as Record<string, unknown>;
    if (typeof imageRecord.url === "string") return imageRecord.url;
    if (typeof imageRecord.contentUrl === "string") return imageRecord.contentUrl;
  }

  return findJsonLdImage(record["@graph"]);
}

function unwrapSearchResultUrl(href?: string) {
  if (!href) return undefined;

  try {
    const url = new URL(href, "https://duckduckgo.com");
    return url.searchParams.get("uddg") ?? url.toString();
  } catch {
    return undefined;
  }
}

function resolvePublicUrl(value: string, baseUrl: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value, baseUrl);
    if (new URL(baseUrl).protocol === "https:" && url.protocol === "http:") url.protocol = "https:";
    return isSafePublicUrl(url.toString()) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local")) return false;
    if (isPrivateIpAddress(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isPrivateIpAddress(hostname: string) {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const octets = hostname.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 0
    );
  }
  if (ipVersion === 6) {
    return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
  }
  return false;
}

function scoreSearchResult(title: string, description: string, hostname: string, queryTokens: string[]) {
  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedDescription = description.toLocaleLowerCase();
  const normalizedHostname = hostname.toLocaleLowerCase();
  const marketplacePenalty = /(taobao|tmall|jd\.com|amazon|ebay|shopee|alibaba|aliexpress|walmart)/.test(
    normalizedHostname,
  )
    ? 4
    : 0;

  return (
    queryTokens.reduce(
      (score, token) =>
        score +
        (normalizedHostname.includes(token) ? 4 : 0) +
        (normalizedTitle.includes(token) ? 2 : 0) +
        (normalizedDescription.includes(token) ? 1 : 0),
      0,
    ) - marketplacePenalty
  );
}

function tokenize(value: string) {
  return [...new Set(value.toLocaleLowerCase().split(/[\s/|,，·()（）_-]+/).filter((token) => token.length >= 2))];
}

function deduplicateCandidates(candidates: ProductLookupCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.sourceUrl.replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addInferredMetadata(candidate: ProductLookupCandidate): ProductLookupCandidate {
  const searchableText = `${candidate.title} ${candidate.description}`;
  const capacity = inferCapacity(searchableText);
  const category = inferCategory(searchableText);

  return {
    ...candidate,
    ...(category ? { category } : {}),
    ...(capacity ?? {}),
  };
}

function inferCapacity(value: string) {
  const match = value.match(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*(ml|milliliters?|l|liters?|litres?|g|grams?|kg|kilograms?|pcs)\b/i);
  if (!match) return undefined;

  const capacity = Number(match[1]);
  if (!Number.isFinite(capacity) || capacity <= 0) return undefined;

  const rawUnit = match[2].toLocaleLowerCase();
  const capacityUnit =
    rawUnit === "l" || rawUnit.startsWith("liter") || rawUnit.startsWith("litre")
      ? "L"
      : rawUnit === "kg" || rawUnit.startsWith("kilogram")
        ? "kg"
        : rawUnit === "g" || rawUnit.startsWith("gram")
          ? "g"
          : rawUnit === "pcs"
            ? "pcs"
            : "ml";

  return { capacity, capacityUnit } satisfies Pick<ProductLookupCandidate, "capacity" | "capacityUnit">;
}

function inferCategory(value: string) {
  const normalized = value.toLocaleLowerCase();
  if (/(去油膜|油膜|glass polish|glass polishing|cerium oxide|氧化铈)/.test(normalized)) return "玻璃去油膜";
  if (/(玻璃|\bglass\b|window cleaner|windshield)/.test(normalized)) return "玻璃清洁";
  if (/(虫胶|虫尸|bug cleaner|insect remover)/.test(normalized)) return "虫胶清洁";
  if (/(轮毂|wheel cleaner|iron remover|铁粉)/.test(normalized)) return "轮毂清洁";
  if (/(轮胎|tire dressing|tyre dressing)/.test(normalized)) return "轮胎养护";
  if (/(内饰|interior cleaner|leather cleaner|upholstery)/.test(normalized)) return "内饰清洁";
  if (/(预洗|prewash|pre-wash|snow foam)/.test(normalized)) return "预洗液";
  if (/(正洗|car shampoo|wash shampoo)/.test(normalized)) return "正洗液";
  if (/(wax|sealant|coating|封体|车蜡)/.test(normalized)) return "蜡/封体";
  if (/(apc|all purpose cleaner|多用途清洁)/.test(normalized)) return "多用途清洁";
  return undefined;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
