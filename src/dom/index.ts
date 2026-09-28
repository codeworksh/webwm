import type { Placement, WidgetId } from "../lib/index.ts";

export type WidgetElements = ReadonlyMap<WidgetId, HTMLElement>;

export type FrameScheduler = (callback: FrameRequestCallback) => number;
export type FrameCanceler = (frameId: number) => void;

export interface ObservedSize {
  readonly width: number;
  readonly height: number;
}

export type SizeChangeHandler = (size: ObservedSize) => void;

export interface ResizeObservation {
  observe(target: Element): void;
  disconnect(): void;
}

export type ResizeObserverFactory = (callback: ResizeObserverCallback) => ResizeObservation;

export interface ElementSizeObserverOptions {
  readonly scheduleFrame?: FrameScheduler;
  readonly cancelFrame?: FrameCanceler;
  readonly createObserver?: ResizeObserverFactory;
}

const scheduleAnimationFrame: FrameScheduler = (callback) => requestAnimationFrame(callback);
const cancelScheduledAnimationFrame: FrameCanceler = (frameId) => cancelAnimationFrame(frameId);
const createNativeResizeObserver: ResizeObserverFactory = (callback) =>
  new ResizeObserver(callback);

/**
 * Applies a completed layout to mapped widget elements in one animation frame.
 * Elements without a placement are hidden; every placement must have an element.
 */
export function applyPlacements(
  placements: readonly Placement[],
  elements: WidgetElements,
  scheduleFrame: FrameScheduler = scheduleAnimationFrame,
): number {
  const placedIds = new Set<WidgetId>();

  const updates = placements.map(({ widget, rect }) => {
    const element = elements.get(widget.id);

    if (!element) {
      throw new Error(`Missing element for widget: ${widget.id}`);
    }

    placedIds.add(widget.id);
    return { element, rect };
  });

  return scheduleFrame(() => {
    for (const [widgetId, element] of elements) {
      element.hidden = !placedIds.has(widgetId);
    }

    for (const { element, rect } of updates) {
      element.style.position = "absolute";
      element.style.boxSizing = "border-box";
      element.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
      element.style.width = `${rect.w}px`;
      element.style.height = `${rect.h}px`;
    }
  });
}

/**
 * Observes an element's content box and reports at most one size per animation
 * frame. The returned cleanup function disconnects the observer and cancels a
 * pending callback.
 */
export function observeElementSize(
  element: Element,
  onSizeChange: SizeChangeHandler,
  {
    scheduleFrame = scheduleAnimationFrame,
    cancelFrame = cancelScheduledAnimationFrame,
    createObserver = createNativeResizeObserver,
  }: ElementSizeObserverOptions = {},
): () => void {
  let latestSize: ObservedSize | undefined;
  let frameId: number | null = null;

  const observer = createObserver((entries) => {
    const entry = entries.find(({ target }) => target === element);

    if (!entry) return;

    latestSize = {
      width: Math.floor(entry.contentRect.width),
      height: Math.floor(entry.contentRect.height),
    };

    if (frameId !== null) return;

    frameId = scheduleFrame(() => {
      frameId = null;

      if (!latestSize) return;

      const size = latestSize;
      latestSize = undefined;
      onSizeChange(size);
    });
  });

  observer.observe(element);

  return () => {
    observer.disconnect();

    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }

    latestSize = undefined;
  };
}
