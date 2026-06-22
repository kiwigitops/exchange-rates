import { useEffect, useMemo, useState } from "react";
import { BarChart3, Gauge, LineChart, LoaderCircle, Star, X } from "lucide-react";
import { getStats } from "../lib/analytics";
import { formatCompact, formatMoney, formatPercent, formatRate, marketRegion } from "../lib/format";
import { useHistory } from "../hooks/useHistory";
import type { ChartMode, Direction, Tile } from "../types";
import { InfoTip } from "./InfoTip";
import { BrokerWorkspace } from "./charts/BrokerWorkspace";

type QuoteModalProps = {
  amount: number;
  base: string;
  direction: Direction;
  isFavorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  tile: Tile;
};

const chartModes: ChartMode[] = ["candles", "line", "returns", "technicals", "risk", "depth"];

export function QuoteModal({ amount, base, direction, isFavorite, onClose, onFavorite, tile }: QuoteModalProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const { error, loading, series } = useHistory(base, tile.code, direction, 120);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeRate = direction === "direct" ? tile.rate : 1 / tile.rate;
  const source = direction === "direct" ? base : tile.code;
  const target = direction === "direct" ? tile.code : base;
  const total = direction === "direct" ? amount * tile.rate : amount / tile.rate;
  const stats = useMemo(() => getStats(series, activeRate), [activeRate, series]);

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
          <ModalStat detail="Highest observed rate in the loaded history window." label="High" value={formatRate(stats.high)} />
          <ModalStat detail="Lowest observed rate in the loaded history window." label="Low" value={formatRate(stats.low)} />
          <ModalStat
            detail="Arithmetic mean of every loaded rate point in the history window."
            label="Average"
            value={formatRate(stats.average)}
          />
          <ModalStat detail="High minus low across the loaded history window." label="Range" value={formatRate(stats.range)} />
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
            detail="Stats, volatility, drawdown, percentile, z-score, technicals, and risk views are calculated in the browser from the loaded history points."
            label="Derived"
            value="Local"
          />
          <DatasetCard
            detail="Candle view derives open from the prior daily close and estimates high/low wicks from observed daily movement because the public history feed does not provide intraday OHLC."
            label="Candles"
            value="Derived OHLC"
          />
          <DatasetCard
            detail="Depth view is a broker-style model from current rate, volatility, and recent momentum. It is not a live FX order book."
            label="Depth"
            value="Modelled"
          />
        </section>

        <section className="deep-chart">
          <div className="chart-title">
            {chartMode === "depth" ? <Gauge size={18} /> : <LineChart size={18} />}
            <div>
              <strong>{chartMode === "depth" ? "Market depth" : "120D chart"}</strong>
              <span>
                {source}/{target}
              </span>
            </div>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
          </div>
          <div className="chart-tabs" aria-label="Broker chart views">
            {chartModes.map((mode) => (
              <button className={chartMode === mode ? "active" : ""} key={mode} onClick={() => setChartMode(mode)} type="button">
                {mode === "candles"
                  ? "Candles"
                  : mode === "line"
                    ? "Line"
                    : mode === "returns"
                      ? "Returns"
                      : mode === "technicals"
                        ? "Technicals"
                        : mode === "risk"
                          ? "Risk"
                          : "Depth"}
              </button>
            ))}
          </div>
          {error ? (
            <div className="chart-fallback">
              <BarChart3 size={28} />
              <span>{error}</span>
            </div>
          ) : (
            <BrokerWorkspace currentRate={activeRate} mode={chartMode} points={series} />
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
