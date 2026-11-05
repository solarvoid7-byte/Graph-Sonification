import { describe, expect, it } from "vitest";
import {
  connectionCountPhrase,
  linkInDirection,
  linksFrom,
  normalize,
  playbackPlan,
  stepLink,
} from "./graph";
import { connectionOptionLabel, travelMessage } from "./labels";
import { graphById } from "./samples";
import type { GraphData } from "./types";

const neighborhood = graphById("neighborhood");
const temperatures = graphById("temperatures");
const courses = graphById("prerequisites");

describe("connections", () => {
  it("lists neighborhood links in name order and keeps Notice Board isolated", () => {
    expect(linksFrom(neighborhood, "home").map((link) => link.node.label)).toEqual(["Bus Stop", "Store"]);
    expect(linksFrom(neighborhood, "notice")).toEqual([]);
    expect(connectionCountPhrase(neighborhood, "notice")).toBe("no connections");
  });

  it("walks forward from the arrival node instead of bouncing backward", () => {
    const first = stepLink(neighborhood, "home", null, 1);
    expect(first.link?.node.id).toBe("bus-stop");
    const second = stepLink(neighborhood, "bus-stop", "home", 1);
    expect(second.link?.node.label).toBe("Library");
    const around = stepLink(neighborhood, "home", "store", 1);
    expect(around.wrapped).toBe(true);
    expect(around.link?.node.label).toBe("Bus Stop");
  });

  it("uses layout for direction and refuses an empty direction", () => {
    expect(linkInDirection(neighborhood, "home", "right").link?.node.id).toBe("store");
    expect(linkInDirection(neighborhood, "home", "up").link?.node.id).toBe("bus-stop");
    expect(linkInDirection(neighborhood, "home", "left").link).toBeNull();
    expect(linkInDirection(neighborhood, "notice", "right").link).toBeNull();
  });

  it("describes directed courses as onward or incoming", () => {
    expect(linksFrom(courses, "alg1").map((link) => `${link.node.label}:${link.sense}`)).toEqual([
      "Algebra 2:along",
      "Geometry:along",
    ]);
    expect(linksFrom(courses, "calc").map((link) => `${link.node.label}:${link.sense}`)).toEqual([
      "Precalculus:against",
    ]);
    expect(connectionCountPhrase(courses, "calc")).toBe("1 incoming");
  });
});

describe("playback order", () => {
  it("plays a chain from the first day through the last", () => {
    const plan = playbackPlan(temperatures);
    expect(plan.ids).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(plan.description).toMatch(/chain/i);
  });

  it("plays prerequisites in an order that respects arrows", () => {
    expect(playbackPlan(courses).ids).toEqual(["alg1", "alg2", "geom", "precalc", "calc"]);
  });

  it("mentions a node that cannot be reached", () => {
    const plan = playbackPlan(neighborhood);
    expect(plan.ids.at(-1)).toBe("notice");
    expect(plan.description).toMatch(/Notice Board/);
  });

  it("does not loop forever on a directed cycle", () => {
    const cyclic: GraphData = normalize({
      id: "loop",
      title: "Loop",
      about: "A cycle.",
      valueMeaning: "weight",
      startNodeId: "a",
      directed: true,
      warnings: [],
      nodes: [
        { id: "a", label: "A", value: 1, x: 10, y: 50 },
        { id: "b", label: "B", value: 2, x: 50, y: 50 },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    });
    expect(playbackPlan(cyclic).ids).toEqual(["a", "b"]);
  });
});

describe("spoken comparisons", () => {
  it("says an equal value is the same as the other place", () => {
    const courses = graphById("prerequisites");
    const algebra2 = courses.nodes.find((node) => node.id === "alg2");
    const geometry = courses.nodes.find((node) => node.id === "geom");
    if (!algebra2 || !geometry) throw new Error("missing course");
    const link = { node: geometry, sense: "along" as const };
    expect(connectionOptionLabel(link, algebra2, courses, "standard")).toBe(
      "Geometry, value 2, the same value as Algebra 2. Along the arrow.",
    );
    expect(
      travelMessage({
        graph: courses,
        from: algebra2,
        link,
        verbosity: "terse",
        wrapped: false,
        onlyOne: false,
      }),
    ).toContain("the same as Algebra 2");
    expect(
      travelMessage({
        graph: courses,
        from: algebra2,
        link,
        verbosity: "terse",
        wrapped: false,
        onlyOne: false,
      }),
    ).not.toContain("same than");
  });
});

describe("normalize", () => {
  it("drops self-loops, duplicate edges, and missing endpoints", () => {
    const graph = normalize({
      id: "messy",
      title: "Messy",
      about: "Broken data.",
      valueMeaning: "n",
      startNodeId: "missing",
      directed: false,
      warnings: [],
      nodes: [
        { id: "a", label: "A", value: Number.NaN, x: -10, y: 200 },
        { id: "a", label: "A again", value: 1, x: 0, y: 0 },
        { id: "b", label: " ", value: 2, x: 10, y: 10 },
      ],
      edges: [
        { from: "a", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "a" },
        { from: "a", to: "nope" },
      ],
    });
    expect(graph.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(graph.nodes[0]?.value).toBe(0);
    expect(graph.nodes[0]?.x).toBe(0);
    expect(graph.nodes[0]?.y).toBe(100);
    expect(graph.edges).toEqual([{ from: "a", to: "b" }]);
    expect(graph.startNodeId).toBe("a");
    expect(graph.warnings.length).toBeGreaterThan(0);
    expect(graph.nodes[1]?.label).toBe("b");
  });
});
