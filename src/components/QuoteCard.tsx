import { ChevronRight, Star } from "lucide-react";
import { formatMoney, formatRate, marketRegion } from "../lib/format";
import type { Direction, Tile } from "../types";
import { MiniSpark } from "./MiniSpark";

type QuoteCardProps = {
  amount: number;
  base: string;
  direction: Direction;
  isFavorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  tile: Tile;
};

export function QuoteCard({ amount, base, direction, isFavorite, onFavorite, onOpen, tile }: QuoteCardProps) {
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
