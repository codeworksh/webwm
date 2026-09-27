export interface Widget {
  readonly id: string;
  tags: number;
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

export type LayoutFn = (
  widgets: readonly Widget[],
  bounds: Bounds,
  options: TileOptions,
) => Rect[];

export type LayoutTable = Readonly<Record<string, LayoutFn>>;

export const layouts = {
  tile,
} satisfies LayoutTable;


export function isVisible(
  widget: Widget,
  activeTags: number,
): boolean {
  return (widget.tags & activeTags) !== 0;
}
