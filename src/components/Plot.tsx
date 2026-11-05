import { yValue, type EquationKind } from "../audio/scan";

interface PlotProps {
  kind: EquationKind;
  slope: number;
  constant: number;
  scanX: number | null;
}

const SIZE = 320;

function point(x: number, y: number): [number, number] {
  const pad = 16;
  const span = SIZE - pad * 2;
  const px = pad + ((x + 10) / 20) * span;
  const py = pad + ((10 - y) / 20) * span;
  return [px, py];
}

export function Plot({ kind, slope, constant, scanX }: PlotProps) {
  const grid: number[] = [];
  for (let value = -10; value <= 10; value += 2) grid.push(value);

  const samples: Array<[number, number]> = [];
  for (let index = 0; index <= 80; index += 1) {
    const x = -10 + (20 * index) / 80;
    const y = yValue(kind, slope, constant, x);
    if (y >= -10 && y <= 10) samples.push(point(x, y));
  }
  const line = samples.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const scanY = scanX === null ? null : yValue(kind, slope, constant, scanX);
  const dot = scanX !== null && scanY !== null && scanY >= -10 && scanY <= 10 ? point(scanX, scanY) : null;

  return (
    <svg className="plot" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-hidden="true">
      {grid.map((value) => {
        const [x1, y1] = point(value, -10);
        const [x2, y2] = point(value, 10);
        const [hx1, hy1] = point(-10, value);
        const [hx2, hy2] = point(10, value);
        const axis = value === 0;
        return (
          <g key={value}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={axis ? "axis" : "grid"} />
            <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} className={axis ? "axis" : "grid"} />
          </g>
        );
      })}
      {samples.length > 1 ? <polyline points={line} className="series" /> : null}
      {dot ? <circle cx={dot[0]} cy={dot[1]} r="5" className="scan-dot" /> : null}
    </svg>
  );
}
