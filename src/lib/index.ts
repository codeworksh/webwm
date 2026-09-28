export interface Widget {
  readonly id: string;
  readonly tags: number;
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

  // a widget must retain at least one tag.
  // if toggling would produce zero, leave it unchanged
  // You can also throw an error - but its a bad experience
  if (tags === 0) return widget;

  return {
    ...widget,
    tags,
  };
}
