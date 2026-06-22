import type { HistoryPoint, LatestRates } from "../types";

type OpenRateResponse = {
  result?: string;
  provider?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  base_code?: string;
  rates?: Record<string, number>;
  "error-type"?: string;
};

type FrankfurterRow = {
  date?: string;
  rate?: number;
};

export async function fetchLatest(base: string, signal?: AbortSignal): Promise<LatestRates> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Rates request failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpenRateResponse;

  if (payload.result !== "success" || !payload.rates || !payload.base_code) {
    throw new Error(payload["error-type"] ?? "Rates are temporarily unavailable");
  }

  return {
    base: payload.base_code,
    nextUpdateAt: payload.time_next_update_utc ?? "",
    provider: payload.provider ?? "ExchangeRate-API",
    rates: payload.rates,
    updatedAt: payload.time_last_update_utc ?? "",
  };
}

export async function fetchHistory(
  base: string,
  quote: string,
  days = 120,
  signal?: AbortSignal,
): Promise<HistoryPoint[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const params = new URLSearchParams({
    base,
    from: from.toISOString().slice(0, 10),
    quotes: quote,
  });

  const response = await fetch(`https://api.frankfurter.dev/v2/rates?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`History request failed with ${response.status}`);
  }

  const rows = (await response.json()) as FrankfurterRow[];

  if (!Array.isArray(rows)) {
    throw new Error("History data was not a time series");
  }

  return rows
    .filter((row): row is Required<FrankfurterRow> => {
      return typeof row.date === "string" && typeof row.rate === "number" && Number.isFinite(row.rate);
    })
    .map((row) => ({ date: row.date, rate: row.rate }));
}
