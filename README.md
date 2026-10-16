# webwm

A browser-native, framework-agnostic TypeScript tiling library inspired by
[`dwm`](https://dwm.suckless.org/). Widgets live in a flat ordered list; tags
select which widgets are visible; Tile, Grid, and Monocle compute plain
`{ x, y, w, h }` rectangles. There are no floating windows or split trees.

MIT licensed by Sanchit Kudari. The dwm attribution and upstream license are
preserved in [NOTICES.md](NOTICES.md).

Version `0.2.0` is distributed through [GitHub Releases](https://github.com/codeworksh/webwm/releases),
not npm. Install the release package directly from GitHub:

```bash
pnpm add https://github.com/codeworksh/webwm/releases/download/v0.2.0/webwm-0.2.0.tgz
```

You can also download that asset first and run `pnpm add ./webwm-0.2.0.tgz`.
Use the release asset rather than the repository source archive: it includes
the built `webwm`, `webwm/dom`, and `webwm/react` entry points.
If you use `webwm/react`, install React in your app as well (`pnpm add react`);
the core and DOM entry points do not require it.

## Quick start

```ts
import { arrangeWithMinimums, tagBit, type WidgetOrder } from "webwm";

const work = tagBit(0);
const widgets = [
  { id: "editor", tags: work, minWidth: 300 },
  { id: "terminal", tags: work, minWidth: 220 },
];
const order: WidgetOrder = {
  tileOrder: ["editor", "terminal"],
  focusOrder: ["editor", "terminal"],
};

const result = arrangeWithMinimums(
  widgets,
  order,
  { x: 0, y: 0, w: 900, h: 500 },
  { activeTags: work, layout: "tile", nmaster: 1, mfact: 0.6 },
);
// result.placements: [{ widget, rect }, ...]
```

The core returns geometry only. In React, use `webwm/react` hooks to measure a
container and calculate placements, then render your own widget components.
In plain DOM, `webwm/dom` applies placements in a single animation-frame write.
See the two apps below for complete integrations.

## Workspace

| Path              | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `src/lib`         | Pure layout, tags, ordering, focus, minimum-size, and reorder functions |
| `src/dom`         | Optional DOM measurement, pointer handle, and batched placement helpers |
| `src/react`       | Optional React hooks using the same core                                |
| `apps/web`        | TanStack Router + React integration app, styled as an editor workspace  |
| `apps/playground` | Plain DOM/TypeScript integration app                                    |
| `tests`           | Fast pure-core and DOM-adapter unit tests                               |
| `e2e`             | Chromium tests exercising both real browser apps                        |

Both apps import public package paths (`webwm`, `webwm/dom`, and `webwm/react`),
so their builds exercise the package as consumers. The core never reads the DOM
and has no framework dependency.

## Run

```bash
pnpm install
pnpm dev:app         # React app: http://localhost:5174
pnpm dev:playground  # Plain DOM app: http://localhost:5173
```

Run those development commands in separate terminals. They build the library
before starting the app. If a server from the old directory structure is still
running, stop it and restart the command above.

## Verify

```bash
pnpm check           # Build both apps, formatting, lint, and TypeScript
pnpm test            # Core and DOM helper unit tests
pnpm exec playwright install chromium  # One-time browser installation
pnpm test:e2e        # Real browser integration tests for both apps
```

The E2E suite uses isolated ports 5183/5184 and shuts down its own servers. It
tests tag visibility, layout modes, Max/Restore, handle-only dragging, pinning,
edge insertion, divider limits, responsive layouts, and disjoint rectangles.

## Library entry points

```ts
import { arrangeWithMinimums, tile, tagBit } from "webwm";
import { applyPlacements, bindDragHandle, observeElementSize } from "webwm/dom";
import { useArrangedWidgets, useDragHandle, useElementSize } from "webwm/react";
```

`webwm/react` is an optional adapter. React components own widget content and
state; webwm computes placement. The `apps/web` route shows one complete
integration, including application-owned pin and Max state.

## When widgets do not fit

`arrangeWithMinimums` never lets a widget go below its `minWidth` or
`minHeight`. When the requested layout cannot meet them, `result.mode` says
what it did instead:

| Mode                 | What you get                                         |
| -------------------- | ---------------------------------------------------- |
| `preferred`          | The requested layout as is                           |
| `preferred-collapse` | Tile within the bounds, with some widgets collapsed  |
| `preferred-scroll`   | The requested layout on a larger, scrollable surface |
| `stack`              | A full-width vertical stack on a scrollable surface  |

`preferred-collapse` is opt-in: pass `collapsedHeight`, the height of a
widget shown as its title bar. When a tile column cannot fit all its widgets,
the most recently focused ones stay open and the rest collapse to that height
at the bottom of the column, in tile order. Nothing scrolls, and every widget
stays one click away.

```ts
const result = arrangeWithMinimums(widgets, order, bounds, {
  activeTags: work,
  layout: "tile",
  nmaster: 1,
  mfact: 0.6,
  collapsedHeight: 32,
});

for (const { widget, rect, collapsed } of result.placements) {
  // Draw `rect`; when `collapsed`, show only the title bar.
}
```

To open a collapsed widget, focus it with `focus` (or `focusWidget`). It is
then among the most recently focused, so the next arrangement opens it and
collapses whichever open widget was focused least recently. Keep a collapsed
widget's content mounted and just hide it, so its state survives. `webwm/dom`
marks collapsed elements with a `data-collapsed` attribute for styling, and
`tileInsertionTargetAtPoint` reads the column top to bottom, so dragging onto a
title bar works as expected.

When a column is so short that even the title bars do not all fit, it keeps
one widget open, shows the title bars of the most recently focused widgets
that fit, and gathers the rest in `result.overflow`: one entry per column,
with the `widgets` it holds (in tile order) and the `rect` of its slot at the
column's bottom. Those widgets get no placement. Draw the slot as an entry such
as "+3 more" that lists them, and focus a widget picked from it to open it.
Keep their content mounted and hidden, like collapsed widgets. Without
`collapsedHeight`, a short tile column scrolls as before, and `overflow` is
always empty.

```ts
for (const { widgets: hidden, rect } of result.overflow) {
  // Draw `rect` as "+{hidden.length} more"; picking one calls focus(...).
}
```
