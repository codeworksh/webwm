import { describe, expect, test } from "vite-plus/test";
import { hasMasterStack, mfactFromPointer } from "../src/index.ts";

describe("mfactFromPointer", () => {
  test("converts a horizontal point into a ratio", () => {
    expect(mfactFromPointer(610, { x: 10, y: 0, w: 1000, h: 600 })).toBe(0.6);
  });

  test("clamps to dwm's default mfact limits", () => {
    const bounds = { x: 0, y: 0, w: 1000, h: 600 };

    expect(mfactFromPointer(-100, bounds)).toBe(0.05);
    expect(mfactFromPointer(1200, bounds)).toBe(0.95);
  });

  test("accepts application-specific limits", () => {
    expect(mfactFromPointer(100, { x: 0, y: 0, w: 1000, h: 600 }, { min: 0.2, max: 0.8 })).toBe(
      0.2,
    );
  });

  test("rejects invalid geometry and limits", () => {
    expect(() => mfactFromPointer(10, { x: 0, y: 0, w: 0, h: 100 })).toThrow(
      "Bounds width must be positive and finite: 0",
    );
    expect(() =>
      mfactFromPointer(10, { x: 0, y: 0, w: 100, h: 100 }, { min: 0.8, max: 0.2 }),
    ).toThrow("Invalid mfact limits: 0.8..0.2");
  });
});

describe("hasMasterStack", () => {
  test("requires at least one master and one stack widget", () => {
    expect(hasMasterStack(3, 2)).toBe(true);
    expect(hasMasterStack(2, 2)).toBe(false);
    expect(hasMasterStack(3, 0)).toBe(false);
  });
});
