import { describe, expect, test } from "vite-plus/test";
import {
  arrangeWithMinimums,
  grid,
  gridInsertionTargetAtPoint,
  placementsSatisfyMinimumSizes,
  type Bounds,
  type Placement,
  type Widget,
} from "../src/index.ts";

function widgets(count: number): Widget[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `widget-${index}`,
    tags: 1,
  }));
}

const bounds: Bounds = { x: 0, y: 0, w: 900, h: 600 };

describe("grid", () => {
  test("returns no rectangles for no widgets", () => {
    expect(grid([], bounds)).toEqual([]);
  });

  test("makes one widget fill the bounds", () => {
    expect(grid(widgets(1), bounds)).toEqual([{ x: 0, y: 0, w: 900, h: 600 }]);
  });

  test("creates a gapless grid and stretches an incomplete final row", () => {
    expect(grid(widgets(5), bounds)).toEqual([
      { x: 0, y: 0, w: 300, h: 300 },
      { x: 300, y: 0, w: 300, h: 300 },
      { x: 600, y: 0, w: 300, h: 300 },
      { x: 0, y: 300, w: 450, h: 300 },
      { x: 450, y: 300, w: 450, h: 300 },
    ]);
  });

  test("recomputes remaining space so remainder pixels reach the edges", () => {
    expect(grid(widgets(5), { x: 0, y: 0, w: 10, h: 7 })).toEqual([
      { x: 0, y: 0, w: 3, h: 3 },
      { x: 3, y: 0, w: 3, h: 3 },
      { x: 6, y: 0, w: 4, h: 3 },
      { x: 0, y: 3, w: 5, h: 4 },
      { x: 5, y: 3, w: 5, h: 4 },
    ]);
  });

  test("respects non-zero bounds coordinates", () => {
    expect(grid(widgets(2), { x: 10, y: 20, w: 100, h: 60 })).toEqual([
      { x: 10, y: 20, w: 50, h: 60 },
      { x: 60, y: 20, w: 50, h: 60 },
    ]);
  });

  test("grows a scrollable grid instead of changing the selected layout", () => {
    const constrained = [
      { id: "a", tags: 1, minWidth: 240, minHeight: 180 },
      { id: "b", tags: 1, minWidth: 200, minHeight: 160 },
      { id: "c", tags: 1, minWidth: 220, minHeight: 200 },
      { id: "d", tags: 1, minWidth: 180, minHeight: 140 },
      { id: "e", tags: 1, minWidth: 200, minHeight: 160 },
    ];
    const ids = constrained.map(({ id }) => id);
    const result = arrangeWithMinimums(
      constrained,
      { tileOrder: ids, focusOrder: ids },
      { x: 0, y: 0, w: 500, h: 300 },
      { activeTags: 1, layout: "grid", nmaster: 1, mfact: 0.6 },
    );

    expect(result.mode).toBe("preferred-scroll");
    expect(result.contentBounds).toEqual({ x: 0, y: 0, w: 720, h: 400 });
    expect(result.placements.map(({ rect }) => rect.x)).toEqual([0, 240, 480, 0, 360]);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });
});

describe("gridInsertionTargetAtPoint", () => {
  const gridWidgets = widgets(5);
  const placements: Placement[] = grid(gridWidgets, bounds).map((rect, index) => ({
    widget: gridWidgets[index],
    rect,
  }));

  test("selects left and right cell edges in the nearest row", () => {
    expect(gridInsertionTargetAtPoint(placements, 50, 450)).toEqual({
      widgetId: "widget-3",
      edge: "before",
      indicator: { x: 0, y: 300, w: 0, h: 300 },
    });
    expect(gridInsertionTargetAtPoint(placements, 850, 450)).toEqual({
      widgetId: "widget-4",
      edge: "after",
      indicator: { x: 900, y: 300, w: 0, h: 300 },
    });
  });
});
