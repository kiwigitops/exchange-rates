export type LatestRates = {
  baseCode: string;
  documentation: string;
  lastUpdateUtc: string;
  nextUpdateUtc: string;
  provider: string;
  rates: Record<string, number>;
  termsOfUse: string;
};

export type HistoryPoint = {
  date: string;
  rate: number;
};

type OpenExchangeRateResponse = {
  result?: string;
  provider?: string;
  documentation?: string;
  terms_of_use?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  base_code?: string;
  rates?: Record<string, number>;
  "error-type"?: string;
};

type FrankfurterRow = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

const LATEST_API = "https://open.er-api.com/v6/latest";
const HISTORY_API = "https://api.frankfurter.dev/v2/rates";

export async function getLatestRates(
  baseCurrency: string,
  signal?: AbortSignal,
): Promise<LatestRates> {
  const response = await fetch(`${LATEST_API}/${encodeURIComponent(baseCurrency)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Latest rates request failed with ${response.status}`);
  }

  const data = (await response.json()) as OpenExchangeRateResponse;

  if (data.result !== "success" || !data.rates || !data.base_code) {
    throw new Error(data["error-type"] ?? "Latest rates were not available");
  }

  return {
    baseCode: data.base_code,
    documentation: data.documentation ?? "https://www.exchangerate-api.com/docs/free",
    lastUpdateUtc: data.time_last_update_utc ?? "",
    nextUpdateUtc: data.time_next_update_utc ?? "",
    provider: data.provider ?? "ExchangeRate-API",
    rates: data.rates,
    termsOfUse: data.terms_of_use ?? "https://www.exchangerate-api.com/terms",
  };
}

export async function getRateHistory(
  baseCurrency: string,
  quoteCurrency: string,
  days = 90,
  signal?: AbortSignal,
): Promise<HistoryPoint[]> {
  const from = formatApiDate(daysAgo(days));
  const params = new URLSearchParams({
    base: baseCurrency,
    from,
    quotes: quoteCurrency,
  });

  const response = await fetch(`${HISTORY_API}?${params.toString()}`, { signal });

  if (!response.ok) {
    const fallbackMessage = `History request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      throw new Error(body.message ?? fallbackMessage);
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  const rows = (await response.json()) as FrankfurterRow[];

  if (!Array.isArray(rows)) {
    throw new Error("History response was not a rate series");
  }

  return rows
    .filter(
      (row): row is Required<FrankfurterRow> =>
        typeof row.date === "string" &&
        typeof row.rate === "number" &&
        Number.isFinite(row.rate),
    )
    .map((row) => ({
      date: row.date,
      rate: row.rate,
    }));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatApiDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
