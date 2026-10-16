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

export interface DragMovement {
  readonly startX: number;
  readonly startY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface DragHandleOptions {
  /** Read at pointer-down time, so pin state can change without rebinding. */
  readonly canDrag?: () => boolean;
  readonly onDragStart?: (movement: DragMovement) => void;
  readonly onDragMove?: (movement: DragMovement) => void;
  readonly onDragEnd?: (movement: DragMovement) => void;
  readonly onDragCancel?: () => void;
}

const scheduleAnimationFrame: FrameScheduler = (callback) => requestAnimationFrame(callback);
const cancelScheduledAnimationFrame: FrameCanceler = (frameId) => cancelAnimationFrame(frameId);
const createNativeResizeObserver: ResizeObserverFactory = (callback) =>
  new ResizeObserver(callback);

/**
 * Turns one explicit element into a pointer drag handle. The surrounding
 * widget remains untouched and can keep its normal interactive content.
 */
export function bindDragHandle(
  handle: HTMLElement,
  { canDrag = () => true, onDragStart, onDragMove, onDragEnd, onDragCancel }: DragHandleOptions,
): () => void {
  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;

  const movementFor = (event: PointerEvent): DragMovement => ({
    startX,
    startY,
    clientX: event.clientX,
    clientY: event.clientY,
    deltaX: event.clientX - startX,
    deltaY: event.clientY - startY,
  });

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || !canDrag()) return;

    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    onDragStart?.(movementFor(event));
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;

    onDragMove?.(movementFor(event));
  };

  const finish = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;

    const movement = movementFor(event);
    activePointerId = null;
    handle.releasePointerCapture(event.pointerId);
    onDragEnd?.(movement);
  };

  const cancel = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    onDragCancel?.();
  };

  handle.style.touchAction = "none";
  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", cancel);

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", cancel);
  };
}

/**
 * Applies a completed layout to mapped widget elements in one animation frame.
 * Elements without a placement are hidden; every placement must have an element.
 * A collapsed placement marks its element with `data-collapsed`, for styling it as a title bar.
 */
export function applyPlacements(
  placements: readonly Placement[],
  elements: WidgetElements,
  scheduleFrame: FrameScheduler = scheduleAnimationFrame,
): number {
  const placedIds = new Set<WidgetId>();

  const updates = placements.map(({ widget, rect, collapsed }) => {
    const element = elements.get(widget.id);

    if (!element) {
      throw new Error(`Missing element for widget: ${widget.id}`);
    }

    placedIds.add(widget.id);
    return { element, rect, collapsed: collapsed === true };
  });

  return scheduleFrame(() => {
    for (const [widgetId, element] of elements) {
      element.hidden = !placedIds.has(widgetId);
    }

    for (const { element, rect, collapsed } of updates) {
      element.toggleAttribute("data-collapsed", collapsed);
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
