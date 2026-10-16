import { useCallback, useEffect, useMemo, useRef, useState, type RefCallback } from "react";
import {
  bindDragHandle,
  observeElementSize,
  type DragHandleOptions,
  type ObservedSize,
} from "../dom/index.ts";
import {
  arrangeWithMinimums,
  type ArrangeOptions,
  type Bounds,
  type LayoutTable,
  type MinimumAwareArrangement,
  type Widget,
  type WidgetOrder,
} from "../lib/index.ts";

/** Measures a browser element without reading the DOM from layout functions. */
export function useElementSize<T extends Element>(): [RefCallback<T>, ObservedSize] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ObservedSize>({ width: 0, height: 0 });
  const ref = useCallback<RefCallback<T>>((node) => setElement(node), []);

  useEffect(() => {
    if (!element) return;
    return observeElementSize(element, setSize);
  }, [element]);

  return [ref, size];
}

/** Memoizes the same pure arrangement available to vanilla DOM consumers. */
export function useArrangedWidgets(
  widgets: readonly Widget[],
  order: WidgetOrder,
  bounds: Bounds,
  options: ArrangeOptions,
  layoutTable?: LayoutTable,
): MinimumAwareArrangement {
  return useMemo(
    () => arrangeWithMinimums(widgets, order, bounds, options, layoutTable),
    [
      widgets,
      order,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      options.activeTags,
      options.layout,
      options.focusedWidgetId,
      options.nmaster,
      options.mfact,
      options.collapsedHeight,
      layoutTable,
    ],
  );
}

/**
 * Attaches Pointer Events to one explicit handle. Current callbacks and pin
 * state are read through a ref, so React rerenders do not interrupt a drag.
 */
export function useDragHandle<T extends HTMLElement>(options: DragHandleOptions): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const optionsRef = useRef(options);
  const ref = useCallback<RefCallback<T>>((node) => setElement(node), []);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!element) return;

    return bindDragHandle(element, {
      canDrag: () => optionsRef.current.canDrag?.() ?? true,
      onDragStart: (movement) => optionsRef.current.onDragStart?.(movement),
      onDragMove: (movement) => optionsRef.current.onDragMove?.(movement),
      onDragEnd: (movement) => optionsRef.current.onDragEnd?.(movement),
      onDragCancel: () => optionsRef.current.onDragCancel?.(),
    });
  }, [element]);

  return ref;
}
