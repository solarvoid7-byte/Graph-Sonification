import { normalize } from "./graph";
import type { GraphData } from "./types";

const raw: GraphData[] = [
  {
    id: "neighborhood",
    title: "Neighborhood errands",
    about:
      "Places on a short trip. Home connects to Bus Stop and Store. Bus Stop also connects to Library and Park. Store also connects to Park. Notice Board is on the map and has no connections, so direction keys cannot reach it. Jump to it from the node list.",
    valueMeaning: "how busy the place is, from 1 to 10",
    startNodeId: "home",
    directed: false,
    warnings: [],
    nodes: [
      { id: "home", label: "Home", value: 2, x: 18, y: 72 },
      { id: "bus-stop", label: "Bus Stop", value: 5, x: 42, y: 36 },
      { id: "store", label: "Store", value: 8, x: 78, y: 78 },
      { id: "library", label: "Library", value: 3, x: 72, y: 18 },
      { id: "park", label: "Park", value: 6, x: 88, y: 48 },
      { id: "notice", label: "Notice Board", value: 1, x: 8, y: 12 },
    ],
    edges: [
      { from: "home", to: "bus-stop" },
      { from: "home", to: "store" },
      { from: "bus-stop", to: "library" },
      { from: "bus-stop", to: "park" },
      { from: "store", to: "park" },
    ],
  },
  {
    id: "temperatures",
    title: "Week of temperatures",
    about:
      "Seven days in a single chain. Monday connects only to Tuesday, and each later day connects to the next, through Sunday. Rightward is later in the week. There is no shortcut from Monday to Friday.",
    valueMeaning: "the afternoon temperature in degrees Celsius",
    startNodeId: "mon",
    directed: false,
    warnings: [],
    nodes: [
      { id: "mon", label: "Monday", value: 12, x: 8, y: 50 },
      { id: "tue", label: "Tuesday", value: 14, x: 22, y: 50 },
      { id: "wed", label: "Wednesday", value: 19, x: 38, y: 50 },
      { id: "thu", label: "Thursday", value: 21, x: 52, y: 50 },
      { id: "fri", label: "Friday", value: 18, x: 68, y: 50 },
      { id: "sat", label: "Saturday", value: 15, x: 82, y: 50 },
      { id: "sun", label: "Sunday", value: 13, x: 94, y: 50 },
    ],
    edges: [
      { from: "mon", to: "tue" },
      { from: "tue", to: "wed" },
      { from: "wed", to: "thu" },
      { from: "thu", to: "fri" },
      { from: "fri", to: "sat" },
      { from: "sat", to: "sun" },
    ],
  },
  {
    id: "prerequisites",
    title: "Course prerequisites",
    about:
      "A directed graph. An arrow means you need the earlier course before the later one. Algebra 1 leads to Algebra 2 and Geometry. Those two both lead to Precalculus. Precalculus leads to Calculus. From Calculus there is no onward course. You can still walk back incoming links. The tool says along the arrow or against the arrow.",
    valueMeaning: "how heavy the course is, from 1 to 5",
    startNodeId: "alg1",
    directed: true,
    warnings: [],
    nodes: [
      { id: "alg1", label: "Algebra 1", value: 1, x: 12, y: 50 },
      { id: "alg2", label: "Algebra 2", value: 2, x: 40, y: 78 },
      { id: "geom", label: "Geometry", value: 2, x: 40, y: 22 },
      { id: "precalc", label: "Precalculus", value: 3, x: 68, y: 50 },
      { id: "calc", label: "Calculus", value: 5, x: 90, y: 50 },
    ],
    edges: [
      { from: "alg1", to: "alg2" },
      { from: "alg1", to: "geom" },
      { from: "alg2", to: "precalc" },
      { from: "geom", to: "precalc" },
      { from: "precalc", to: "calc" },
    ],
  },
  {
    id: "team",
    title: "Team communication",
    about:
      "Five people. Maya talks with everyone. Luis also talks with Sam. Priya also talks with Jordan. A connection means those two people message each other. The number is how many messages that person sent this week.",
    valueMeaning: "messages sent this week",
    startNodeId: "maya",
    directed: false,
    warnings: [],
    nodes: [
      { id: "maya", label: "Maya", value: 9, x: 22, y: 30 },
      { id: "luis", label: "Luis", value: 4, x: 48, y: 16 },
      { id: "sam", label: "Sam", value: 6, x: 82, y: 36 },
      { id: "priya", label: "Priya", value: 7, x: 58, y: 74 },
      { id: "jordan", label: "Jordan", value: 3, x: 18, y: 78 },
    ],
    edges: [
      { from: "maya", to: "luis" },
      { from: "maya", to: "sam" },
      { from: "maya", to: "priya" },
      { from: "maya", to: "jordan" },
      { from: "luis", to: "sam" },
      { from: "priya", to: "jordan" },
    ],
  },
];

export const graphs: GraphData[] = raw.map((graph) => normalize(graph));

export function graphById(id: string): GraphData {
  return graphs.find((graph) => graph.id === id) ?? graphs[0]!;
}
