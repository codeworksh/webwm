import { describe, expect, test } from "vite-plus/test";
import { allTagsMask, tagBit } from "../src/index.ts";

describe("tagBit", () => {
  test("creates one bit at the requested index", () => {
    expect(tagBit(0)).toBe(0b001);
    expect(tagBit(1)).toBe(0b010);
    expect(tagBit(2)).toBe(0b100);
  });

  test("supports the highest safe index", () => {
    expect(tagBit(30)).toBe(1_073_741_824);
  });

  test("rejects a fractional index", () => {
    expect(() => tagBit(1.5)).toThrow("Tag index must be an integer: 1.5");
  });

  test("rejects an index below zero", () => {
    expect(() => tagBit(-1)).toThrow("Tag index must be between 0 and 30: -1");
  });

  test("rejects an index above 30", () => {
    expect(() => tagBit(31)).toThrow("Tag index must be between 0 and 30: 31");
  });
});

describe("allTagsMask", () => {
  test("enables every bit in the configured range", () => {
    expect(allTagsMask(1)).toBe(0b001);
    expect(allTagsMask(2)).toBe(0b011);
    expect(allTagsMask(3)).toBe(0b111);
  });

  test("supports all 31 positive tag bits", () => {
    expect(allTagsMask(31)).toBe(2_147_483_647);
  });

  test("rejects a fractional count", () => {
    expect(() => allTagsMask(2.5)).toThrow("Tag count must be an integer: 2.5");
  });

  test("requires at least one tag", () => {
    expect(() => allTagsMask(0)).toThrow("Tag count must be between 1 and 31: 0");
  });

  test("rejects more than 31 tags", () => {
    expect(() => allTagsMask(32)).toThrow("Tag count must be between 1 and 31: 32");
  });
});
