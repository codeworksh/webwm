import { describe, expect, test } from "vite-plus/test";
import {
  applyPlacements,
  bindDragHandle,
  observeElementSize,
  type FrameScheduler,
  type ResizeObserverFactory,
} from "../src/dom/index.ts";
import type { Placement } from "../src/index.ts";

function fakeElement(): HTMLElement {
  const attributes = new Set<string>();
  return {
    hidden: false,
    style: {},
    toggleAttribute: (name: string, force: boolean) => {
      if (force) attributes.add(name);
      else attributes.delete(name);
      return force;
    },
    hasAttribute: (name: string) => attributes.has(name),
  } as unknown as HTMLElement;
}

function pointerEvent(
  type: string,
  { pointerId = 1, clientX = 0, clientY = 0 }: Partial<PointerEvent> = {},
): PointerEvent {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
    button: { value: 0 },
    isPrimary: { value: true },
  });
  return event as PointerEvent;
}

describe("bindDragHandle", () => {
  test("starts only on its handle and reports pointer movement", () => {
    const target = new EventTarget() as HTMLElement;
    const captured: number[] = [];
    const released: number[] = [];
    Object.assign(target, {
      style: {},
      setPointerCapture: (pointerId: number) => captured.push(pointerId),
      releasePointerCapture: (pointerId: number) => released.push(pointerId),
    });
    const movements: Array<{ deltaX: number; deltaY: number }> = [];

    bindDragHandle(target, {
      onDragMove: ({ deltaX, deltaY }) => movements.push({ deltaX, deltaY }),
    });

    target.dispatchEvent(pointerEvent("pointerdown", { clientX: 10, clientY: 20 }));
    target.dispatchEvent(pointerEvent("pointermove", { clientX: 35, clientY: 16 }));
    target.dispatchEvent(pointerEvent("pointerup", { clientX: 35, clientY: 16 }));

    expect(captured).toEqual([1]);
    expect(released).toEqual([1]);
    expect(movements).toEqual([{ deltaX: 25, deltaY: -4 }]);
  });

  test("reads current pin state on every pointer down", () => {
    const target = new EventTarget() as HTMLElement;
    Object.assign(target, {
      style: {},
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    });
    let pinned = true;
    let starts = 0;

    bindDragHandle(target, {
      canDrag: () => !pinned,
      onDragStart: () => starts++,
    });

    target.dispatchEvent(pointerEvent("pointerdown"));
    pinned = false;
    target.dispatchEvent(pointerEvent("pointerdown"));

    expect(starts).toBe(1);
  });
});

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

  test("marks collapsed placements and clears the mark once they open", () => {
    const editor = fakeElement();
    const terminal = fakeElement();
    const elements = new Map([
      ["editor", editor],
      ["terminal", terminal],
    ]);
    const scheduleImmediately: FrameScheduler = (callback) => {
      callback(0);
      return 1;
    };
    const editorPlacement: Placement = {
      widget: { id: "editor", tags: 0b001 },
      rect: { x: 0, y: 0, w: 600, h: 372 },
    };

    applyPlacements(
      [
        editorPlacement,
        {
          widget: { id: "terminal", tags: 0b001 },
          rect: { x: 0, y: 372, w: 600, h: 28 },
          collapsed: true,
        },
      ],
      elements,
      scheduleImmediately,
    );

    expect(editor.hasAttribute("data-collapsed")).toBe(false);
    expect(terminal.hasAttribute("data-collapsed")).toBe(true);
    expect(terminal.style.height).toBe("28px");

    applyPlacements(
      [
        editorPlacement,
        { widget: { id: "terminal", tags: 0b001 }, rect: { x: 0, y: 200, w: 600, h: 200 } },
      ],
      elements,
      scheduleImmediately,
    );

    expect(terminal.hasAttribute("data-collapsed")).toBe(false);
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
