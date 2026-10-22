import { connectionCountPhrase, layoutPhrase, linksFrom, valueRelation } from "./graph";
import type { GraphData, GraphNode, Link, Verbosity } from "./types";

export function nodeOptionLabel(node: GraphNode, graph: GraphData, verbosity: Verbosity): string {
  if (verbosity === "terse") return node.label;
  const count = connectionCountPhrase(graph, node.id);
  if (verbosity === "standard") return `${node.label}, value ${node.value}, ${count}`;
  const names = linksFrom(graph, node.id).map((link) => link.node.label);
  const who = names.length ? names.join(", ") : "none";
  return `${node.label}, value ${node.value}. Values are ${graph.valueMeaning}. ${count}. Connected with ${who}. ${layoutPhrase(node)}.`;
}

function comparedWith(relation: "higher" | "lower" | "the same", other: string): string {
  if (relation === "the same") return `the same value as ${other}`;
  return `a ${relation} value than ${other}`;
}

export function connectionOptionLabel(
  link: Link,
  current: GraphNode,
  graph: GraphData,
  verbosity: Verbosity,
): string {
  const relation = valueRelation(current.value, link.node.value);
  const sense = graph.directed ? (link.sense === "along" ? " Along the arrow." : " Against the arrow.") : "";
  if (verbosity === "terse") return `${link.node.label}${sense ? `, ${link.sense === "along" ? "onward" : "incoming"}` : ""}`;
  const base = `${link.node.label}, value ${link.node.value}, ${comparedWith(relation, current.label)}.${sense}`;
  if (verbosity === "standard") return base;
  return `${base} ${layoutPhrase(link.node)}. ${connectionCountPhrase(graph, link.node.id)}.`;
}

export function whereYouAre(node: GraphNode, graph: GraphData, verbosity: Verbosity): string {
  const links = linksFrom(graph, node.id);
  const count = connectionCountPhrase(graph, node.id);
  if (verbosity === "terse") return `${node.label}. Value ${node.value}. ${count}.`;
  const names = links.map((link) => {
    if (!graph.directed) return link.node.label;
    return `${link.node.label} (${link.sense === "along" ? "onward" : "incoming"})`;
  });
  const list = names.length ? names.join(", ") : "nowhere";
  const base = `${node.label}. Value ${node.value}, ${relationToRange(node, graph)}. ${count}: ${list}.`;
  if (verbosity === "standard") return base;
  return `${base} Values are ${graph.valueMeaning}. ${layoutPhrase(node)}.`;
}

function relationToRange(node: GraphNode, graph: GraphData): string {
  const values = graph.nodes.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return "every node has this same value";
  if (node.value === max) return "the highest value in this graph";
  if (node.value === min) return "the lowest value in this graph";
  return `between ${min} and ${max}`;
}

export function travelMessage(options: {
  graph: GraphData;
  from: GraphNode;
  link: Link;
  verbosity: Verbosity;
  wrapped: boolean;
  onlyOne: boolean;
  direction?: string;
  ambiguousLabel?: string;
}): string {
  const { graph, from, link, verbosity, wrapped, onlyOne, direction, ambiguousLabel } = options;
  const relation = valueRelation(from.value, link.node.value);
  const compared = relation === "the same" ? `the same as ${from.label}` : `${relation} than ${from.label}`;
  const bits = [
    `${link.node.label}.`,
    `Value ${link.node.value}, ${compared}.`,
  ];
  if (graph.directed) bits.push(link.sense === "along" ? "Along the arrow." : "Against the arrow.");
  if (direction) bits.push(`Direction ${direction}.`);
  if (onlyOne) bits.push(graph.directed ? "Only one link from here." : "Only one connection.");
  if (wrapped) bits.push("Starting this node's connection list again.");
  if (ambiguousLabel) bits.push(`Another node, ${ambiguousLabel}, is close to that direction. This one was closer.`);
  if (verbosity !== "terse") bits.push(`${connectionCountPhrase(graph, link.node.id)}.`);
  if (verbosity === "detailed") bits.push(`${layoutPhrase(link.node)}.`);
  return bits.join(" ");
}

export function jumpMessage(node: GraphNode, graph: GraphData, verbosity: Verbosity): string {
  const base = `Jumped to ${node.label}. Value ${node.value}. This jump does not follow a connection. ${connectionCountPhrase(graph, node.id)}.`;
  if (verbosity === "detailed") return `${base} ${layoutPhrase(node)}.`;
  return base;
}

export function graphChangeMessage(graph: GraphData, node: GraphNode): string {
  const warning = graph.warnings.length ? ` Data notes: ${graph.warnings.join(" ")}` : "";
  return `Graph: ${graph.title}. ${graph.about} Values are ${graph.valueMeaning}. You are at ${node.label}, value ${node.value}.${warning}`;
}
