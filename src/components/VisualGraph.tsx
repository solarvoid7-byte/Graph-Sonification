import type { GraphData } from "../lib/types";

interface VisualGraphProps {
  graph: GraphData;
  currentId: string;
  onJump: (id: string) => void;
}

/** A drawing for people who can see. Hidden from assistive technology; the lists are the interface. */
export function VisualGraph({ graph, currentId, onJump }: VisualGraphProps) {
  const height = 280;
  const width = 640;
  return (
    <figure className="drawing" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} role="presentation">
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((node) => node.id === edge.from);
          const to = graph.nodes.find((node) => node.id === edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={scale(from.x, width)}
              y1={scale(from.y, height)}
              x2={scale(to.x, width)}
              y2={scale(to.y, height)}
            />
          );
        })}
        {graph.nodes.map((node) => {
          const current = node.id === currentId;
          const x = scale(node.x, width);
          const y = scale(node.y, height);
          return (
            <g key={node.id} transform={`translate(${x} ${y})`}>
              <circle r={current ? 16 : 12} className={current ? "is-current" : undefined} />
              <text y={current ? 36 : 32} textAnchor="middle">
                {node.label}
                {current ? " (current)" : ""}
              </text>
              <circle
                r={22}
                className="hit"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onJump(node.id)}
              />
            </g>
          );
        })}
      </svg>
      <figcaption>Drawing of {graph.title}. Current node: {graph.nodes.find((node) => node.id === currentId)?.label}.</figcaption>
    </figure>
  );
}

function scale(value: number, size: number): number {
  return 36 + (value / 100) * (size - 72);
}
