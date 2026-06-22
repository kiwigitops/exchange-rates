export function MiniSpark({ move }: { move: number }) {
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
