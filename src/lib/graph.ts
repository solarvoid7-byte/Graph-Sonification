import type { Direction, GraphData, GraphEdge, GraphNode, Link } from "./types";

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

export function normalize(input: GraphData): GraphData {
  const warnings: string[] = [];
  const nodes: GraphNode[] = [];
  const seen = new Set<string>();

  for (const node of input.nodes ?? []) {
    const id = node?.id?.trim() ?? "";
    if (!id || seen.has(id)) {
      warnings.push(`Removed a duplicate or blank node (${node?.label || id || "unnamed"}).`);
      continue;
    }
    seen.add(id);
    let value = node.value;
    if (!Number.isFinite(value)) {
      warnings.push(`Node ${node.label || id} had a value that was not a number. It was reset to 0.`);
      value = 0;
    }
    nodes.push({
      id,
      label: node.label?.trim() || id,
      value,
      x: clampAxis(node.x),
      y: clampAxis(node.y),
    });
  }

  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const edge of input.edges ?? []) {
    if (!edge || edge.from === edge.to) {
      warnings.push("Removed a connection from a node to itself.");
      continue;
    }
    if (!seen.has(edge.from) || !seen.has(edge.to)) {
      warnings.push("Removed a connection that pointed at a missing node.");
      continue;
    }
    const key = input.directed ? `${edge.from}->${edge.to}` : [edge.from, edge.to].sort().join("|");
    if (edgeSeen.has(key)) {
      warnings.push("Removed a duplicate connection.");
      continue;
    }
    edgeSeen.add(key);
    edges.push({ from: edge.from, to: edge.to });
  }

  let startNodeId = input.startNodeId;
  if (!seen.has(startNodeId)) {
    warnings.push("The start node was missing. Using the first node instead.");
    startNodeId = nodes[0]?.id ?? "";
  }

  return {
    id: input.id || "graph",
    title: input.title?.trim() || "Untitled graph",
    about: input.about?.trim() || "No description was provided.",
    valueMeaning: input.valueMeaning?.trim() || "the stored number",
    startNodeId,
    directed: Boolean(input.directed),
    nodes,
    edges,
    warnings,
  };
}

export function nodeById(graph: GraphData, id: string | null | undefined): GraphNode | null {
  if (!id) return null;
  return graph.nodes.find((node) => node.id === id) ?? null;
}

export function linksFrom(graph: GraphData, id: string): Link[] {
  const along: Link[] = [];
  const against: Link[] = [];
  const seenAlong = new Set<string>();
  const seenAgainst = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.from === id && edge.to !== id && !seenAlong.has(edge.to)) {
      const node = nodeById(graph, edge.to);
      if (node) {
        seenAlong.add(edge.to);
        along.push({ node, sense: "along" });
      }
    }
    if (graph.directed && edge.to === id && edge.from !== id && !seenAgainst.has(edge.from)) {
      const node = nodeById(graph, edge.from);
      if (node) {
        seenAgainst.add(edge.from);
        against.push({ node, sense: "against" });
      }
    }
    if (!graph.directed && edge.to === id && edge.from !== id && !seenAlong.has(edge.from)) {
      const node = nodeById(graph, edge.from);
      if (node) {
        seenAlong.add(edge.from);
        along.push({ node, sense: "along" });
      }
    }
  }

  const byLabel = (a: Link, b: Link) => a.node.label.localeCompare(b.node.label, undefined, { sensitivity: "base" });
  along.sort(byLabel);
  against.sort(byLabel);
  return [...along, ...against];
}

export function isNeighbor(graph: GraphData, fromId: string, toId: string): boolean {
  return linksFrom(graph, fromId).some((link) => link.node.id === toId);
}

export function linkBetween(graph: GraphData, fromId: string, toId: string): Link | null {
  return linksFrom(graph, fromId).find((link) => link.node.id === toId) ?? null;
}

export interface StepResult {
  link: Link | null;
  wrapped: boolean;
  onlyOne: boolean;
}

/**
 * Move along the connection list.
 * Down (+1) prefers the next name after the node you arrived from, so the first press does not immediately go backwards.
 */
export function stepLink(
  graph: GraphData,
  currentId: string,
  arrivedFromId: string | null,
  delta: 1 | -1,
): StepResult {
  const links = linksFrom(graph, currentId);
  if (links.length === 0) return { link: null, wrapped: false, onlyOne: false };
  if (links.length === 1) return { link: links[0] ?? null, wrapped: false, onlyOne: true };

  let index = delta === 1 ? 0 : links.length - 1;
  if (arrivedFromId) {
    const fromIndex = links.findIndex((link) => link.node.id === arrivedFromId);
    if (fromIndex >= 0) index = fromIndex + delta;
  }

  let wrapped = false;
  if (index >= links.length) {
    index = 0;
    wrapped = true;
  } else if (index < 0) {
    index = links.length - 1;
    wrapped = true;
  }

  return { link: links[index] ?? null, wrapped, onlyOne: false };
}

function angleDelta(a: number, b: number): number {
  let delta = a - b;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return Math.abs(delta);
}

const DIRECTION_ANGLE: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90,
};

export function linkInDirection(
  graph: GraphData,
  currentId: string,
  direction: Direction,
): { link: Link | null; ambiguous: Link | null } {
  const current = nodeById(graph, currentId);
  if (!current) return { link: null, ambiguous: null };
  const target = DIRECTION_ANGLE[direction];
  const candidates = linksFrom(graph, currentId)
    .map((link) => {
      const dx = link.node.x - current.x;
      const dy = link.node.y - current.y;
      if (dx === 0 && dy === 0) return null;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const delta = angleDelta(angle, target);
      if (delta > 45) return null;
      return { link, delta, dist: Math.hypot(dx, dy) };
    })
    .filter((item): item is { link: Link; delta: number; dist: number } => item !== null)
    .sort((a, b) => a.delta - b.delta || a.dist - b.dist);

  const best = candidates[0];
  if (!best) return { link: null, ambiguous: null };
  const runner = candidates[1];
  const ambiguous = runner && runner.delta - best.delta < 8 ? runner.link : null;
  return { link: best.link, ambiguous };
}

export function layoutPhrase(node: GraphNode): string {
  const horizontal = node.x < 34 ? "toward the left" : node.x > 66 ? "toward the right" : "near the horizontal center";
  const vertical = node.y < 34 ? "toward the top" : node.y > 66 ? "toward the bottom" : "near the vertical middle";
  return `${horizontal}, ${vertical}`;
}

export function valueRelation(from: number, to: number): "higher" | "lower" | "the same" {
  if (to > from) return "higher";
  if (to < from) return "lower";
  return "the same";
}

export function highestValueNode(graph: GraphData): GraphNode | null {
  return [...graph.nodes].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))[0] ?? null;
}

function undirectedAdj(graph: GraphData): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) {
    if (!adj.has(edge.from) || !adj.has(edge.to) || edge.from === edge.to) continue;
    const from = adj.get(edge.from)!;
    const to = adj.get(edge.to)!;
    if (!from.includes(edge.to)) from.push(edge.to);
    if (!to.includes(edge.from)) to.push(edge.from);
  }
  for (const list of adj.values()) list.sort();
  return adj;
}

function isSimplePath(graph: GraphData): boolean {
  if (graph.nodes.length === 0) return false;
  const adj = undirectedAdj(graph);
  for (const node of graph.nodes) {
    if ((adj.get(node.id)?.length ?? 0) > 2) return false;
  }
  const seen = new Set<string>();
  let components = 0;
  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue;
    components += 1;
    const stack = [node.id];
    seen.add(node.id);
    while (stack.length) {
      const current = stack.pop()!;
      for (const next of adj.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
  }
  if (components !== 1) return false;
  const undirectedEdges = [...adj.values()].reduce((sum, list) => sum + list.length, 0) / 2;
  return undirectedEdges === graph.nodes.length - 1;
}

function walkPath(graph: GraphData, startId: string): string[] {
  const adj = undirectedAdj(graph);
  const endpoints = graph.nodes.filter((node) => (adj.get(node.id)?.length ?? 0) <= 1);
  const begin = endpoints.some((node) => node.id === startId) ? startId : (endpoints[0]?.id ?? startId);
  const order = [begin];
  let previous: string | null = null;
  let current = begin;
  while (order.length < graph.nodes.length) {
    const next = (adj.get(current) ?? []).find((id) => id !== previous);
    if (!next) break;
    order.push(next);
    previous = current;
    current = next;
  }
  return order;
}

function hasDirectedCycle(graph: GraphData): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const outgoing = new Map<string, string[]>();
  for (const node of graph.nodes) outgoing.set(node.id, []);
  for (const edge of graph.edges) outgoing.get(edge.from)?.push(edge.to);

  const visit = (id: string): boolean => {
    if (visited.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return graph.nodes.some((node) => visit(node.id));
}

function topologicalOrder(graph: GraphData): string[] | null {
  if (hasDirectedCycle(graph)) return null;
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of graph.nodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) continue;
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const labelOf = (id: string) => nodeById(graph, id)?.label ?? id;
  const queue = graph.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length) {
    queue.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }
  if (order.length !== graph.nodes.length) return null;
  return order;
}

function breadthOrder(graph: GraphData, startId: string): { reached: string[]; rest: string[] } {
  const reached: string[] = [];
  const seen = new Set<string>();
  if (!nodeById(graph, startId)) return { reached, rest: graph.nodes.map((node) => node.id) };
  const queue = [startId];
  seen.add(startId);
  while (queue.length) {
    const id = queue.shift()!;
    reached.push(id);
    for (const link of linksFrom(graph, id)) {
      if (seen.has(link.node.id)) continue;
      if (graph.directed && link.sense === "against") continue;
      seen.add(link.node.id);
      queue.push(link.node.id);
    }
  }
  const rest = graph.nodes
    .filter((node) => !seen.has(node.id))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((node) => node.id);
  return { reached, rest };
}

export interface PlaybackPlan {
  ids: string[];
  description: string;
}

export function playbackPlan(graph: GraphData): PlaybackPlan {
  if (graph.nodes.length === 0) {
    return { ids: [], description: `${graph.title} has no nodes to play.` };
  }
  const start = nodeById(graph, graph.startNodeId) ?? graph.nodes[0]!;

  if (!graph.directed && isSimplePath(graph)) {
    const ids = walkPath(graph, start.id);
    const first = nodeById(graph, ids[0] ?? "")?.label ?? start.label;
    return {
      ids,
      description: `${graph.title}. A chain of ${ids.length}, starting at ${first}. Values are ${graph.valueMeaning}.`,
    };
  }

  if (graph.directed) {
    const topo = topologicalOrder(graph);
    if (topo) {
      const first = nodeById(graph, topo[0] ?? "")?.label ?? start.label;
      return {
        ids: topo,
        description: `${graph.title}. Prerequisite order, ${topo.length} nodes, starting at ${first}. Values are ${graph.valueMeaning}.`,
      };
    }
  }

  const { reached, rest } = breadthOrder(graph, start.id);
  const ids = [...reached, ...rest];
  let description = `${graph.title}. Starting at ${start.label}, nearby nodes first. Values are ${graph.valueMeaning}.`;
  if (rest.length > 0) {
    const names = rest.map((id) => nodeById(graph, id)?.label ?? id).join(", ");
    description += ` Then not connected to ${start.label}: ${names}.`;
  }
  return { ids, description };
}

export function connectionCountPhrase(graph: GraphData, nodeId: string): string {
  const links = linksFrom(graph, nodeId);
  if (!graph.directed) {
    if (links.length === 0) return "no connections";
    if (links.length === 1) return "1 connection";
    return `${links.length} connections`;
  }
  const onward = links.filter((link) => link.sense === "along").length;
  const incoming = links.filter((link) => link.sense === "against").length;
  if (onward === 0 && incoming === 0) return "no connections";
  const parts: string[] = [];
  if (onward > 0) parts.push(onward === 1 ? "1 onward" : `${onward} onward`);
  if (incoming > 0) parts.push(incoming === 1 ? "1 incoming" : `${incoming} incoming`);
  return parts.join(", ");
}
