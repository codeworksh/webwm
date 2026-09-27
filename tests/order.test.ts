import { describe, expect, test } from "vite-plus/test";
import { attachWidget, detachWidget, focusWidget, type WidgetOrder } from "../src/index.ts";

const order: WidgetOrder = {
  tileOrder: ["editor", "terminal", "browser"],
  focusOrder: ["browser", "editor", "terminal"],
};

describe("WidgetOrder", () => {
  test("attachWidget adds a widget to both orders", () => {
    expect(attachWidget(order, "calendar")).toEqual({
      tileOrder: ["calendar", "editor", "terminal", "browser"],
      focusOrder: ["calendar", "browser", "editor", "terminal"],
    });
  });

  test("detachWidget removes a widget from both orders", () => {
    expect(detachWidget(order, "terminal")).toEqual({
      tileOrder: ["editor", "browser"],
      focusOrder: ["browser", "editor"],
    });
  });

  test("focusWidget changes only focus order", () => {
    const result = focusWidget(order, "terminal");

    expect(result).toEqual({
      tileOrder: ["editor", "terminal", "browser"],
      focusOrder: ["terminal", "browser", "editor"],
    });

    expect(result.tileOrder).toBe(order.tileOrder);
  });
});
