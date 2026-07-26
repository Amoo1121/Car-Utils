export type WashProductLookupCandidate = {
  title: string;
  description: string;
  imageUrl?: string;
  sourceUrl: string;
  category?: string;
  capacity?: number;
  capacityUnit?: "ml" | "L" | "g" | "kg" | "pcs";
};

type FetchLike = typeof fetch;

export async function lookupWashProductMetadata(
  query: string,
  fetcher: FetchLike = fetch,
  baseUrl = getDefaultApiBaseUrl(),
) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const response = await fetcher(
    `${normalizedBaseUrl}/api/product-lookup?query=${encodeURIComponent(normalizedQuery)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "联网查找产品资料失败，请稍后重试。";
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object" || !("candidates" in payload) || !Array.isArray(payload.candidates)) {
    return [];
  }

  return payload.candidates.filter(isLookupCandidate);
}

function isLookupCandidate(value: unknown): value is WashProductLookupCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WashProductLookupCandidate>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.sourceUrl === "string" &&
    (candidate.imageUrl == null || typeof candidate.imageUrl === "string") &&
    (candidate.category == null || typeof candidate.category === "string") &&
    (candidate.capacity == null || typeof candidate.capacity === "number") &&
    (candidate.capacityUnit == null || ["ml", "L", "g", "kg", "pcs"].includes(candidate.capacityUnit))
  );
}

function getDefaultApiBaseUrl() {
  return import.meta.env.VITE_CAR_UTILS_API_BASE_URL ?? "";
}
