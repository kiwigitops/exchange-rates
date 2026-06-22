import { useRef, useState } from "react";
import { Info } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; placement: "bottom" | "top"; top: number } | null>(null);

  function showTooltip() {
    const icon = iconRef.current;
    if (!icon) return;

    const rect = icon.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - 40);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + 12),
      window.innerWidth - tooltipWidth / 2 - 12,
    );
    const showAbove = rect.bottom + 132 > window.innerHeight;

    setTooltip({
      left,
      placement: showAbove ? "top" : "bottom",
      top: showAbove ? rect.top - 10 : rect.bottom + 10,
    });
  }

  return (
    <span
      aria-label={text}
      className="info-tip"
      onBlur={() => setTooltip(null)}
      onFocus={showTooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltip(null)}
      ref={iconRef}
      tabIndex={0}
    >
      <Info size={12} />
      {tooltip ? (
        <span
          className={tooltip.placement === "top" ? "floating-info-tooltip above" : "floating-info-tooltip"}
          role="tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
