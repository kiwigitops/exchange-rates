import { useCallback, useEffect, useMemo, useState } from "react";
import { readSetting, writeSetting } from "../lib/storage";
import { fetchLatest } from "../services/rates";
import type { LatestRates } from "../types";

type CachedLatest = {
  data: LatestRates;
  receivedAt: number;
};

const CACHE_PREFIX = "stocksfx:latest:";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 20 * 60 * 1000;

function cacheKey(base: string) {
  return `${CACHE_PREFIX}${base}`;
}

function isLatestRates(value: unknown): value is LatestRates {
  if (!value || typeof value !== "object") return false;

  const candidate = value as LatestRates;
  return (
    typeof candidate.base === "string" &&
    typeof candidate.provider === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.nextUpdateAt === "string" &&
    Boolean(candidate.rates) &&
    typeof candidate.rates === "object" &&
    Object.values(candidate.rates).every((rate) => typeof rate === "number" && Number.isFinite(rate))
  );
}

function readCachedLatest(base: string) {
  const cached = readSetting<CachedLatest | null>(cacheKey(base), null);
  if (!cached || typeof cached.receivedAt !== "number" || !Number.isFinite(cached.receivedAt)) return null;
  return isLatestRates(cached.data) ? cached : null;
}

function writeCachedLatest(base: string, data: LatestRates) {
  writeSetting<CachedLatest>(cacheKey(base), { data, receivedAt: Date.now() });
}

export function useLiveRates(base: string) {
  const [snapshot, setSnapshot] = useState<CachedLatest | null>(() => readCachedLatest(base));
  const [loading, setLoading] = useState(() => !readCachedLatest(base));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const cached = readCachedLatest(base);
    setSnapshot(cached);
    setLoading(!cached);
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedLatest(base);

    setLoading(!cached);
    setRefreshing(Boolean(cached));
    setError("");

    fetchLatest(base, controller.signal)
      .then((data) => {
        writeCachedLatest(base, data);
        setSnapshot({ data, receivedAt: Date.now() });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const fallback = readCachedLatest(base);
        if (fallback) setSnapshot(fallback);
        setError(caught instanceof Error ? caught.message : "The market feed is unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [base, refreshKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);

    const handleVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [refresh]);

  const stale = useMemo(() => {
    if (!snapshot) return false;
    return Date.now() - snapshot.receivedAt > STALE_AFTER_MS || Boolean(error);
  }, [error, snapshot]);

  return {
    error,
    latest: snapshot?.data ?? null,
    loading,
    receivedAt: snapshot?.receivedAt,
    refresh,
    refreshing,
    stale,
  };
}
