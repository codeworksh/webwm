import { describe, expect, test } from "vite-plus/test";
import {
  arrange,
  arrangeWithMinimums,
  monocle,
  selectMonocleWidget,
  type Widget,
  type WidgetOrder,
} from "../src/index.ts";

const widgets: Widget[] = [
  { id: "editor", tags: 0b001, minWidth: 600, minHeight: 400 },
  { id: "music", tags: 0b010 },
  { id: "calendar", tags: 0b011 },
];
const order: WidgetOrder = {
  tileOrder: ["editor", "music", "calendar"],
  focusOrder: ["calendar", "music", "editor"],
};

describe("monocle", () => {
  test("returns full bounds for one selected widget", () => {
    expect(monocle([widgets[0]], { x: 10, y: 20, w: 800, h: 600 })).toEqual([
      { x: 10, y: 20, w: 800, h: 600 },
    ]);
  });

  test("refuses overlapping multi-widget output", () => {
    expect(() => monocle(widgets, { x: 0, y: 0, w: 800, h: 600 })).toThrow(
      "Monocle expects at most one selected widget: 3",
    );
  });
});

describe("selectMonocleWidget", () => {
  test("prefers the requested visible widget", () => {
    expect(selectMonocleWidget(widgets, order.focusOrder, "editor")).toEqual([widgets[0]]);
  });

  test("falls back to the first visible widget in focus order", () => {
    expect(selectMonocleWidget([widgets[0], widgets[2]], order.focusOrder, "music")).toEqual([
      widgets[2],
    ]);
  });
});

describe("monocle arrangement", () => {
  test("returns only the focused visible widget without overlap", () => {
    expect(
      arrange(
        widgets,
        order,
        { x: 0, y: 0, w: 800, h: 600 },
        {
          activeTags: 0b001,
          layout: "monocle",
          focusedWidgetId: "editor",
          nmaster: 1,
          mfact: 0.6,
        },
      ),
    ).toEqual([{ widget: widgets[0], rect: { x: 0, y: 0, w: 800, h: 600 } }]);
  });

  test("grows a scrollable monocle surface for the selected widget minimum", () => {
    const result = arrangeWithMinimums(
      widgets,
      order,
      { x: 0, y: 0, w: 500, h: 300 },
      {
        activeTags: 0b001,
        layout: "monocle",
        focusedWidgetId: "editor",
        nmaster: 1,
        mfact: 0.6,
      },
    );

    expect(result.mode).toBe("preferred-scroll");
    expect(result.contentBounds).toEqual({ x: 0, y: 0, w: 600, h: 400 });
    expect(result.placements).toEqual([
      { widget: widgets[0], rect: { x: 0, y: 0, w: 600, h: 400 } },
    ]);
  });
});
