import { useCallback, useEffect, useState } from "react";

export type Page = "home" | "timeline" | "insights" | "garage" | "settings";

export type Route = {
  page: Page;
  sub?: string;
  params: URLSearchParams;
};

const pages: Page[] = ["home", "timeline", "insights", "garage", "settings"];

export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [first, sub] = path.split("/").filter(Boolean);
  const page = pages.includes(first as Page) ? (first as Page) : "home";
  return { page, sub, params: new URLSearchParams(query) };
}

export function buildHash(page: Page, sub?: string, params?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return `#/${page}${sub ? `/${sub}` : ""}${query ? `?${query}` : ""}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((page: Page, sub?: string, params?: Record<string, string | undefined>) => {
    const next = buildHash(page, sub, params);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
    window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}
