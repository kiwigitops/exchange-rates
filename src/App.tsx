import { type PointerEvent, type TouchEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  Gauge,
  Info,
  LineChart,
  LoaderCircle,
  RefreshCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import MarketScene from "./MarketScene";
import {
  DEFAULT_AMOUNT,
  DEFAULT_BASE,
  type Direction,
  type HistoryPoint,
  type LatestRates,
  WATCHLIST,
  fetchHistory,
  fetchLatest,
  formatCompact,
  formatDateTime,
  formatMoney,
  formatRate,
  marketRegion,
  nameOf,
  pseudoMove,
  readSetting,
  sortCodes,
  writeSetting,
} from "./market";

type Tile = {
  code: string;
  move: number;
  name: string;
  rate: number;
};

const BASE_KEY = "stocksfx:base";
const AMOUNT_KEY = "stocksfx:amount";
const DIRECTION_KEY = "stocksfx:direction";
const FAVORITES_KEY = "stocksfx:favorites";

export default function App() {
  const [base, setBase] = useState(() => readSetting(BASE_KEY, DEFAULT_BASE));
  const [amount, setAmount] = useState(() => readSetting(AMOUNT_KEY, DEFAULT_AMOUNT));
  const [direction, setDirection] = useState<Direction>(() => readSetting(DIRECTION_KEY, "direct"));
  const [favorites, setFavorites] = useState<string[]>(() => readSetting(FAVORITES_KEY, ["EUR", "JPY", "GBP", "CHF"]));
  const [latest, setLatest] = useState<LatestRates | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Tile | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => writeSetting(BASE_KEY, base), [base]);
  useEffect(() => writeSetting(AMOUNT_KEY, amount), [amount]);
  useEffect(() => writeSetting(DIRECTION_KEY, direction), [direction]);
  useEffect(() => writeSetting(FAVORITES_KEY, favorites), [favorites]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetchLatest(base, controller.signal)
      .then(setLatest)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The market feed is unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [base, refreshKey]);

  const selectableCodes = useMemo(() => {
    return sortCodes(latest ? Object.keys(latest.rates) : [base, ...WATCHLIST], [], base);
  }, [base, latest]);

  const tiles = useMemo<Tile[]>(() => {
    if (!latest) return [];

    const needle = query.trim().toLowerCase();

    return sortCodes(
      Object.entries(latest.rates)
        .filter(([code, rate]) => code !== base && Number.isFinite(rate) && rate > 0)
        .map(([code]) => code),
      favorites,
      base,
    )
      .map((code) => ({
        code,
        move: pseudoMove(code, latest.rates[code]),
        name: nameOf(code),
        rate: latest.rates[code],
      }))
      .filter((tile) => {
        if (onlyFavorites && !favorites.includes(tile.code)) return false;
        if (!needle) return true;
        return tile.code.toLowerCase().includes(needle) || tile.name.toLowerCase().includes(needle);
      });
  }, [base, favorites, latest, onlyFavorites, query]);

  const marketPulse = useMemo(() => {
    if (!tiles.length) return 0.5;
    return tiles.slice(0, 12).reduce((sum, tile) => sum + Math.abs(tile.move), 0) / Math.min(12, tiles.length);
  }, [tiles]);

  const favoritesSet = new Set(favorites);
  const headline = tiles[0];
  const focusTiles = tiles.slice(0, 6);

  function toggleFavorite(code: string) {
    setFavorites((current) => (current.includes(code) ? current.filter((item) => item !== code) : [code, ...current]));
  }

  return (
    <main className="terminal">
      <MarketScene intensity={marketPulse} isReverse={direction === "reverse"} />
      <div className="screen-vignette" />

      <section className="app-frame">
        <header className="hero">
          <nav className="top-nav">
            <div>
              <span className="tiny-label">FX Watch</span>
              <h1>Exchange Rates</h1>
            </div>
            <button className="glass-icon" onClick={() => setRefreshKey((value) => value + 1)} title="Refresh rates">
              <RefreshCcw size={18} />
            </button>
          </nav>

          <FocusStage
            amount={amount}
            base={base}
            direction={direction}
            headline={headline}
            onOpen={setSelected}
            tiles={focusTiles}
            updatedAt={latest?.updatedAt}
          />
        </header>

        <section className="quote-controls" aria-label="Exchange controls">
          <label>
            <span>Home</span>
            <select value={base} onChange={(event) => setBase(event.target.value)}>
              {selectableCodes.map((code) => (
                <option key={code} value={code}>
                  {code} - {nameOf(code)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Amount</span>
            <input
              inputMode="decimal"
              min="0"
              onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
              type="number"
              value={amount}
            />
          </label>

          <div className="segmented" aria-label="Conversion direction">
            <button className={direction === "direct" ? "active" : ""} onClick={() => setDirection("direct")}>
              Mine to World
            </button>
            <button className={direction === "reverse" ? "active" : ""} onClick={() => setDirection("reverse")}>
              World to Mine
            </button>
          </div>

          <label className="search-field">
            <span>Search</span>
            <div>
              <Search size={16} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search symbol"
                type="search"
                value={query}
              />
            </div>
          </label>

          <button
            className={onlyFavorites ? "pill-button active" : "pill-button"}
            onClick={() => setOnlyFavorites((value) => !value)}
          >
            <Star size={16} />
            Favorites
          </button>
        </section>

        {error ? (
          <section className="market-state" role="alert">
            <Gauge size={22} />
            <strong>Feed paused</strong>
            <span>{error}</span>
          </section>
        ) : null}

        {loading ? (
          <section className="market-state large">
            <LoaderCircle className="spin" size={26} />
            <strong>Opening market</strong>
            <span>Pulling live exchange quotes</span>
          </section>
        ) : (
          <section className="watch-grid" aria-label="Currency cards">
            {tiles.map((tile) => (
              <QuoteCard
                amount={amount}
                base={base}
                direction={direction}
                isFavorite={favoritesSet.has(tile.code)}
                key={tile.code}
                onFavorite={() => toggleFavorite(tile.code)}
                onOpen={() => setSelected(tile)}
                tile={tile}
              />
            ))}
          </section>
        )}

        {!loading && !tiles.length ? (
          <section className="market-state">
            <Search size={22} />
            <strong>No symbols found</strong>
            <span>Clear the search or favorites filter.</span>
          </section>
        ) : null}
      </section>

      {selected ? (
        <QuoteModal
          amount={amount}
          base={base}
          direction={direction}
          isFavorite={favoritesSet.has(selected.code)}
          onClose={() => setSelected(null)}
          onFavorite={() => toggleFavorite(selected.code)}
          tile={selected}
        />
      ) : null}
    </main>
  );
}

function FocusStage({
  amount,
  base,
  direction,
  headline,
  onOpen,
  tiles,
  updatedAt,
}: {
  amount: number;
  base: string;
  direction: Direction;
  headline?: Tile;
  onOpen: (tile: Tile) => void;
  tiles: Tile[];
  updatedAt?: string;
}) {
  if (!headline) {
    return (
      <section className="focus-stage">
        <div className="focus-panel empty">
          <LoaderCircle className="spin" size={22} />
          <strong>Opening market</strong>
        </div>
      </section>
    );
  }

  const source = direction === "direct" ? base : headline.code;
  const target = direction === "direct" ? headline.code : base;
  const converted = direction === "direct" ? amount * headline.rate : amount / headline.rate;
  const activeRate = direction === "direct" ? headline.rate : 1 / headline.rate;

  return (
    <section className="focus-stage" aria-label="Focused exchange market">
      <button className="focus-panel" onClick={() => onOpen(headline)}>
        <div className="focus-kicker">
          <span>{direction === "direct" ? "Focused pair" : "Reverse pair"}</span>
          <em className={headline.move < 0 ? "down" : "up"}>
            {headline.move >= 0 ? "+" : ""}
            {headline.move.toFixed(2)}%
          </em>
        </div>
        <strong className="focus-symbol">
          {source}/{target}
        </strong>
        <span className="focus-name">{nameOf(target)}</span>
        <MiniSpark move={headline.move} />
        <div className="focus-bottom">
          <div>
            <span>
              {formatMoney(amount, source)} into {target}
            </span>
            <strong>{formatMoney(converted, target)}</strong>
          </div>
          <div>
            <span>Spot</span>
            <strong>{formatRate(activeRate)}</strong>
          </div>
        </div>
      </button>

      <aside className="focus-rail" aria-label="Top watchlist">
        <div className="rail-head">
          <span>Watchlist</span>
          <strong>{updatedAt ? formatDateTime(updatedAt) : "Live feed"}</strong>
        </div>
        {tiles.map((tile) => {
          const rate = direction === "direct" ? tile.rate : 1 / tile.rate;
          return (
            <button key={tile.code} onClick={() => onOpen(tile)}>
              <div>
                <strong>{tile.code}</strong>
                <span>{nameOf(tile.code)}</span>
              </div>
              <div>
                <strong>{formatRate(rate)}</strong>
                <em className={tile.move < 0 ? "down" : "up"}>
                  {tile.move >= 0 ? "+" : ""}
                  {tile.move.toFixed(2)}%
                </em>
              </div>
            </button>
          );
        })}
      </aside>
    </section>
  );
}

function QuoteCard({
  amount,
  base,
  direction,
  isFavorite,
  onFavorite,
  onOpen,
  tile,
}: {
  amount: number;
  base: string;
  direction: Direction;
  isFavorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  tile: Tile;
}) {
  const direct = amount * tile.rate;
  const reverse = amount / tile.rate;
  const activeRate = direction === "direct" ? tile.rate : 1 / tile.rate;
  const source = direction === "direct" ? base : tile.code;
  const target = direction === "direct" ? tile.code : base;
  const displayAmount = direction === "direct" ? direct : reverse;
  const isDown = tile.move < 0;

  return (
    <article className="quote-card">
      <button className="favorite-chip" onClick={onFavorite} title={isFavorite ? "Unfavorite" : "Favorite"}>
        <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
      </button>

      <button className="quote-open" onClick={onOpen}>
        <span className="card-region">{marketRegion(tile.code)}</span>
        <div className="symbol-line">
          <strong>{tile.code}</strong>
          <em className={isDown ? "down" : "up"}>
            {tile.move >= 0 ? "+" : ""}
            {tile.move.toFixed(2)}%
          </em>
        </div>
        <span className="currency-name">{tile.name}</span>

        <MiniSpark move={tile.move} />

        <div className="card-price">
          <strong>{formatMoney(displayAmount, target)}</strong>
          <span>
            1 {source} = {formatRate(activeRate)} {target}
          </span>
        </div>

        <ChevronRight className="chevron" size={17} />
      </button>
    </article>
  );
}

function MiniSpark({ move }: { move: number }) {
  const points = Array.from({ length: 18 }, (_, index) => {
    const x = (index / 17) * 100;
    const y = 24 + Math.sin(index * 0.75 + move) * 8 - move * 2 + Math.cos(index * 0.31) * 5;
    return `${x},${Math.max(6, Math.min(42, y))}`;
  }).join(" ");

  return (
    <svg className={move < 0 ? "spark down" : "spark up"} viewBox="0 0 100 48" preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  );
}

function QuoteModal({
  amount,
  base,
  direction,
  isFavorite,
  onClose,
  onFavorite,
  tile,
}: {
  amount: number;
  base: string;
  direction: Direction;
  isFavorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  tile: Tile;
}) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setHistory([]);

    fetchHistory(base, tile.code, 120, controller.signal)
      .then(setHistory)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "History unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [base, tile.code]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const series = useMemo(() => {
    return history
      .map((point) => ({
        date: point.date,
        rate: direction === "direct" ? point.rate : 1 / point.rate,
      }))
      .filter((point) => Number.isFinite(point.rate));
  }, [direction, history]);

  const activeRate = direction === "direct" ? tile.rate : 1 / tile.rate;
  const source = direction === "direct" ? base : tile.code;
  const target = direction === "direct" ? tile.code : base;
  const total = direction === "direct" ? amount * tile.rate : amount / tile.rate;
  const stats = getStats(series, activeRate);

  return (
    <div className="modal-layer" onClick={onClose}>
      <section className="quote-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <span className="tiny-label">{marketRegion(tile.code)}</span>
            <h2>
              {tile.code} <span>{tile.name}</span>
            </h2>
          </div>
          <div className="modal-actions">
            <button className="glass-icon" onClick={onFavorite} title={isFavorite ? "Unfavorite" : "Favorite"}>
              <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button className="glass-icon" onClick={onClose} title="Close">
              <X size={19} />
            </button>
          </div>
        </header>

        <section className="modal-price">
          <div>
            <span>
              {formatMoney(amount, source)} into {target}
            </span>
            <strong>{formatMoney(total, target)}</strong>
          </div>
          <em className={tile.move < 0 ? "down" : "up"}>
            {tile.move >= 0 ? "+" : ""}
            {tile.move.toFixed(2)}%
          </em>
        </section>

        <section className="stats-board">
          <ModalStat
            detail="Most recent point in the selected history series. If history is still loading, this falls back to the live spot rate."
            label="Current"
            value={formatRate(stats.current)}
          />
          <ModalStat
            detail="First point in the loaded 120 day history window. This is the baseline for return and drawdown calculations."
            label="Open"
            value={formatRate(stats.open)}
          />
          <ModalStat
            detail="Highest observed rate in the loaded history window."
            label="High"
            value={formatRate(stats.high)}
          />
          <ModalStat
            detail="Lowest observed rate in the loaded history window."
            label="Low"
            value={formatRate(stats.low)}
          />
          <ModalStat
            detail="Arithmetic mean of every loaded rate point in the history window."
            label="Average"
            value={formatRate(stats.average)}
          />
          <ModalStat
            detail="High minus low across the loaded history window."
            label="Range"
            value={formatRate(stats.range)}
          />
        </section>

        <section className="quant-panel" aria-label="Quant metrics">
          <div className="panel-heading">
            <span>Quant metrics</span>
            <InfoTip text="These are local calculations from the visible historical rate series, not additional paid market data." />
          </div>
          <div className="quant-grid">
            <ModalStat
              detail="Percent change from the first loaded point to the current loaded point."
              label="120D return"
              tone={stats.periodReturn >= 0 ? "positive" : "negative"}
              value={formatPercent(stats.periodReturn, true)}
            />
            <ModalStat
              detail="Annualized standard deviation of daily percentage returns in the loaded history series."
              label="Ann. vol"
              value={formatPercent(stats.annualizedVolatility)}
            />
            <ModalStat
              detail="Worst peak-to-trough decline observed inside the loaded history window."
              label="Max DD"
              tone="negative"
              value={formatPercent(stats.maxDrawdown)}
            />
            <ModalStat
              detail="Where the current rate sits versus the loaded history window. 100% means it is at the top of the observed range."
              label="Percentile"
              value={formatPercent(stats.percentile)}
            />
            <ModalStat
              detail="Distance from the average rate, measured in standard deviations of the loaded rate series."
              label="Z-score"
              tone={stats.zScore >= 0 ? "positive" : "negative"}
              value={`${formatCompact(stats.zScore, 2)}σ`}
            />
            <ModalStat
              detail="Number of daily observations loaded for this pair and direction."
              label="Samples"
              value={formatCompact(stats.observations, 0)}
            />
          </div>
        </section>

        <section className="dataset-board" aria-label="Dataset information">
          <DatasetCard
            detail="Latest conversion quote from the open ExchangeRate-API endpoint for the selected home currency."
            label="Spot quote"
            value={`${source}/${target}`}
          />
          <DatasetCard
            detail="Daily time-series rows from Frankfurter v2 for the selected pair. Reverse mode inverts each historical rate locally."
            label="History"
            value={`${stats.observations} rows`}
          />
          <DatasetCard
            detail="Stats, volatility, drawdown, percentile, and z-score are calculated in the browser from the loaded history points."
            label="Derived"
            value="Local"
          />
        </section>

        <section className="deep-chart">
          <div className="chart-title">
            <LineChart size={18} />
            <div>
              <strong>120D chart</strong>
              <span>
                {source}/{target}
              </span>
            </div>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
          </div>
          {error ? (
            <div className="chart-fallback">
              <BarChart3 size={28} />
              <span>{error}</span>
            </div>
          ) : (
            <BigChart points={series} />
          )}
        </section>
      </section>
    </div>
  );
}

function ModalStat({
  detail,
  label,
  tone = "",
  value,
}: {
  detail: string;
  label: string;
  tone?: "positive" | "negative" | "";
  value: string;
}) {
  return (
    <div className={tone ? `metric-card ${tone}` : "metric-card"}>
      <span>
        {label}
        <InfoTip text={detail} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function DatasetCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div>
      <span>
        {label}
        <InfoTip text={detail} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span aria-label={text} className="info-tip" tabIndex={0}>
      <Info size={12} />
      <span role="tooltip">{text}</span>
    </span>
  );
}

function BigChart({ points }: { points: { date: string; rate: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="chart-fallback">
        <BarChart3 size={28} />
        <span>No chart data yet</span>
      </div>
    );
  }

  const width = 900;
  const height = 310;
  const pad = 22;
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (point.rate - min) / range) * (height - pad * 2);
    return { ...point, x, y };
  });
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = [
    `M ${coordinates[0].x} ${height - pad}`,
    ...coordinates.map((point) => `L ${point.x} ${point.y}`),
    `L ${coordinates[coordinates.length - 1].x} ${height - pad}`,
    "Z",
  ].join(" ");
  const rising = values[values.length - 1] >= values[0];
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];

  function selectPoint(clientX: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * width;
    const index = Math.round(((x - pad) / (width - pad * 2)) * (coordinates.length - 1));
    setHoveredIndex(Math.max(0, Math.min(coordinates.length - 1, index)));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    selectPoint(event.clientX, event.currentTarget.getBoundingClientRect());
  }

  function handleTouch(event: TouchEvent<SVGSVGElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return;
    selectPoint(touch.clientX, event.currentTarget.getBoundingClientRect());
  }

  return (
    <div className="interactive-chart">
      <svg
        aria-label="Interactive rate chart"
        className={rising ? "big-chart up" : "big-chart down"}
        onPointerDown={handlePointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerMove={handlePointerMove}
        onTouchMove={handleTouch}
        onTouchStart={handleTouch}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="area" d={area} />
        <polyline points={line} />
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker" cx={activePoint.x} cy={activePoint.y} r="8" />
          </>
        ) : null}
      </svg>
      {activePoint ? (
        <div
          className={activePoint.x > width * 0.72 ? "chart-tooltip left" : "chart-tooltip"}
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
          }}
        >
          <span>{activePoint.date}</span>
          <strong>{formatCompact(activePoint.rate, 5)}</strong>
        </div>
      ) : null}
      <div className="chart-range">
        <span>{points[0].date}</span>
        <strong>
          {formatCompact(min, 4)} - {formatCompact(max, 4)}
        </strong>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

function getStats(points: { rate: number }[], fallback: number) {
  const values = points.length ? points.map((point) => point.rate) : [fallback];
  const open = values[0];
  const current = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rateStdDev = standardDeviation(values);
  const returns = values
    .slice(1)
    .map((value, index) => (values[index] ? (value - values[index]) / values[index] : 0))
    .filter((value) => Number.isFinite(value));
  const annualizedVolatility = standardDeviation(returns) * Math.sqrt(365);
  const percentile = values.filter((value) => value <= current).length / values.length;

  return {
    annualizedVolatility,
    average,
    current,
    high,
    low,
    maxDrawdown: getMaxDrawdown(values),
    open,
    observations: values.length,
    percentile,
    periodReturn: open ? (current - open) / open : 0,
    range: high - low,
    zScore: rateStdDev ? (current - average) / rateStdDev : 0,
  };
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function getMaxDrawdown(values: number[]) {
  let peak = values[0] ?? 0;
  let drawdown = 0;

  values.forEach((value) => {
    peak = Math.max(peak, value);
    if (peak > 0) {
      drawdown = Math.min(drawdown, value / peak - 1);
    }
  });

  return drawdown;
}

function formatPercent(value: number, showSign = false) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: showSign ? "always" : "auto",
    style: "percent",
  }).format(value);
}
