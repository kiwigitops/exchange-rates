import { WATCHLIST } from "./constants";

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

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

export function formatDateTime(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ? String(value) : "Pending";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPercent(value: number, showSign = false) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: showSign ? "always" : "auto",
    style: "percent",
  }).format(value);
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
