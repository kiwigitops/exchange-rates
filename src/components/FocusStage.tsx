import { LoaderCircle } from "lucide-react";
import { formatDateTime, formatMoney, formatRate, nameOf } from "../lib/format";
import type { Direction, Tile } from "../types";
import { MiniSpark } from "./MiniSpark";

type FocusStageProps = {
  amount: number;
  base: string;
  direction: Direction;
  headline?: Tile;
  onOpen: (tile: Tile) => void;
  tiles: Tile[];
  updatedAt?: string;
};

export function FocusStage({ amount, base, direction, headline, onOpen, tiles, updatedAt }: FocusStageProps) {
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
