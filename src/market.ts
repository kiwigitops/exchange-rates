export type LatestRates = {
  base: string;
  provider: string;
  updatedAt: string;
  nextUpdateAt: string;
  rates: Record<string, number>;
};

export type HistoryPoint = {
  date: string;
  rate: number;
};

export type Direction = "direct" | "reverse";

export const DEFAULT_BASE = "USD";
export const DEFAULT_AMOUNT = 100;

export const WATCHLIST = [
  "EUR",
  "JPY",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "CNY",
  "HKD",
  "SGD",
  "NZD",
  "MXN",
  "BRL",
  "INR",
  "KRW",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "ZAR",
  "TRY",
  "THB",
  "AED",
  "ILS",
  "IDR",
];

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

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

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

export function nameOf(code: string) {
  try {
    return currencyNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function marketRegion(code: string) {
  if (["USD", "CAD", "MXN", "BRL", "CLP", "COP", "ARS", "PEN"].includes(code)) return "Americas";
  if (["EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY"].includes(code)) return "Europe";
  if (["JPY", "CNY", "HKD", "SGD", "AUD", "NZD", "INR", "KRW", "THB", "IDR", "MYR"].includes(code)) return "Asia Pacific";
  if (["AED", "SAR", "QAR", "BHD", "KWD", "ILS", "ZAR"].includes(code)) return "MEA";
  return "Global";
}

export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
      style: "currency",
    }).format(value);
  } catch {
    return `${formatCompact(value)} ${currency}`;
  }
}

export function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100) return formatCompact(value, 2);
  if (Math.abs(value) >= 1) return formatCompact(value, 4);

  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 5 }).format(value);
}

export function formatCompact(value: number, digits = 2) {
  const minimumFractionDigits = Math.min(digits, Math.abs(value) < 10 && value !== 0 ? 2 : 0);

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits,
  }).format(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Pending";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function pseudoMove(code: string, rate: number) {
  const seed = code.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const wave = Math.sin(seed * 0.61 + rate * 0.017) * 1.9;
  return Math.round(wave * 100) / 100;
}

export function sortCodes(codes: string[], favorites: string[], base: string) {
  const favoriteRank = new Map(favorites.map((code, index) => [code, index]));
  const watchRank = new Map(WATCHLIST.map((code, index) => [code, index]));

  return [...codes].sort((left, right) => {
    const leftFavorite = favoriteRank.has(left);
    const rightFavorite = favoriteRank.has(right);

    if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1;
    if (leftFavorite && rightFavorite) return (favoriteRank.get(left) ?? 0) - (favoriteRank.get(right) ?? 0);
    if (left === base) return -1;
    if (right === base) return 1;

    const leftWatch = watchRank.get(left);
    const rightWatch = watchRank.get(right);
    if (leftWatch !== undefined || rightWatch !== undefined) {
      return (leftWatch ?? 999) - (rightWatch ?? 999);
    }

    return nameOf(left).localeCompare(nameOf(right));
  });
}

export function readSetting<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSetting<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
