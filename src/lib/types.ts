export interface GraphNode {
  id: string;
  label: string;
  /** Number that becomes pitch. Larger means a higher note. */
  value: number;
  /** 0 is far left, 100 is far right. */
  x: number;
  /** 0 is the top, 100 is the bottom. */
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  id: string;
  title: string;
  /** Spoken description of what the nodes are. */
  about: string;
  /** Spoken description of what the numbers mean. */
  valueMeaning: string;
  startNodeId: string;
  /** When true, edges have a direction and both directions are described. */
  directed: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
}

export type Direction = "left" | "right" | "up" | "down";

export type Verbosity = "terse" | "standard" | "detailed";

export interface Link {
  node: GraphNode;
  /** "along" follows a directed edge. "against" walks back up a directed edge. Undirected links are always "along". */
  sense: "along" | "against";
}
