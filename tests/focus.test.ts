import { describe, expect, test } from "vite-plus/test";
import { focus, type Widget, type WidgetOrder } from "../src/index.ts";

const widgets: Widget[] = [
  { id: "editor", tags: 0b001 },
  { id: "music", tags: 0b010 },
  { id: "terminal", tags: 0b001 },
];

const order: WidgetOrder = {
  tileOrder: ["editor", "music", "terminal"],
  focusOrder: ["music", "terminal", "editor"],
};

describe("focus", () => {
  test("focuses an explicitly requested visible widget", () => {
    const result = focus(widgets, order, 0b001, "editor");

    expect(result.widget).toBe(widgets[0]);
    expect(result.order).toEqual({
      tileOrder: ["editor", "music", "terminal"],
      focusOrder: ["editor", "music", "terminal"],
    });
    expect(result.order.tileOrder).toBe(order.tileOrder);
  });

  test("falls back to the first visible widget when the requested widget is hidden", () => {
    const result = focus(widgets, order, 0b001, "music");

    expect(result.widget).toBe(widgets[2]);
    expect(result.order).toEqual({
      tileOrder: ["editor", "music", "terminal"],
      focusOrder: ["terminal", "music", "editor"],
    });
  });

  test("uses focus history when no widget is requested", () => {
    const result = focus(widgets, order, 0b001);

    expect(result.widget).toBe(widgets[2]);
    expect(result.order.focusOrder).toEqual(["terminal", "music", "editor"]);
  });

  test("returns null and preserves order when no widget is visible", () => {
    const result = focus(widgets, order, 0b100);

    expect(result).toEqual({
      widget: null,
      order,
    });
    expect(result.order).toBe(order);
  });

  test("throws when the requested widget does not exist", () => {
    expect(() => focus(widgets, order, 0b001, "missing")).toThrow("Unknown widget: missing");
  });
});
