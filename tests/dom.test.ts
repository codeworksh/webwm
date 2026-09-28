import { describe, expect, test } from "vite-plus/test";
import {
  applyPlacements,
  observeElementSize,
  type FrameScheduler,
  type ResizeObserverFactory,
} from "../src/dom/index.ts";
import type { Placement } from "../src/index.ts";

function fakeElement(): HTMLElement {
  return {
    hidden: false,
    style: {},
  } as unknown as HTMLElement;
}

describe("applyPlacements", () => {
  test("batches placement styles into one scheduled frame", () => {
    const editor = fakeElement();
    const terminal = fakeElement();
    const elements = new Map([
      ["editor", editor],
      ["terminal", terminal],
    ]);
    const placements: Placement[] = [
      {
        widget: { id: "editor", tags: 0b001 },
        rect: { x: 10, y: 20, w: 600, h: 400 },
      },
      {
        widget: { id: "terminal", tags: 0b001 },
        rect: { x: 610, y: 20, w: 390, h: 400 },
      },
    ];
    let scheduledCallback: FrameRequestCallback | undefined;
    const scheduleFrame: FrameScheduler = (callback) => {
      scheduledCallback = callback;
      return 42;
    };

    const frameId = applyPlacements(placements, elements, scheduleFrame);

    expect(frameId).toBe(42);
    expect(editor.style.transform).toBeUndefined();
    expect(scheduledCallback).toBeDefined();

    scheduledCallback?.(0);

    expect(editor.hidden).toBe(false);
    expect(editor.style.position).toBe("absolute");
    expect(editor.style.boxSizing).toBe("border-box");
    expect(editor.style.transform).toBe("translate(10px, 20px)");
    expect(editor.style.width).toBe("600px");
    expect(editor.style.height).toBe("400px");
    expect(terminal.style.transform).toBe("translate(610px, 20px)");
  });

  test("hides mapped widgets that have no placement", () => {
    const editor = fakeElement();
    const music = fakeElement();
    const elements = new Map([
      ["editor", editor],
      ["music", music],
    ]);
    const scheduleImmediately: FrameScheduler = (callback) => {
      callback(0);
      return 1;
    };

    applyPlacements(
      [
        {
          widget: { id: "editor", tags: 0b001 },
          rect: { x: 0, y: 0, w: 100, h: 100 },
        },
      ],
      elements,
      scheduleImmediately,
    );

    expect(editor.hidden).toBe(false);
    expect(music.hidden).toBe(true);
  });

  test("throws before scheduling when a placement has no mapped element", () => {
    let scheduled = false;
    const scheduleFrame: FrameScheduler = () => {
      scheduled = true;
      return 1;
    };

    expect(() =>
      applyPlacements(
        [
          {
            widget: { id: "missing", tags: 0b001 },
            rect: { x: 0, y: 0, w: 100, h: 100 },
          },
        ],
        new Map(),
        scheduleFrame,
      ),
    ).toThrow("Missing element for widget: missing");
    expect(scheduled).toBe(false);
  });
});

describe("observeElementSize", () => {
  test("coalesces repeated observations and reports the latest size", () => {
    const element = fakeElement();
    let observerCallback: ResizeObserverCallback | undefined;
    let observedElement: Element | undefined;
    let scheduledCallback: FrameRequestCallback | undefined;
    const sizes: Array<{ width: number; height: number }> = [];
    const createObserver: ResizeObserverFactory = (callback) => {
      observerCallback = callback;
      return {
        observe(target) {
          observedElement = target;
        },
        disconnect() {},
      };
    };
    const scheduleFrame: FrameScheduler = (callback) => {
      scheduledCallback = callback;
      return 7;
    };

    observeElementSize(element, (size) => sizes.push(size), { createObserver, scheduleFrame });

    expect(observedElement).toBe(element);

    observerCallback?.(
      [
        {
          target: element,
          contentRect: { width: 800.9, height: 600.7 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    observerCallback?.(
      [
        {
          target: element,
          contentRect: { width: 620.4, height: 480.9 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );

    expect(sizes).toEqual([]);
    scheduledCallback?.(0);
    expect(sizes).toEqual([{ width: 620, height: 480 }]);
  });

  test("disconnects and cancels a pending frame during cleanup", () => {
    const element = fakeElement();
    let observerCallback: ResizeObserverCallback | undefined;
    let disconnected = false;
    let canceledFrameId: number | undefined;
    const createObserver: ResizeObserverFactory = (callback) => {
      observerCallback = callback;
      return {
        observe() {},
        disconnect() {
          disconnected = true;
        },
      };
    };

    const cleanup = observeElementSize(element, () => {}, {
      createObserver,
      scheduleFrame: () => 9,
      cancelFrame: (frameId) => {
        canceledFrameId = frameId;
      },
    });

    observerCallback?.(
      [
        {
          target: element,
          contentRect: { width: 500, height: 300 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    cleanup();

    expect(disconnected).toBe(true);
    expect(canceledFrameId).toBe(9);
  });
});
