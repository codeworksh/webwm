import {
  applyPlacements,
  bindDragHandle,
  observeElementSize,
  type ObservedSize,
} from "../src/dom/index.ts";
import {
  allTagsMask,
  arrangeWithMinimums,
  closestPlacementIndex,
  focus,
  hasMasterStack,
  isVisible,
  masterStackMfactRange,
  mfactFromPointer,
  moveWidget,
  tagBit,
  toggleViewedTags,
  type Placement,
  type Widget,
  type WidgetId,
  type WidgetOrder,
} from "../src/index.ts";
import "./style.css";

const WORK = tagBit(0);
const PERSONAL = tagBit(1);
const MEDIA = tagBit(2);
const ALLOWED_TAGS = allTagsMask(3);

const widgets: Widget[] = [
  { id: "editor", tags: WORK, minWidth: 420, minHeight: 200 },
  { id: "terminal", tags: WORK | PERSONAL, minWidth: 280, minHeight: 160 },
  { id: "calendar", tags: PERSONAL, minWidth: 240, minHeight: 180 },
  { id: "music", tags: MEDIA, minWidth: 220, minHeight: 140 },
  { id: "docs", tags: WORK | MEDIA, minWidth: 280, minHeight: 180 },
];

let order: WidgetOrder = {
  tileOrder: ["editor", "terminal", "calendar", "music", "docs"],
  focusOrder: ["editor", "terminal", "calendar", "music", "docs"],
};
let activeTags = WORK;
let focusedId: WidgetId | null = "editor";
let mfact = 0.58;
const pinnedIds = new Set<WidgetId>();
let currentPlacements: Placement[] = [];
let workspaceSize: ObservedSize = {
  width: 0,
  height: 0,
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing playground element: ${selector}`);
  }

  return element;
}

const workspace = requiredElement<HTMLElement>("#workspace");
const layoutSurface = requiredElement<HTMLElement>("#layout-surface");
const activeMask = requiredElement<HTMLElement>("#active-mask");
const layoutMode = requiredElement<HTMLElement>("#layout-mode");
const mfactValue = requiredElement<HTMLElement>("#mfact-value");
const masterDivider = requiredElement<HTMLElement>("#master-divider");
const tagButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tag]"));
const elements = new Map<WidgetId, HTMLElement>();

let resizeFrameId: number | null = null;

function mfactAtClientX(clientX: number): number {
  const surfaceRect = layoutSurface.getBoundingClientRect();
  const bounds = {
    x: 0,
    y: 0,
    w: workspaceSize.width,
    h: workspaceSize.height,
  };
  const visibleWidgets = order.tileOrder
    .map((widgetId) => widgets.find((widget) => widget.id === widgetId))
    .filter((widget): widget is Widget => widget !== undefined && isVisible(widget, activeTags));
  const nmaster = workspaceSize.width < 640 ? 0 : 2;
  const range = masterStackMfactRange(visibleWidgets, bounds, nmaster);

  return mfactFromPointer(clientX - surfaceRect.left, bounds, range ?? undefined);
}

bindDragHandle(masterDivider, {
  onDragStart: () => masterDivider.classList.add("is-resizing"),
  onDragMove: ({ clientX }) => {
    mfact = mfactAtClientX(clientX);

    if (resizeFrameId !== null) return;

    resizeFrameId = requestAnimationFrame(() => {
      resizeFrameId = null;
      render();
    });
  },
  onDragEnd: ({ clientX }) => {
    masterDivider.classList.remove("is-resizing");
    mfact = mfactAtClientX(clientX);

    if (resizeFrameId !== null) {
      cancelAnimationFrame(resizeFrameId);
      resizeFrameId = null;
    }

    render();
  },
  onDragCancel: () => {
    masterDivider.classList.remove("is-resizing");
  },
});

masterDivider.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  event.preventDefault();
  mfact = Math.min(0.95, Math.max(0.05, mfact + (event.key === "ArrowLeft" ? -0.05 : 0.05)));
  render();
});

for (const element of document.querySelectorAll<HTMLElement>("[data-widget-id]")) {
  const widgetId = element.dataset.widgetId;

  if (!widgetId) {
    throw new Error("Widget element is missing data-widget-id");
  }

  elements.set(widgetId, element);

  const handle = element.querySelector<HTMLElement>("[data-drag-handle]");
  const pinButton = element.querySelector<HTMLButtonElement>("[data-pin]");

  if (!handle || !pinButton) {
    throw new Error(`Widget "${widgetId}" needs a drag handle and pin button`);
  }

  pinButton.setAttribute("aria-label", `Pin ${widgetId}`);
  pinButton.addEventListener("click", (event) => {
    event.stopPropagation();

    if (pinnedIds.has(widgetId)) {
      pinnedIds.delete(widgetId);
    } else {
      pinnedIds.add(widgetId);
    }

    const pinned = pinnedIds.has(widgetId);
    pinButton.setAttribute("aria-pressed", String(pinned));
    pinButton.textContent = pinned ? "Pinned" : "Pin";
    element.classList.toggle("is-pinned", pinned);
  });

  let draggedPlacement: Placement | undefined;

  bindDragHandle(handle, {
    canDrag: () => !pinnedIds.has(widgetId),
    onDragStart: () => {
      draggedPlacement = currentPlacements.find(({ widget }) => widget.id === widgetId);
      element.classList.add("is-dragging");
    },
    onDragMove: ({ deltaX, deltaY }) => {
      if (!draggedPlacement) return;

      const { rect } = draggedPlacement;
      element.style.transform = `translate(${rect.x + deltaX}px, ${rect.y + deltaY}px)`;
    },
    onDragEnd: ({ clientX, clientY }) => {
      element.classList.remove("is-dragging");
      draggedPlacement = undefined;

      const surfaceRect = layoutSurface.getBoundingClientRect();
      const targetVisibleIndex = closestPlacementIndex(
        currentPlacements,
        clientX - surfaceRect.left,
        clientY - surfaceRect.top,
      );
      const targetId =
        targetVisibleIndex === null ? undefined : currentPlacements[targetVisibleIndex]?.widget.id;

      if (targetId !== undefined) {
        order = moveWidget(order, widgetId, order.tileOrder.indexOf(targetId));
      }

      render();
    },
    onDragCancel: () => {
      element.classList.remove("is-dragging");
      draggedPlacement = undefined;
      render();
    },
  });

  element.addEventListener("click", () => {
    const result = focus(widgets, order, activeTags, widgetId);
    order = result.order;
    focusedId = result.widget?.id ?? null;
    render();
  });
}

const tagsByName: Record<string, number> = {
  work: WORK,
  personal: PERSONAL,
  media: MEDIA,
};

for (const button of tagButtons) {
  button.addEventListener("click", () => {
    const tagName = button.dataset.tag;

    if (!tagName) return;

    activeTags = toggleViewedTags(activeTags, tagsByName[tagName], ALLOWED_TAGS);

    const result = focus(widgets, order, activeTags);
    order = result.order;
    focusedId = result.widget?.id ?? null;
    render();
  });
}

function render(): void {
  const nmaster = workspaceSize.width < 640 ? 0 : 2;
  const bounds = {
    x: 0,
    y: 0,
    w: workspaceSize.width,
    h: workspaceSize.height,
  };
  const visibleWidgets = order.tileOrder
    .map((widgetId) => widgets.find((widget) => widget.id === widgetId))
    .filter((widget): widget is Widget => widget !== undefined && isVisible(widget, activeTags));
  const mfactRange = masterStackMfactRange(visibleWidgets, bounds, nmaster);

  if (mfactRange) {
    mfact = Math.min(mfactRange.max, Math.max(mfactRange.min, mfact));
  }

  const result = arrangeWithMinimums(widgets, order, bounds, {
    activeTags,
    layout: "tile",
    nmaster,
    mfact,
  });

  currentPlacements = result.placements;

  layoutSurface.style.width = `${result.contentBounds.w}px`;
  layoutSurface.style.height = `${result.contentBounds.h}px`;
  layoutMode.textContent = result.mode;
  mfactValue.textContent = mfact.toFixed(2);

  const showDivider =
    result.mode === "preferred" && hasMasterStack(result.placements.length, nmaster);
  masterDivider.hidden = !showDivider;
  masterDivider.style.left = `${Math.floor(result.contentBounds.w * mfact) - 6}px`;
  masterDivider.setAttribute("aria-valuenow", mfact.toFixed(2));
  applyPlacements(result.placements, elements);

  activeMask.textContent = activeTags.toString(2).padStart(3, "0");

  for (const button of tagButtons) {
    const tagName = button.dataset.tag;
    const tag = tagName ? tagsByName[tagName] : undefined;
    button.setAttribute("aria-pressed", String(tag !== undefined && (activeTags & tag) !== 0));
  }

  for (const [widgetId, element] of elements) {
    element.classList.toggle("is-focused", widgetId === focusedId);
  }
}

observeElementSize(workspace, (size) => {
  workspaceSize = size;
  render();
});
