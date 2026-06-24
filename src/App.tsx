import { useEffect, useMemo, useState } from "react";
import { Gauge, LoaderCircle, RefreshCcw, Search, Star } from "lucide-react";
import MarketScene from "./MarketScene";
import { FocusStage } from "./components/FocusStage";
import { QuoteCard } from "./components/QuoteCard";
import { QuoteModal } from "./components/QuoteModal";
import { useLiveRates } from "./hooks/useLiveRates";
import { usePersistentState } from "./hooks/usePersistentState";
import { AMOUNT_KEY, BASE_KEY, DEFAULT_AMOUNT, DEFAULT_BASE, DIRECTION_KEY, FAVORITES_KEY, WATCHLIST } from "./lib/constants";
import { nameOf, pseudoMove, sortCodes } from "./lib/format";
import type { Direction, LatestRates, Tile } from "./types";

export default function App() {
  const [base, setBase] = usePersistentState(BASE_KEY, DEFAULT_BASE);
  const [amount, setAmount] = usePersistentState(AMOUNT_KEY, DEFAULT_AMOUNT);
  const [direction, setDirection] = usePersistentState<Direction>(DIRECTION_KEY, "direct");
  const [favorites, setFavorites] = usePersistentState<string[]>(FAVORITES_KEY, ["EUR", "JPY", "GBP", "CHF"]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Tile | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { error, latest, loading, refresh, refreshing, stale } = useLiveRates(base);

  const selectableCodes = useMemo(() => {
    return sortCodes(latest ? Object.keys(latest.rates) : [base, ...WATCHLIST], [], base);
  }, [base, latest]);

  const tiles = useMemo(() => buildTiles(latest, base, favorites, onlyFavorites, query), [base, favorites, latest, onlyFavorites, query]);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const selectedTile = useMemo(() => {
    if (!selected || selected.code === base) return null;

    const rate = latest?.rates[selected.code];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return selected;

    return {
      ...selected,
      move: pseudoMove(selected.code, rate),
      name: nameOf(selected.code),
      rate,
    };
  }, [base, latest, selected]);
  const headline = tiles[0];
  const focusTiles = tiles.slice(0, 6);
  const marketPulse = useMemo(() => {
    if (!tiles.length) return 0.5;
    return tiles.slice(0, 12).reduce((sum, tile) => sum + Math.abs(tile.move), 0) / Math.min(12, tiles.length);
  }, [tiles]);
  const feedClass = stale ? "feed-pill stale" : refreshing ? "feed-pill syncing" : "feed-pill live";
  const feedLabel = stale ? "Cached" : refreshing ? "Syncing" : "Live";

  function toggleFavorite(code: string) {
    setFavorites((current) => (current.includes(code) ? current.filter((item) => item !== code) : [code, ...current]));
  }

  useEffect(() => {
    if (selected?.code === base) setSelected(null);
  }, [base, selected?.code]);

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
            <div className="feed-controls">
              <div className={feedClass} title={error || "Live market feed"}>
                <span />
                <strong>{feedLabel}</strong>
              </div>
              <button className="glass-icon" disabled={refreshing} onClick={refresh} title="Refresh rates">
                <RefreshCcw className={refreshing ? "spin" : ""} size={18} />
              </button>
            </div>
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
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol" type="search" value={query} />
            </div>
          </label>

          <button className={onlyFavorites ? "pill-button active" : "pill-button"} onClick={() => setOnlyFavorites((value) => !value)}>
            <Star size={16} />
            Favorites
          </button>
        </section>

        {error ? (
          <section className="market-state" role="alert">
            <Gauge size={22} />
            <strong>{latest ? "Using cached feed" : "Feed paused"}</strong>
            <span>{error}</span>
          </section>
        ) : null}

        {loading && !latest ? (
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

        {!loading && latest && !tiles.length ? (
          <section className="market-state">
            <Search size={22} />
            <strong>No symbols found</strong>
            <span>Clear the search or favorites filter.</span>
          </section>
        ) : null}
      </section>

      {selectedTile ? (
        <QuoteModal
          amount={amount}
          base={base}
          direction={direction}
          isFavorite={favoritesSet.has(selectedTile.code)}
          onClose={() => setSelected(null)}
          onFavorite={() => toggleFavorite(selectedTile.code)}
          tile={selectedTile}
        />
      ) : null}
    </main>
  );
}

function buildTiles(latest: LatestRates | null, base: string, favorites: string[], onlyFavorites: boolean, query: string): Tile[] {
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
}
