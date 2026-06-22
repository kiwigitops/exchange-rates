export const DEFAULT_HOME_CURRENCY = "USD";

export const POPULAR_CURRENCIES = [
  "USD",
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
];

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

export function getCurrencyName(code: string) {
  try {
    return currencyNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getCurrencyBadge(code: string) {
  if (POPULAR_CURRENCIES.includes(code)) {
    return "Major pair";
  }

  if (["XAU", "XAG", "XDR"].includes(code)) {
    return "Reserve asset";
  }

  if (["AED", "BHD", "KWD", "OMR", "QAR", "SAR"].includes(code)) {
    return "Gulf market";
  }

  if (["ARS", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"].includes(code)) {
    return "Americas";
  }

  if (["CNY", "HKD", "IDR", "INR", "KRW", "MYR", "PHP", "SGD", "THB", "TWD", "VND"].includes(code)) {
    return "Asia-Pacific";
  }

  if (["BGN", "CZK", "HUF", "ISK", "PLN", "RON", "RSD", "TRY"].includes(code)) {
    return "Europe";
  }

  return "Global";
}

export function formatMoney(amount: number, currency: string) {
  const maximumFractionDigits = Math.abs(amount) >= 1000 ? 0 : 2;

  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits,
      style: "currency",
    }).format(amount);
  } catch {
    return `${formatNumber(amount)} ${currency}`;
  }
}

export function formatNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: Math.abs(value) < 10 && value !== 0 ? 2 : 0,
  }).format(value);
}

export function formatRate(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Math.abs(value) >= 100) {
    return formatNumber(value, 2);
  }

  if (Math.abs(value) >= 1) {
    return formatNumber(value, 4);
  }

  return new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 5,
  }).format(value);
}

export function sortCurrencyCodes(codes: string[], favorites: string[], homeCurrency: string) {
  const popularRank = new Map(POPULAR_CURRENCIES.map((code, index) => [code, index]));
  const favoriteRank = new Map(favorites.map((code, index) => [code, index]));

  return [...codes].sort((a, b) => {
    const aFavorite = favoriteRank.has(a);
    const bFavorite = favoriteRank.has(b);

    if (aFavorite !== bFavorite) {
      return aFavorite ? -1 : 1;
    }

    if (aFavorite && bFavorite) {
      return (favoriteRank.get(a) ?? 0) - (favoriteRank.get(b) ?? 0);
    }

    if (a === homeCurrency) {
      return -1;
    }

    if (b === homeCurrency) {
      return 1;
    }

    const aPopular = popularRank.get(a);
    const bPopular = popularRank.get(b);

    if (aPopular !== undefined || bPopular !== undefined) {
      return (aPopular ?? Number.MAX_SAFE_INTEGER) - (bPopular ?? Number.MAX_SAFE_INTEGER);
    }

    return getCurrencyName(a).localeCompare(getCurrencyName(b));
  });
}
