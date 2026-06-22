import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  LoaderCircle,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { getLatestRates, getRateHistory, type HistoryPoint, type LatestRates } from "./api";
import {
  DEFAULT_HOME_CURRENCY,
  POPULAR_CURRENCIES,
  formatMoney,
  formatNumber,
  formatRate,
  getCurrencyBadge,
  getCurrencyName,
  sortCurrencyCodes,
} from "./currency";
import { readStorage, writeStorage } from "./storage";

type Mode = "direct" | "reverse";

type RateCard = {
  code: string;
  name: string;
  rate: number;
};

type DisplayPoint = {
  date: string;
  rate: number;
};

const HOME_KEY = "exchange-rates:home-currency";
const AMOUNT_KEY = "exchange-rates:amount";
const MODE_KEY = "exchange-rates:mode";
const FAVORITES_KEY = "exchange-rates:favorites";

export default function App() {
  const [homeCurrency, setHomeCurrency] = useState(() =>
    readStorage(HOME_KEY, DEFAULT_HOME_CURRENCY),
  );
  const [amount, setAmount] = useState(() => readStorage(AMOUNT_KEY, 100));
  const [mode, setMode] = useState<Mode>(() => {
    const storedMode = readStorage<Mode>(MODE_KEY, "direct");
    return storedMode === "reverse" ? "reverse" : "direct";
  });
  const [favorites, setFavorites] = useState<string[]>(() => readStorage(FAVORITES_KEY, ["EUR", "JPY", "GBP"]));
  const [latest, setLatest] = useState<LatestRates | null>(null);
  const [query, setQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => writeStorage(HOME_KEY, homeCurrency), [homeCurrency]);
  useEffect(() => writeStorage(AMOUNT_KEY, amount), [amount]);
  useEffect(() => writeStorage(MODE_KEY, mode), [mode]);
  useEffect(() => writeStorage(FAVORITES_KEY, favorites), [favorites]);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError("");

    getLatestRates(homeCurrency, controller.signal)
      .then((data) => setLatest(data))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : "Rates could not be loaded");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [homeCurrency, refreshToken]);

  const selectableCurrencies = useMemo(() => {
    const codes = latest ? Object.keys(latest.rates) : POPULAR_CURRENCIES;
    return sortCurrencyCodes(codes, [], homeCurrency);
  }, [homeCurrency, latest]);

  const cards = useMemo(() => {
    if (!latest) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const codes = Object.entries(latest.rates)
      .filter(([code, rate]) => code !== homeCurrency && Number.isFinite(rate) && rate > 0)
      .map(([code]) => code);

    return sortCurrencyCodes(codes, favorites, homeCurrency)
      .map((code) => ({
        code,
        name: getCurrencyName(code),
        rate: latest.rates[code],
      }))
      .filter((card) => {
        if (showFavoritesOnly && !favorites.includes(card.code)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          card.code.toLowerCase().includes(normalizedQuery) ||
          card.name.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [favorites, homeCurrency, latest, query, showFavoritesOnly]);

  const selectedRate = selectedCode && latest ? latest.rates[selectedCode] : undefined;
  const favoriteCount = favorites.filter((code) => latest?.rates[code]).length;
  const updatedAt = latest?.lastUpdateUtc ? formatDateTime(latest.lastUpdateUtc) : "Pending";

  function toggleFavorite(code: string) {
    setFavorites((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [code, ...current],
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Currency dashboard</p>
            <h1>Exchange Rates</h1>
          </div>
          <button
            className="icon-button"
            onClick={() => setRefreshToken((value) => value + 1)}
            title="Refresh rates"
            aria-label="Refresh rates"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        <section className="control-panel" aria-label="Currency controls">
          <label className="field">
            <span>Home</span>
            <select value={homeCurrency} onChange={(event) => setHomeCurrency(event.target.value)}>
              {selectableCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code} - {getCurrencyName(code)}
                </option>
              ))}
            </select>
          </label>

          <label className="field amount-field">
            <span>Amount</span>
            <input
              min="0"
              inputMode="decimal"
              type="number"
              value={amount}
              onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>

          <div className="mode-toggle" aria-label="Rate direction">
            <button
              className={mode === "direct" ? "is-active" : ""}
              onClick={() => setMode("direct")}
              type="button"
            >
              <ArrowLeftRight size={16} />
              Direct
            </button>
            <button
              className={mode === "reverse" ? "is-active" : ""}
              onClick={() => setMode("reverse")}
              type="button"
            >
              <ArrowLeftRight size={16} />
              Reverse
            </button>
          </div>

          <label className="field search-field">
            <span>Search</span>
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Code or name"
                type="search"
              />
            </div>
          </label>

          <button
            className={showFavoritesOnly ? "filter-button is-active" : "filter-button"}
            onClick={() => setShowFavoritesOnly((value) => !value)}
            type="button"
          >
            <Star size={16} />
            Favorites
          </button>
        </section>

        <section className="summary-strip" aria-label="Rate summary">
          <SummaryItem label="Base" value={homeCurrency} />
          <SummaryItem label="Currencies" value={latest ? String(Object.keys(latest.rates).length - 1) : "0"} />
          <SummaryItem label="Pinned" value={String(favoriteCount)} />
          <SummaryItem label="Updated" value={updatedAt} />
        </section>

        {error ? (
          <div className="state-panel" role="alert">
            <strong>Rates unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="loading-panel">
            <LoaderCircle className="spin" size={24} />
            <span>Loading rates</span>
          </div>
        ) : (
          <section className="card-grid" aria-label="Exchange rate cards">
            {cards.map((card) => (
              <CurrencyCard
                amount={amount}
                card={card}
                homeCurrency={homeCurrency}
                isFavorite={favorites.includes(card.code)}
                key={card.code}
                mode={mode}
                onOpen={() => setSelectedCode(card.code)}
                onToggleFavorite={() => toggleFavorite(card.code)}
              />
            ))}
          </section>
        )}

        {!isLoading && cards.length === 0 ? (
          <div className="state-panel">
            <strong>No matches</strong>
            <span>Try another search or clear the favorites filter.</span>
          </div>
        ) : null}
      </section>

      {selectedCode && selectedRate ? (
        <CurrencyDetailModal
          amount={amount}
          code={selectedCode}
          homeCurrency={homeCurrency}
          mode={mode}
          onClose={() => setSelectedCode(null)}
          rate={selectedRate}
        />
      ) : null}
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CurrencyCard({
  amount,
  card,
  homeCurrency,
  isFavorite,
  mode,
  onOpen,
  onToggleFavorite,
}: {
  amount: number;
  card: RateCard;
  homeCurrency: string;
  isFavorite: boolean;
  mode: Mode;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const directAmount = amount * card.rate;
  const reverseAmount = amount / card.rate;
  const primaryAmount = mode === "direct" ? directAmount : reverseAmount;
  const primaryCurrency = mode === "direct" ? card.code : homeCurrency;
  const sourceCurrency = mode === "direct" ? homeCurrency : card.code;
  const targetCurrency = mode === "direct" ? card.code : homeCurrency;
  const rate = mode === "direct" ? card.rate : 1 / card.rate;
  const inverseRate = mode === "direct" ? 1 / card.rate : card.rate;

  return (
    <article className={isFavorite ? "rate-card is-favorite" : "rate-card"}>
      <div className="card-head">
        <div>
          <span className="badge">{getCurrencyBadge(card.code)}</span>
          <h2>{card.code}</h2>
        </div>
        <div className="card-actions">
          <button
            className={isFavorite ? "icon-button star-button is-active" : "icon-button star-button"}
            onClick={onToggleFavorite}
            title={isFavorite ? "Remove favorite" : "Add favorite"}
            aria-label={isFavorite ? `Remove ${card.code} favorite` : `Add ${card.code} favorite`}
            aria-pressed={isFavorite}
            type="button"
          >
            <Star size={17} />
          </button>
          <button
            className="icon-button"
            onClick={onOpen}
            title="Open chart"
            aria-label={`Open ${card.code} chart`}
            type="button"
          >
            <BarChart3 size={17} />
          </button>
        </div>
      </div>

      <p className="currency-name">{card.name}</p>

      <div className="conversion-block">
        <span>
          {formatMoney(amount, sourceCurrency)} = {targetCurrency}
        </span>
        <strong>{formatMoney(primaryAmount, primaryCurrency)}</strong>
      </div>

      <dl className="rate-lines">
        <div>
          <dt>Rate</dt>
          <dd>
            1 {sourceCurrency} = {formatRate(rate)} {targetCurrency}
          </dd>
        </div>
        <div>
          <dt>Inverse</dt>
          <dd>
            1 {targetCurrency} = {formatRate(inverseRate)} {sourceCurrency}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function CurrencyDetailModal({
  amount,
  code,
  homeCurrency,
  mode,
  onClose,
  rate,
}: {
  amount: number;
  code: string;
  homeCurrency: string;
  mode: Mode;
  onClose: () => void;
  rate: number;
}) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setIsHistoryLoading(true);
    setHistoryError("");
    setHistory([]);

    getRateHistory(homeCurrency, code, 90, controller.signal)
      .then(setHistory)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }

        setHistoryError(requestError instanceof Error ? requestError.message : "History could not be loaded");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsHistoryLoading(false);
        }
      });

    return () => controller.abort();
  }, [code, homeCurrency]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sourceCurrency = mode === "direct" ? homeCurrency : code;
  const targetCurrency = mode === "direct" ? code : homeCurrency;
  const liveRate = mode === "direct" ? rate : 1 / rate;
  const liveInverseRate = mode === "direct" ? 1 / rate : rate;
  const convertedAmount = mode === "direct" ? amount * rate : amount / rate;
  const convertedCurrency = mode === "direct" ? code : homeCurrency;
  const displaySeries = useMemo(
    () =>
      history
        .map((point) => ({
          date: point.date,
          rate: mode === "direct" ? point.rate : 1 / point.rate,
        }))
        .filter((point) => Number.isFinite(point.rate)),
    [history, mode],
  );
  const stats = getStats(displaySeries, liveRate);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        aria-labelledby="detail-title"
        aria-modal="true"
        className="detail-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="detail-header">
          <div>
            <span className="badge">{getCurrencyBadge(code)}</span>
            <h2 id="detail-title">
              {code} <span>{getCurrencyName(code)}</span>
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close" aria-label="Close" type="button">
            <X size={18} />
          </button>
        </header>

        <div className="detail-hero">
          <div>
            <span>
              {formatMoney(amount, sourceCurrency)} = {targetCurrency}
            </span>
            <strong>{formatMoney(convertedAmount, convertedCurrency)}</strong>
          </div>
          <dl>
            <div>
              <dt>Live rate</dt>
              <dd>
                1 {sourceCurrency} = {formatRate(liveRate)} {targetCurrency}
              </dd>
            </div>
            <div>
              <dt>Inverse</dt>
              <dd>
                1 {targetCurrency} = {formatRate(liveInverseRate)} {sourceCurrency}
              </dd>
            </div>
          </dl>
        </div>

        <section className="stats-grid" aria-label="Rate statistics">
          <StatCard label="Current" value={formatRate(stats.current)} />
          <StatCard
            className={stats.change >= 0 ? "positive" : "negative"}
            label="90 day"
            value={`${stats.change >= 0 ? "+" : ""}${formatRate(stats.change)} (${formatPercent(stats.changePercent)})`}
          />
          <StatCard label="High" value={formatRate(stats.high)} />
          <StatCard label="Low" value={formatRate(stats.low)} />
          <StatCard label="Average" value={formatRate(stats.average)} />
          <StatCard label="Range" value={formatRate(stats.range)} />
        </section>

        <section className="chart-panel" aria-label="Rate history chart">
          <div className="chart-head">
            <div>
              <h3>90 day rate</h3>
              <span>
                {sourceCurrency} to {targetCurrency}
              </span>
            </div>
            {isHistoryLoading ? (
              <span className="inline-loading">
                <LoaderCircle className="spin" size={16} />
                Loading
              </span>
            ) : null}
          </div>

          {historyError ? (
            <div className="state-panel compact">
              <strong>History unavailable</strong>
              <span>{historyError}</span>
            </div>
          ) : (
            <RateChart points={displaySeries} />
          )}
        </section>
      </section>
    </div>
  );
}

function StatCard({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`stat-card ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RateChart({ points }: { points: DisplayPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="chart-empty">
        <BarChart3 size={26} />
        <span>No history series available</span>
      </div>
    );
  }

  const width = 720;
  const height = 260;
  const paddingX = 18;
  const paddingY = 24;
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const x = paddingX + (index / (points.length - 1)) * innerWidth;
    const y = paddingY + (1 - (point.rate - min) / range) * innerHeight;
    return { ...point, x, y };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [
    `M ${coordinates[0].x} ${height - paddingY}`,
    ...coordinates.map((point) => `L ${point.x} ${point.y}`),
    `L ${coordinates[coordinates.length - 1].x} ${height - paddingY}`,
    "Z",
  ].join(" ");
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  return (
    <div className="chart-wrap">
      <svg aria-hidden="true" className="rate-chart" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="rate-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="grid-line" x1={paddingX} x2={width - paddingX} y1={paddingY} y2={paddingY} />
        <line
          className="grid-line"
          x1={paddingX}
          x2={width - paddingX}
          y1={height / 2}
          y2={height / 2}
        />
        <line
          className="grid-line"
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingY}
          y2={height - paddingY}
        />
        <path className="chart-area" d={areaPath} />
        <polyline className="chart-line" points={linePoints} />
        <circle className="chart-dot start" cx={first.x} cy={first.y} r="4" />
        <circle className="chart-dot" cx={last.x} cy={last.y} r="5" />
      </svg>
      <div className="chart-axis">
        <span>{points[0].date}</span>
        <strong>
          {formatNumber(min)} to {formatNumber(max)}
        </strong>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

function getStats(points: DisplayPoint[], fallbackRate: number) {
  const values = points.length ? points.map((point) => point.rate) : [fallbackRate];
  const first = values[0];
  const current = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const change = current - first;
  const changePercent = first ? (change / first) * 100 : 0;

  return {
    average,
    change,
    changePercent,
    current,
    high,
    low,
    range: high - low,
  };
}

function formatPercent(value: number) {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "always",
    style: "percent",
  }).format(value / 100);

  return formatted;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
