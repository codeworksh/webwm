import { describe, expect, test } from "vite-plus/test";
import {
  arrange,
  type Bounds,
  type LayoutTable,
  type Widget,
} from "../src/index.ts";

const bounds: Bounds = {
  x: 0,
  y: 0,
  w: 100,
  h: 100,
};

const widgets: Widget[] = [
  {
    id: "editor",
    tags: 0b001,
  },
  {
    id: "music",
    tags: 0b010,
  },
  {
    id: "calendar",
    tags: 0b011,
  },
];

describe("arrange", () => {
  test("arranges only widgets visible on the active tags", () => {
    const placements = arrange(widgets, bounds, {
      activeTags: 0b001,
      layout: "tile",
      nmaster: 1,
      mfact: 0.6,
    });

    expect(placements).toEqual([
      {
        widget: widgets[0],
        rect: {
          x: 0,
          y: 0,
          w: 60,
          h: 100,
        },
      },
      {
        widget: widgets[2],
        rect: {
          x: 60,
          y: 0,
          w: 40,
          h: 100,
        },
      },
    ]);
  });

  test("returns no placements when no widgets are visible", () => {
    const placements = arrange(widgets, bounds, {
      activeTags: 0b100,
      layout: "tile",
      nmaster: 1,
      mfact: 0.6,
    });

    expect(placements).toEqual([]);
  });

  test("throws when the selected layout does not exist", () => {
    expect(() =>
      arrange(widgets, bounds, {
        activeTags: 0b001,
        layout: "missing",
        nmaster: 1,
        mfact: 0.6,
      }),
    ).toThrow("Unknown layout: missing");
  });

  test("can use an injected layout table", () => {
    const customLayouts: LayoutTable = {
      full: (_widgets, customBounds) => [
        {
          x: customBounds.x,
          y: customBounds.y,
          w: customBounds.w,
          h: customBounds.h,
        },
      ],
    };

    const placements = arrange(
      [widgets[0]],
      bounds,
      {
        activeTags: 0b001,
        layout: "full",
        nmaster: 1,
        mfact: 0.6,
      },
      customLayouts,
    );

    expect(placements).toEqual([
      {
        widget: widgets[0],
        rect: bounds,
      },
    ]);
  });

  test("rejects a layout that returns the wrong rectangle count", () => {
    const brokenLayouts: LayoutTable = {
      broken: () => [],
    };

    expect(() =>
      arrange(
        [widgets[0]],
        bounds,
        {
          activeTags: 0b001,
          layout: "broken",
          nmaster: 1,
          mfact: 0.6,
        },
        brokenLayouts,
      ),
    ).toThrow(
      'Layout "broken" returned 0 rectangles for 1 widgets',
    );
  });
});
