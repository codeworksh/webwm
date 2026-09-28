import { describe, expect, test } from "vite-plus/test";
import {
  allTagsMask,
  setWidgetTags,
  tagBit,
  toggleWidgetTags,
  toggleViewedTags,
  validateTagMask,
  viewTags,
  type Widget,
} from "../src/index.ts";

const allowedTags = allTagsMask(3);

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

describe("validateTagMask", () => {
  test("returns a valid mask unchanged", () => {
    expect(validateTagMask(0b101, allowedTags)).toBe(0b101);
  });

  test("rejects an empty mask", () => {
    expect(() => validateTagMask(0, allowedTags)).toThrow(
      "Tag mask must contain at least one tag: 0",
    );
  });

  test("rejects a non-safe integer", () => {
    expect(() => validateTagMask(Number.MAX_SAFE_INTEGER + 1, allowedTags)).toThrow(
      `Tag mask must be a safe integer: ${Number.MAX_SAFE_INTEGER + 1}`,
    );
  });

  test("rejects a mask outside the positive 31-bit range", () => {
    expect(() => validateTagMask(-1, allowedTags)).toThrow(
      "Tag mask must be between 1 and 2147483647: -1",
    );
    expect(() => validateTagMask(2 ** 32 + 1, allowedTags)).toThrow(
      "Tag mask must be between 1 and 2147483647: 4294967297",
    );
  });

  test("rejects bits outside the allowed mask", () => {
    expect(() => validateTagMask(0b1000, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
  });
});

describe("setWidgetTags", () => {
  const widget: Widget = {
    id: "editor",
    tags: 0b001,
  };

  test("returns a new widget with replaced memberships", () => {
    const result = setWidgetTags(widget, 0b110, allowedTags);

    expect(result).toEqual({
      id: "editor",
      tags: 0b110,
    });
    expect(result).not.toBe(widget);
    expect(widget.tags).toBe(0b001);
  });

  test("returns the original widget when membership is unchanged", () => {
    expect(setWidgetTags(widget, 0b001, allowedTags)).toBe(widget);
  });

  test("validates the requested membership", () => {
    expect(() => setWidgetTags(widget, 0b1000, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
  });
});

describe("toggleWidgetTags", () => {
  test("adds memberships that are currently absent", () => {
    const widget: Widget = { id: "editor", tags: 0b001 };

    expect(toggleWidgetTags(widget, 0b100, allowedTags)).toEqual({
      id: "editor",
      tags: 0b101,
    });
  });

  test("removes memberships that are currently present", () => {
    const widget: Widget = { id: "editor", tags: 0b101 };

    expect(toggleWidgetTags(widget, 0b100, allowedTags)).toEqual({
      id: "editor",
      tags: 0b001,
    });
  });

  test("returns the original widget rather than removing its final tag", () => {
    const widget: Widget = { id: "editor", tags: 0b001 };

    expect(toggleWidgetTags(widget, 0b001, allowedTags)).toBe(widget);
  });

  test("validates the requested toggle mask", () => {
    const widget: Widget = { id: "editor", tags: 0b001 };

    expect(() => toggleWidgetTags(widget, 0b1000, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
  });
});

describe("viewTags", () => {
  test("replaces the active view with a validated mask", () => {
    expect(viewTags(0b110, allowedTags)).toBe(0b110);
  });

  test("rejects an invalid active view", () => {
    expect(() => viewTags(0b1000, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
  });
});

describe("toggleViewedTags", () => {
  test("adds a tag that is not currently viewed", () => {
    expect(toggleViewedTags(0b001, 0b010, allowedTags)).toBe(0b011);
  });

  test("removes a tag that is currently viewed", () => {
    expect(toggleViewedTags(0b011, 0b010, allowedTags)).toBe(0b001);
  });

  test("preserves the current view rather than disabling its final tag", () => {
    expect(toggleViewedTags(0b001, 0b001, allowedTags)).toBe(0b001);
  });

  test("validates the current and requested masks", () => {
    expect(() => toggleViewedTags(0b1000, 0b001, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
    expect(() => toggleViewedTags(0b001, 0b1000, allowedTags)).toThrow(
      "Tag mask contains tags outside the allowed mask: 8",
    );
  });
});
