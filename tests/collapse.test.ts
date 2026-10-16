import { describe, expect, test } from "vite-plus/test";
import {
  arrangeWithMinimums,
  focusWidget,
  placementsSatisfyMinimumSizes,
  tileInsertionTargetAtPoint,
  type ArrangeOptions,
  type Widget,
  type WidgetOrder,
} from "../src/index.ts";

// Ten session-like widgets: 280x200 minimums, the shape that overflowed a desktop stack.
const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const widgets: Widget[] = ids.map((id) => ({ id, tags: 1, minWidth: 280, minHeight: 200 }));
const bounds = { x: 0, y: 0, w: 1400, h: 900 };
const tile: ArrangeOptions = {
  activeTags: 1,
  layout: "tile",
  nmaster: 1,
  mfact: 0.5,
  collapsedHeight: 30,
};

const ordered = (focusOrder: string[] = ids): WidgetOrder => ({ tileOrder: ids, focusOrder });
const summary = (result: ReturnType<typeof arrangeWithMinimums>) =>
  result.placements.map(
    ({ widget, rect, collapsed }) =>
      `${widget.id} ${rect.x},${rect.y} ${rect.w}x${rect.h}${collapsed ? " collapsed" : ""}`,
  );

describe("collapsed stack", () => {
  test("keeps tile unchanged while every widget fits", () => {
    const few = widgets.slice(0, 4);
    const result = arrangeWithMinimums(
      few,
      { tileOrder: ids.slice(0, 4), focusOrder: ids.slice(0, 4) },
      bounds,
      tile,
    );

    expect(result.mode).toBe("preferred");
    expect(result.placements.some(({ collapsed }) => collapsed)).toBe(false);
  });

  test("collapses the least recently focused stack widgets to title bars at the bottom", () => {
    // Stack b..j is 9 widgets in 900px: 3 open (3x200 + 6x30 = 780 <= 900), 4 would need 950.
    const result = arrangeWithMinimums(
      widgets,
      ordered(["a", "f", "c", "i", "b", "d", "e", "g", "h", "j"]),
      bounds,
      tile,
    );

    expect(result.mode).toBe("preferred-collapse");
    expect(result.contentBounds).toEqual(bounds);
    expect(summary(result)).toEqual([
      "a 0,0 700x900",
      // Open in tile order at the top, sharing what the six title bars leave: 900 - 180 = 720.
      "b 700,720 700x30 collapsed",
      "c 700,0 700x240",
      "d 700,750 700x30 collapsed",
      "e 700,780 700x30 collapsed",
      "f 700,240 700x240",
      "g 700,810 700x30 collapsed",
      "h 700,840 700x30 collapsed",
      "i 700,480 700x240",
      "j 700,870 700x30 collapsed",
    ]);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });

  test("the focused widget stays open even when focus order says otherwise", () => {
    const result = arrangeWithMinimums(widgets, ordered(), bounds, {
      ...tile,
      focusedWidgetId: "j",
    });
    const open = result.placements
      .filter(({ collapsed }) => !collapsed)
      .map(({ widget }) => widget.id);

    expect(open).toEqual(["a", "b", "c", "j"]);
  });

  test("focusing a collapsed widget opens it and collapses the least recently focused open one", () => {
    const before = ordered();
    const after = focusWidget(before, "h");
    const open = (order: WidgetOrder) =>
      arrangeWithMinimums(widgets, order, bounds, tile)
        .placements.filter(({ collapsed }) => !collapsed)
        .map(({ widget }) => widget.id);

    expect(open(before)).toEqual(["a", "b", "c", "d"]);
    expect(open(after)).toEqual(["a", "b", "c", "h"]);
  });

  test("respects each open widget's own minimum height", () => {
    const tall = widgets.map((widget) =>
      widget.id === "b" ? { ...widget, minHeight: 500 } : widget,
    );
    const result = arrangeWithMinimums(tall, ordered(), bounds, tile);
    const open = result.placements.filter(({ collapsed }) => !collapsed);

    expect(result.mode).toBe("preferred-collapse");
    expect(open.map(({ widget }) => widget.id)).toEqual(["a", "b"]);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });

  test("falls back to scrolling when not even one widget can stay open", () => {
    const short = { ...bounds, h: 400 };
    const result = arrangeWithMinimums(widgets, ordered(), short, tile);

    expect(result.mode).toBe("preferred-scroll");
    expect(result.placements.some(({ collapsed }) => collapsed)).toBe(false);
  });

  test("leaves scrolling in place when collapsedHeight is not given", () => {
    const { collapsedHeight: _, ...scroll } = tile;
    const result = arrangeWithMinimums(widgets, ordered(), bounds, scroll);

    expect(result.mode).toBe("preferred-scroll");
  });

  test("ignores collapsedHeight outside tile", () => {
    const result = arrangeWithMinimums(widgets, ordered(), bounds, { ...tile, layout: "grid" });

    expect(result.placements.some(({ collapsed }) => collapsed)).toBe(false);
  });

  test("rejects a collapsedHeight that is not a positive number", () => {
    expect(() =>
      arrangeWithMinimums(widgets, ordered(), bounds, { ...tile, collapsedHeight: 0 }),
    ).toThrow("Collapsed height must be positive and finite: 0");
  });

  test("insertion targets follow what is on screen, collapsed title bars included", () => {
    const { placements } = arrangeWithMinimums(widgets, ordered(), bounds, tile);

    // Just below the open stack, over the first title bar: e's top edge, not tile order's d.
    expect(tileInsertionTargetAtPoint(placements, 900, 725, 1)).toMatchObject({
      widgetId: "e",
      edge: "before",
    });
    // Over the last open widget's upper half.
    expect(tileInsertionTargetAtPoint(placements, 900, 500, 1)).toMatchObject({
      widgetId: "d",
      edge: "before",
    });
  });
});
