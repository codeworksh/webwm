import { describe, expect, test } from "vite-plus/test";
import {
  closestPlacementIndex,
  moveWidget,
  type Placement,
  type WidgetOrder,
} from "../src/index.ts";

const order: WidgetOrder = {
  tileOrder: ["editor", "terminal", "music"],
  focusOrder: ["music", "terminal", "editor"],
};

describe("moveWidget", () => {
  test("moves an id inside tile order without changing focus order", () => {
    const result = moveWidget(order, "editor", 2);

    expect(result.tileOrder).toEqual(["terminal", "music", "editor"]);
    expect(result.focusOrder).toBe(order.focusOrder);
  });

  test("returns the same order when the position does not change", () => {
    expect(moveWidget(order, "terminal", 1)).toBe(order);
  });

  test("rejects unknown widgets and invalid indexes", () => {
    expect(() => moveWidget(order, "missing", 1)).toThrow('Widget "missing" is not in tile order');
    expect(() => moveWidget(order, "editor", 3)).toThrow("Tile-order index is out of range: 3");
  });
});

describe("closestPlacementIndex", () => {
  const placements: Placement[] = [
    { widget: { id: "master", tags: 1 }, rect: { x: 0, y: 0, w: 600, h: 600 } },
    { widget: { id: "top", tags: 1 }, rect: { x: 600, y: 0, w: 400, h: 300 } },
    { widget: { id: "bottom", tags: 1 }, rect: { x: 600, y: 300, w: 400, h: 300 } },
  ];

  test("selects the rectangle center nearest to the point", () => {
    expect(closestPlacementIndex(placements, 820, 470)).toBe(2);
    expect(closestPlacementIndex(placements, 780, 120)).toBe(1);
    expect(closestPlacementIndex(placements, 200, 300)).toBe(0);
  });

  test("returns null for an empty layout", () => {
    expect(closestPlacementIndex([], 10, 10)).toBeNull();
  });
});
