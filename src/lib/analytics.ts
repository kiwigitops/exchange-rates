import type { CandlePoint, RatePoint } from "../types";

export function buildCandles(points: RatePoint[]): CandlePoint[] {
  if (!points.length) return [];

  const returns = getReturns(points).map((point) => Math.abs(point.returnValue));
  const averageMove = Math.max(mean(returns), 0.00035);

  return points.map((point, index) => {
    const open = index === 0 ? point.rate : points[index - 1].rate;
    const close = point.rate;
    const wick = Math.max(Math.abs(close - open) * 0.42, close * averageMove * 0.55);

    return {
      change: open ? (close - open) / open : 0,
      close,
      date: point.date,
      high: Math.max(open, close) + wick,
      low: Math.max(0, Math.min(open, close) - wick),
      open,
    };
  });
}

export function getReturns(points: RatePoint[]) {
  return points
    .slice(1)
    .map((point, index) => {
      const previous = points[index].rate;
      return {
        date: point.date,
        returnValue: previous ? (point.rate - previous) / previous : 0,
      };
    })
    .filter((point) => Number.isFinite(point.returnValue));
}

export function movingAverage(values: number[], period: number) {
  return mean(values.slice(-period));
}

export function rollingAverage(values: number[], period: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    return mean(values.slice(start, index + 1));
  });
}

export function getRsi(values: number[], period: number) {
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const window = changes.slice(-period);
  const gains = window.map((change) => Math.max(0, change));
  const losses = window.map((change) => Math.abs(Math.min(0, change)));
  const averageGain = mean(gains);
  const averageLoss = mean(losses);

  if (averageLoss === 0) return 100;

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function getMacd(values: number[]) {
  const macdSeries = values.map((_, index) => {
    const slice = values.slice(0, index + 1);
    return getEma(slice, 12) - getEma(slice, 26);
  });
  const macd = macdSeries[macdSeries.length - 1] ?? 0;
  const signal = getEma(macdSeries, 9);

  return {
    histogram: macd - signal,
    macd,
    signal,
  };
}

export function getDrawdownSeries(values: number[]) {
  let peak = values[0] ?? 0;

  return values.map((value) => {
    peak = Math.max(peak, value);
    return peak ? value / peak - 1 : 0;
  });
}

export function getStats(points: { rate: number }[], fallback: number) {
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

export function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function getEma(values: number[], period: number) {
  if (!values.length) return 0;

  const multiplier = 2 / (period + 1);
  return values.reduce((ema, value, index) => (index === 0 ? value : value * multiplier + ema * (1 - multiplier)), values[0]);
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
