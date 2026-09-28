export interface Widget {
  readonly id: string;
  readonly tags: number;
  /** Minimum usable layout width in CSS pixels. Defaults to 1. */
  readonly minWidth?: number;
  /** Minimum usable layout height in CSS pixels. Defaults to 1. */
  readonly minHeight?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Bounds = Rect;

export interface TileOptions {
  nmaster: number; // number of widgets assigned to the master column
  mfact: number; // what fraction of width is assigned to the master column
}

export interface MfactLimits {
  readonly min?: number;
  readonly max?: number;
}

export interface MfactRange {
  readonly min: number;
  readonly max: number;
}

/** Converts a horizontal layout-space point into a bounded master ratio. */
export function mfactFromPointer(
  pointerX: number,
  bounds: Bounds,
  { min = 0.05, max = 0.95 }: MfactLimits = {},
): number {
  if (!Number.isFinite(pointerX)) {
    throw new Error(`Pointer x must be finite: ${pointerX}`);
  }
  if (!Number.isFinite(bounds.w) || bounds.w <= 0) {
    throw new Error(`Bounds width must be positive and finite: ${bounds.w}`);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 1 || min > max) {
    throw new Error(`Invalid mfact limits: ${min}..${max}`);
  }

  const ratio = (pointerX - bounds.x) / bounds.w;
  return Math.min(max, Math.max(min, ratio));
}

export function hasMasterStack(widgetCount: number, nmaster: number): boolean {
  return nmaster > 0 && widgetCount > nmaster;
}

/**
 * Finds the mfact interval in which both tile columns satisfy widget minimums.
 * Widgets must already be visible and in tile order.
 */
export function masterStackMfactRange(
  widgets: readonly Widget[],
  bounds: Bounds,
  nmaster: number,
  { min = 0.05, max = 0.95 }: MfactLimits = {},
): MfactRange | null {
  if (!hasMasterStack(widgets.length, nmaster)) return null;
  if (!Number.isFinite(bounds.w) || bounds.w <= 0) {
    throw new Error(`Bounds width must be positive and finite: ${bounds.w}`);
  }

  const masterWidgets = widgets.slice(0, nmaster);
  const stackWidgets = widgets.slice(nmaster);
  const masterMinWidth = Math.max(
    ...masterWidgets.map((widget) => minimumSize(widget, "minWidth")),
  );
  const stackMinWidth = Math.max(...stackWidgets.map((widget) => minimumSize(widget, "minWidth")));
  const range = {
    min: Math.max(min, masterMinWidth / bounds.w),
    max: Math.min(max, 1 - stackMinWidth / bounds.w),
  };

  return range.min <= range.max ? range : null;
}

export function tile(
  widgets: readonly Widget[],
  bounds: Bounds,
  { nmaster, mfact }: TileOptions,
): Rect[] {
  const count = widgets.length;
  if (count === 0) return [];

  // calculate the width of the master column partition.
  let masterWidth: number = 0;
  if (count > nmaster) {
    // there are more widgets than master slots allow
    // thus, needing partition for master and stack columns

    // before partition, check for allowed widgets assigned to the master column
    if (nmaster > 0) {
      // reserve mfact of the available bounded width for the master column
      // making the master column partition.
      masterWidth = Math.floor(bounds.w * mfact);
    } else {
      // no widgets assigned to the master column, all widgets belong to the stack column.
      masterWidth = 0;
    }
  } else {
    // no stack column needed, all come under the allowed master column space
    // for the widget count
    // master column can take the whole bounded width space
    masterWidth = bounds.w;
  }

  // widget count for master column partition
  // value used for dividing the master column vertically
  const masterCount = Math.min(count, nmaster);

  // offsets not abs coordinates
  let masterY = 0; // height already used in master column
  let stackY = 0; // height alrady used in stack column

  const rects = widgets.map((_, index) => {
    // fill up widgets allowed into master column
    if (index < nmaster) {
      // calculate the height partition for the widget.
      // the denominator is the how many partitions yet to fill
      // precisely:
      // Divide the remaining master-column height
      // by the number of master slots still to fill.
      const h = Math.floor((bounds.h - masterY) / (masterCount - index));
      const rect = {
        x: bounds.x,
        y: bounds.y + masterY,
        w: masterWidth,
        h,
      };
      masterY += h;
      return rect;
    }

    // fill up widgets in stack column
    // Note: `index` already incremented, pending from remaining count
    const h = Math.floor((bounds.h - stackY) / (count - index));

    const rect = {
      x: bounds.x + masterWidth,
      y: bounds.y + stackY,
      w: bounds.w - masterWidth,
      h,
    };

    stackY += h;
    return rect;
  });
  return rects;
}

export type LayoutFn = (widgets: readonly Widget[], bounds: Bounds, options: TileOptions) => Rect[];

export type LayoutTable = Readonly<Record<string, LayoutFn>>;

export const layouts = {
  tile,
} satisfies LayoutTable;

export function isVisible(widget: Widget, activeTags: number): boolean {
  return (widget.tags & activeTags) !== 0;
}

export interface Placement {
  widget: Widget;
  rect: Rect;
}

export function placementsSatisfyMinimumSizes(placements: readonly Placement[]): boolean {
  return placements.every(({ widget, rect }) => {
    const minWidth = minimumSize(widget, "minWidth");
    const minHeight = minimumSize(widget, "minHeight");

    return rect.w >= minWidth && rect.h >= minHeight;
  });
}

function minimumSize(widget: Widget, key: "minWidth" | "minHeight"): number {
  const value = widget[key] ?? 1;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${key} for widget "${widget.id}": ${value}`);
  }

  return value;
}

export interface ArrangeOptions extends TileOptions {
  activeTags: number;
  layout: string;
}

export type WidgetId = Widget["id"];

export interface WidgetOrder {
  tileOrder: readonly WidgetId[];
  focusOrder: readonly WidgetId[];
}

function resolveTileOrder(widgets: readonly Widget[], tileOrder: readonly WidgetId[]): Widget[] {
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

  return tileOrder.map((widgetId) => {
    const widget = widgetsById.get(widgetId);

    if (!widget) {
      throw new Error(`Unknown widget in tile order: ${widgetId}`);
    }

    return widget;
  });
}

export function arrange(
  widgets: readonly Widget[],
  order: WidgetOrder,
  bounds: Bounds,
  { activeTags, layout, nmaster, mfact }: ArrangeOptions,
  layoutTable: LayoutTable = layouts,
): Placement[] {
  const orderedWidgets = resolveTileOrder(widgets, order.tileOrder);
  const visibleWidgets = orderedWidgets.filter((widget) => isVisible(widget, activeTags));
  const layoutFn = layoutTable[layout];

  if (!layoutFn) {
    throw new Error(`Unknown layout: ${layout}`);
  }

  const rects = layoutFn(visibleWidgets, bounds, {
    nmaster,
    mfact,
  });

  if (rects.length !== visibleWidgets.length) {
    throw new Error(
      `Layout "${layout}" returned ${rects.length} rectangles for ${visibleWidgets.length} widgets`,
    );
  }

  return visibleWidgets.map((widget, index) => ({
    widget,
    rect: rects[index],
  }));
}

export interface MinimumAwareArrangement {
  readonly placements: Placement[];
  readonly contentBounds: Bounds;
  readonly mode: "preferred" | "preferred-scroll" | "stack";
}

/**
 * Uses the requested layout when it satisfies every visible widget's minimum
 * size. Otherwise, recomputes a full-width vertical stack on a larger,
 * scrollable surface so widgets never overlap.
 */
export function arrangeWithMinimums(
  widgets: readonly Widget[],
  order: WidgetOrder,
  bounds: Bounds,
  options: ArrangeOptions,
  layoutTable: LayoutTable = layouts,
): MinimumAwareArrangement {
  const preferred = arrange(widgets, order, bounds, options, layoutTable);

  if (placementsSatisfyMinimumSizes(preferred)) {
    return {
      placements: preferred,
      contentBounds: bounds,
      mode: "preferred",
    };
  }

  // A short viewport does not require abandoning master-stack. If every
  // column is wide enough, grow only the scrollable layout height until equal
  // tile slots satisfy the largest minimum height in each column.
  const widthsFit = preferred.every(
    ({ widget, rect }) => rect.w >= minimumSize(widget, "minWidth"),
  );

  if (options.layout === "tile" && widthsFit && preferred.length > 0) {
    const masterCount = Math.min(Math.max(0, options.nmaster), preferred.length);
    const master = preferred.slice(0, masterCount);
    const stack = preferred.slice(masterCount);
    const requiredColumnHeight = (column: readonly Placement[]): number =>
      column.length === 0
        ? 0
        : column.length * Math.max(...column.map(({ widget }) => minimumSize(widget, "minHeight")));
    const contentBounds: Bounds = {
      ...bounds,
      h: Math.max(bounds.h, requiredColumnHeight(master), requiredColumnHeight(stack)),
    };
    const placements = arrange(widgets, order, contentBounds, options, layoutTable);

    if (placementsSatisfyMinimumSizes(placements)) {
      return {
        placements,
        contentBounds,
        mode: "preferred-scroll",
      };
    }
  }

  const largestMinWidth = Math.max(
    1,
    ...preferred.map(({ widget }) => minimumSize(widget, "minWidth")),
  );
  const largestMinHeight = Math.max(
    1,
    ...preferred.map(({ widget }) => minimumSize(widget, "minHeight")),
  );
  const contentBounds: Bounds = {
    ...bounds,
    w: Math.max(bounds.w, largestMinWidth),
    h: Math.max(bounds.h, largestMinHeight * preferred.length),
  };

  const placements = arrange(
    widgets,
    order,
    contentBounds,
    {
      ...options,
      nmaster: 0,
    },
    layoutTable,
  );

  return {
    placements,
    contentBounds,
    mode: "stack",
  };
}

export function attach(order: readonly WidgetId[], widgetId: WidgetId): WidgetId[] {
  if (order.includes(widgetId)) {
    throw new Error(`Widget "${widgetId}" is already attached`);
  }

  return [widgetId, ...order];
}

export function detach(order: readonly WidgetId[], widgetId: WidgetId): WidgetId[] {
  if (!order.includes(widgetId)) {
    throw new Error(`Widget "${widgetId}" is not attached`);
  }

  return order.filter((id) => id !== widgetId);
}

export function attachWidget(order: WidgetOrder, widgetId: WidgetId): WidgetOrder {
  return {
    tileOrder: attach(order.tileOrder, widgetId),
    focusOrder: attach(order.focusOrder, widgetId),
  };
}

export function detachWidget(order: WidgetOrder, widgetId: WidgetId): WidgetOrder {
  return {
    tileOrder: detach(order.tileOrder, widgetId),
    focusOrder: detach(order.focusOrder, widgetId),
  };
}

export function focusWidget(order: WidgetOrder, widgetId: WidgetId): WidgetOrder {
  return {
    tileOrder: order.tileOrder,
    focusOrder: attach(detach(order.focusOrder, widgetId), widgetId),
  };
}

/** Moves one widget inside tileOrder without changing focusOrder. */
export function moveWidget(order: WidgetOrder, widgetId: WidgetId, toIndex: number): WidgetOrder {
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= order.tileOrder.length) {
    throw new Error(`Tile-order index is out of range: ${toIndex}`);
  }

  const fromIndex = order.tileOrder.indexOf(widgetId);

  if (fromIndex === -1) {
    throw new Error(`Widget "${widgetId}" is not in tile order`);
  }

  if (fromIndex === toIndex) return order;

  const tileOrder = [...order.tileOrder];
  tileOrder.splice(fromIndex, 1);
  tileOrder.splice(toIndex, 0, widgetId);

  return {
    tileOrder,
    focusOrder: order.focusOrder,
  };
}

export type InsertionEdge = "before" | "after";

export function moveWidgetRelative(
  order: WidgetOrder,
  widgetId: WidgetId,
  targetWidgetId: WidgetId,
  edge: InsertionEdge,
): WidgetOrder {
  if (widgetId === targetWidgetId) return order;

  const fromIndex = order.tileOrder.indexOf(widgetId);
  if (fromIndex === -1) {
    throw new Error(`Widget "${widgetId}" is not in tile order`);
  }
  if (!order.tileOrder.includes(targetWidgetId)) {
    throw new Error(`Target widget "${targetWidgetId}" is not in tile order`);
  }

  const tileOrder = order.tileOrder.filter((id) => id !== widgetId);
  const targetIndex = tileOrder.indexOf(targetWidgetId);
  tileOrder.splice(targetIndex + (edge === "after" ? 1 : 0), 0, widgetId);

  if (tileOrder.every((id, index) => id === order.tileOrder[index])) return order;

  return {
    tileOrder,
    focusOrder: order.focusOrder,
  };
}

export interface TileInsertionTarget {
  readonly widgetId: WidgetId;
  readonly edge: InsertionEdge;
  readonly indicator: Rect;
}

/**
 * Finds a before/after boundary in the tile column under the pointer.
 *
 * This is edge insertion, not floating-window magnetism: x selects the tile
 * column, while crossing a widget's vertical midpoint switches its proposed
 * edge from "before" to "after". No rectangle moves until the caller commits.
 */
export function tileInsertionTargetAtPoint(
  placements: readonly Placement[],
  x: number,
  y: number,
  nmaster: number,
): TileInsertionTarget | null {
  if (placements.length === 0) return null;

  const masterCount = Math.min(Math.max(0, nmaster), placements.length);
  const master = placements.slice(0, masterCount);
  const stack = placements.slice(masterCount);
  let column: readonly Placement[];

  if (master.length === 0) {
    column = stack;
  } else if (stack.length === 0) {
    column = master;
  } else {
    column = x < stack[0].rect.x ? master : stack;
  }

  // The first midpoint below the pointer owns the "before" edge. Beyond all
  // midpoints, the pointer targets the final widget's "after" edge.
  const target = column.find(({ rect }) => y < rect.y + rect.h / 2) ?? column.at(-1);
  if (!target) return null;

  const edge: InsertionEdge = y < target.rect.y + target.rect.h / 2 ? "before" : "after";
  const indicatorY = edge === "before" ? target.rect.y : target.rect.y + target.rect.h;

  return {
    widgetId: target.widget.id,
    edge,
    indicator: {
      x: target.rect.x,
      y: indicatorY,
      w: target.rect.w,
      h: 0,
    },
  };
}

/** Finds the placement whose center is nearest to a layout-space point. */
export function closestPlacementIndex(
  placements: readonly Placement[],
  x: number,
  y: number,
): number | null {
  if (placements.length === 0) return null;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  placements.forEach(({ rect }, index) => {
    const deltaX = x - (rect.x + rect.w / 2);
    const deltaY = y - (rect.y + rect.h / 2);
    const distance = deltaX * deltaX + deltaY * deltaY;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

export interface FocusResult {
  widget: Widget | null;
  order: WidgetOrder;
}

export function focus(
  widgets: readonly Widget[],
  order: WidgetOrder,
  activeTags: number,
  requestedWidgetId?: WidgetId,
): FocusResult {
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

  let target: Widget | undefined;

  if (requestedWidgetId !== undefined) {
    const requestedWidget = widgetsById.get(requestedWidgetId);

    if (!requestedWidget) {
      throw new Error(`Unknown widget: ${requestedWidgetId}`);
    }

    if (isVisible(requestedWidget, activeTags)) {
      target = requestedWidget;
    }
  }

  if (!target) {
    for (const widgetId of order.focusOrder) {
      const widget = widgetsById.get(widgetId);

      if (!widget) {
        throw new Error(`Unknown widget in focus order: ${widgetId}`);
      }

      if (isVisible(widget, activeTags)) {
        target = widget;
        break;
      }
    }
  }

  if (!target) {
    return {
      widget: null,
      order,
    };
  }

  return {
    widget: target,
    order: focusWidget(order, target.id),
  };
}

export function tagBit(index: number): number {
  if (!Number.isInteger(index)) {
    throw new Error(`Tag index must be an integer: ${index}`);
  }

  if (index < 0 || index > 30) {
    throw new Error(`Tag index must be between 0 and 30: ${index}`);
  }

  // Turn on exactly one bit at the requested zero-based index.
  return 1 << index;
}

export function allTagsMask(tagCount: number): number {
  if (!Number.isInteger(tagCount)) {
    throw new Error(`Tag count must be an integer: ${tagCount}`);
  }

  if (tagCount < 1 || tagCount > 31) {
    throw new Error(`Tag count must be between 1 and 31: ${tagCount}`);
  }

  // Equivalent to `(1 << tagCount) - 1` for smaller counts.
  // Exponentiation also supports tagCount 31 without shifting
  // into JavaScript's signed 32-bit sign bit.
  return 2 ** tagCount - 1;
}

// JavaScript bitwise operators use signed 32-bit integers. Keep the sign bit
// clear so every supported tag mask remains a positive integer.
const MAX_TAG_MASK = 0x7fffffff;

export function validateTagMask(mask: number, allowedTags: number): number {
  if (!Number.isSafeInteger(mask)) {
    throw new Error(`Tag mask must be a safe integer: ${mask}`);
  }

  if (mask === 0) {
    throw new Error("Tag mask must contain at least one tag: 0");
  }

  if (mask < 0 || mask > MAX_TAG_MASK) {
    throw new Error(`Tag mask must be between 1 and ${MAX_TAG_MASK}: ${mask}`);
  }

  // `~allowedTags` marks every disallowed bit; AND isolates any disallowed
  // bits that the caller tried to include in `mask`.
  const invalidBits = mask & ~allowedTags;

  if (invalidBits !== 0) {
    throw new Error(`Tag mask contains tags outside the allowed mask: ${mask}`);
  }

  return mask;
}

export function setWidgetTags(widget: Widget, requestedTags: number, allowedTags: number): Widget {
  const tags = validateTagMask(requestedTags, allowedTags);

  if (tags === widget.tags) {
    return widget;
  }

  return {
    ...widget,
    tags,
  };
}

export function toggleWidgetTags(
  widget: Widget,
  requestedTags: number,
  allowedTags: number,
): Widget {
  const tagsToToggle = validateTagMask(requestedTags, allowedTags);

  const tags = widget.tags ^ tagsToToggle;

  // Match dwm: a widget must retain at least one tag. If toggling would
  // produce zero, leave it unchanged.
  if (tags === 0) {
    return widget;
  }

  return {
    ...widget,
    tags,
  };
}

export function viewTags(requestedTags: number, allowedTags: number): number {
  return validateTagMask(requestedTags, allowedTags);
}

export function toggleViewedTags(
  activeTags: number,
  requestedTags: number,
  allowedTags: number,
): number {
  const currentTags = validateTagMask(activeTags, allowedTags);

  const tagsToToggle = validateTagMask(requestedTags, allowedTags);

  const nextTags = currentTags ^ tagsToToggle;

  // Match dwm: at least one tag must remain visible.
  // If toggling would produce zero, preserve the current view.
  if (nextTags === 0) {
    return activeTags;
  }

  return nextTags;
}
