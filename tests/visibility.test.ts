import { describe, expect, test } from "vite-plus/test";
import { isVisible, type Widget } from "../src/index.ts";

describe("isVisible", () => {
  test("is visible when the widget and active view share a tag", () => {
    const widget: Widget = {
      id: "editor",
      tags: 0b001,
    };

    expect(isVisible(widget, 0b001)).toBe(true);
  });

  test("is hidden when no tags are shared", () => {
    const widget: Widget = {
      id: "editor",
      tags: 0b001,
    };

    expect(isVisible(widget, 0b010)).toBe(false);
  });

  test("supports widgets with multiple tags", () => {
    const widget: Widget = {
      id: "editor",
      tags: 0b101,
    };

    expect(isVisible(widget, 0b100)).toBe(true);
    expect(isVisible(widget, 0b010)).toBe(false);
  });

  test("is hidden when no tags are active", () => {
    const widget: Widget = {
      id: "editor",
      tags: 0b001,
    };

    expect(isVisible(widget, 0)).toBe(false);
  });
});
