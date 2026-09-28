import { describe, expect, test } from "vite-plus/test";
import {
  arrangeWithMinimums,
  placementsSatisfyMinimumSizes,
  type Placement,
  type Widget,
  type WidgetOrder,
} from "../src/index.ts";

const widgets: Widget[] = [
  { id: "editor", tags: 1, minWidth: 400, minHeight: 240 },
  { id: "terminal", tags: 1, minWidth: 280, minHeight: 160 },
  { id: "music", tags: 2, minWidth: 200, minHeight: 120 },
];

const order: WidgetOrder = {
  tileOrder: ["editor", "terminal", "music"],
  focusOrder: ["editor", "terminal", "music"],
};

describe("placementsSatisfyMinimumSizes", () => {
  test("accepts placements at or above every widget minimum", () => {
    const placements: Placement[] = [
      { widget: widgets[0], rect: { x: 0, y: 0, w: 400, h: 240 } },
      { widget: widgets[1], rect: { x: 400, y: 0, w: 300, h: 240 } },
    ];

    expect(placementsSatisfyMinimumSizes(placements)).toBe(true);
  });

  test("rejects a placement below either minimum", () => {
    expect(
      placementsSatisfyMinimumSizes([{ widget: widgets[0], rect: { x: 0, y: 0, w: 399, h: 240 } }]),
    ).toBe(false);
  });

  test("defaults omitted minimums to one pixel", () => {
    expect(
      placementsSatisfyMinimumSizes([
        { widget: { id: "plain", tags: 1 }, rect: { x: 0, y: 0, w: 1, h: 1 } },
      ]),
    ).toBe(true);
  });

  test("throws for invalid widget constraints", () => {
    expect(() =>
      placementsSatisfyMinimumSizes([
        {
          widget: { id: "broken", tags: 1, minWidth: 0 },
          rect: { x: 0, y: 0, w: 100, h: 100 },
        },
      ]),
    ).toThrow('Invalid minWidth for widget "broken": 0');
  });
});

describe("arrangeWithMinimums", () => {
  test("keeps the preferred layout when all minimums fit", () => {
    const result = arrangeWithMinimums(
      widgets,
      order,
      { x: 0, y: 0, w: 1000, h: 600 },
      { activeTags: 1, layout: "tile", nmaster: 1, mfact: 0.6 },
    );

    expect(result.mode).toBe("preferred");
    expect(result.contentBounds).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
    expect(result.placements.map(({ rect }) => rect)).toEqual([
      { x: 0, y: 0, w: 600, h: 600 },
      { x: 600, y: 0, w: 400, h: 600 },
    ]);
  });

  test("falls back to a non-overlapping scrollable vertical stack", () => {
    const result = arrangeWithMinimums(
      widgets,
      order,
      { x: 0, y: 0, w: 500, h: 300 },
      { activeTags: 1, layout: "tile", nmaster: 1, mfact: 0.6 },
    );

    expect(result.mode).toBe("stack");
    expect(result.contentBounds).toEqual({ x: 0, y: 0, w: 500, h: 480 });
    expect(result.placements.map(({ rect }) => rect)).toEqual([
      { x: 0, y: 0, w: 500, h: 240 },
      { x: 0, y: 240, w: 500, h: 240 },
    ]);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });

  test("uses minimum width as the horizontal scroll extent", () => {
    const result = arrangeWithMinimums(
      widgets,
      order,
      { x: 0, y: 0, w: 320, h: 600 },
      { activeTags: 1, layout: "tile", nmaster: 0, mfact: 0.6 },
    );

    expect(result.mode).toBe("stack");
    expect(result.contentBounds.w).toBe(400);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });

  test("keeps master-stack and grows scroll height when only height is short", () => {
    const heightConstrainedWidgets: Widget[] = [
      { id: "master-1", tags: 1, minWidth: 300, minHeight: 200 },
      { id: "master-2", tags: 1, minWidth: 300, minHeight: 180 },
      { id: "stack-1", tags: 1, minWidth: 250, minHeight: 180 },
      { id: "stack-2", tags: 1, minWidth: 250, minHeight: 160 },
      { id: "stack-3", tags: 1, minWidth: 250, minHeight: 140 },
    ];
    const heightConstrainedOrder: WidgetOrder = {
      tileOrder: heightConstrainedWidgets.map(({ id }) => id),
      focusOrder: heightConstrainedWidgets.map(({ id }) => id),
    };
    const result = arrangeWithMinimums(
      heightConstrainedWidgets,
      heightConstrainedOrder,
      { x: 0, y: 0, w: 1000, h: 420 },
      { activeTags: 1, layout: "tile", nmaster: 2, mfact: 0.6 },
    );

    expect(result.mode).toBe("preferred-scroll");
    expect(result.contentBounds.h).toBe(540);
    expect(result.placements.map(({ rect }) => rect.x)).toEqual([0, 0, 600, 600, 600]);
    expect(placementsSatisfyMinimumSizes(result.placements)).toBe(true);
  });

  test("only accounts for widgets visible on active tags", () => {
    const result = arrangeWithMinimums(
      widgets,
      order,
      { x: 0, y: 0, w: 500, h: 500 },
      { activeTags: 2, layout: "tile", nmaster: 1, mfact: 0.6 },
    );

    expect(result.mode).toBe("preferred");
    expect(result.placements.map(({ widget }) => widget.id)).toEqual(["music"]);
  });
});
