import type { Placement, WidgetId } from "../lib/index.ts";

export type WidgetElements = ReadonlyMap<WidgetId, HTMLElement>;

export type FrameScheduler = (callback: FrameRequestCallback) => number;

const scheduleAnimationFrame: FrameScheduler = (callback) => requestAnimationFrame(callback);

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
