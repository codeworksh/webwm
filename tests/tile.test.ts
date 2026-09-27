import { describe, expect, test } from "vite-plus/test";
import { tile, type Bounds, type Widget } from "../src/index.ts";

const bounds: Bounds = {
  x: 0,
  y: 0,
  w: 1000,
  h: 600,
};

function widgets(count: number): Widget[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `widget-${index}`,
    tags: 1,
  }));
}

describe("tile", () => {
  test("returns no rectangles when there are no widgets", () => {
    const result = tile([], bounds, {
      nmaster: 1,
      mfact: 0.6,
    });

    expect(result).toEqual([]);
  });

  test("makes one widget fill the available bounds", () => {
    const result = tile(widgets(1), bounds, {
      nmaster: 1,
      mfact: 0.6,
    });

    expect(result).toEqual([
      {
        x: 0,
        y: 0,
        w: 1000,
        h: 600,
      },
    ]);
  });

  test("creates one master and two stack rectangles", () => {
    const result = tile(widgets(3), bounds, {
      nmaster: 1,
      mfact: 0.6,
    });

    expect(result).toEqual([
      {
        x: 0,
        y: 0,
        w: 600,
        h: 600,
      },
      {
        x: 600,
        y: 0,
        w: 400,
        h: 300,
      },
      {
        x: 600,
        y: 300,
        w: 400,
        h: 300,
      },
    ]);
  });

  test("assigns remainder pixels without leaving a gap", () => {
    const result = tile(widgets(3), { x: 0, y: 0, w: 100, h: 10 }, { nmaster: 3, mfact: 0.6 });

    expect(result).toEqual([
      { x: 0, y: 0, w: 100, h: 3 },
      { x: 0, y: 3, w: 100, h: 3 },
      { x: 0, y: 6, w: 100, h: 4 },
    ]);
  });

  test("uses a full-width stack when nmaster is zero", () => {
    const result = tile(widgets(3), { x: 0, y: 0, w: 100, h: 10 }, { nmaster: 0, mfact: 0.6 });

    expect(result).toEqual([
      { x: 0, y: 0, w: 100, h: 3 },
      { x: 0, y: 3, w: 100, h: 3 },
      { x: 0, y: 6, w: 100, h: 4 },
    ]);
  });

  test("respects non-zero bounds coordinates", () => {
    const result = tile(widgets(2), { x: 10, y: 20, w: 100, h: 60 }, { nmaster: 1, mfact: 0.6 });

    expect(result).toEqual([
      { x: 10, y: 20, w: 60, h: 60 },
      { x: 70, y: 20, w: 40, h: 60 },
    ]);
  });
});
