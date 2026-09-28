import { describe, expect, test } from "vite-plus/test";
import {
  closestPlacementIndex,
  moveWidget,
  moveWidgetRelative,
  tileInsertionTargetAtPoint,
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

describe("moveWidgetRelative", () => {
  test("inserts before or after another widget", () => {
    expect(moveWidgetRelative(order, "music", "editor", "before").tileOrder).toEqual([
      "music",
      "editor",
      "terminal",
    ]);
    expect(moveWidgetRelative(order, "editor", "terminal", "after").tileOrder).toEqual([
      "terminal",
      "editor",
      "music",
    ]);
  });

  test("keeps focus order and treats self-targeting as a no-op", () => {
    const result = moveWidgetRelative(order, "music", "editor", "before");
    expect(result.focusOrder).toBe(order.focusOrder);
    expect(moveWidgetRelative(order, "editor", "editor", "after")).toBe(order);
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

describe("tileInsertionTargetAtPoint", () => {
  const placements: Placement[] = [
    { widget: { id: "master-1", tags: 1 }, rect: { x: 0, y: 0, w: 600, h: 300 } },
    { widget: { id: "master-2", tags: 1 }, rect: { x: 0, y: 300, w: 600, h: 300 } },
    { widget: { id: "stack-1", tags: 1 }, rect: { x: 600, y: 0, w: 400, h: 300 } },
    { widget: { id: "stack-2", tags: 1 }, rect: { x: 600, y: 300, w: 400, h: 300 } },
  ];

  test("selects before and after edges within the pointed column", () => {
    expect(tileInsertionTargetAtPoint(placements, 800, 80, 2)).toEqual({
      widgetId: "stack-1",
      edge: "before",
      indicator: { x: 600, y: 0, w: 400, h: 0 },
    });
    expect(tileInsertionTargetAtPoint(placements, 200, 560, 2)).toEqual({
      widgetId: "master-2",
      edge: "after",
      indicator: { x: 0, y: 600, w: 600, h: 0 },
    });
  });

  test("handles a full-width stack and an empty layout", () => {
    expect(tileInsertionTargetAtPoint(placements, 200, 320, 0)?.widgetId).toBe("master-2");
    expect(tileInsertionTargetAtPoint([], 0, 0, 1)).toBeNull();
  });
});
