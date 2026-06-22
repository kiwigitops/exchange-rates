export type Direction = "direct" | "reverse";

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

export type RatePoint = {
  date: string;
  rate: number;
};

export type Tile = {
  code: string;
  move: number;
  name: string;
  rate: number;
};

export type ChartMode = "candles" | "line" | "returns" | "technicals" | "risk" | "depth";

export type CandlePoint = {
  change: number;
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
};
