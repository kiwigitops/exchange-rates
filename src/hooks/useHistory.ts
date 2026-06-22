import { useEffect, useMemo, useState } from "react";
import { fetchHistory } from "../services/rates";
import type { Direction, HistoryPoint, RatePoint } from "../types";

const historyCache = new Map<string, HistoryPoint[]>();

export function useHistory(base: string, quote: string, direction: Direction, days = 120) {
  const cacheId = `${base}:${quote}:${days}`;
  const [history, setHistory] = useState<HistoryPoint[]>(() => historyCache.get(cacheId) ?? []);
  const [loading, setLoading] = useState(() => !historyCache.has(cacheId));
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const cached = historyCache.get(cacheId);

    if (cached) {
      setHistory(cached);
      setLoading(false);
      setError("");
      return () => controller.abort();
    }

    setLoading(true);
    setError("");
    setHistory([]);

    fetchHistory(base, quote, days, controller.signal)
      .then((points) => {
        historyCache.set(cacheId, points);
        setHistory(points);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "History unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [base, cacheId, days, quote]);

  const series = useMemo<RatePoint[]>(() => {
    return history
      .map((point) => ({
        date: point.date,
        rate: direction === "direct" ? point.rate : 1 / point.rate,
      }))
      .filter((point) => Number.isFinite(point.rate));
  }, [direction, history]);

  return { error, loading, series };
}
