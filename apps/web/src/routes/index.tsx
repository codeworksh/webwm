import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import {
  allTagsMask,
  focus,
  gridInsertionTargetAtPoint,
  hasMasterStack,
  isVisible,
  masterStackMfactRange,
  mfactFromPointer,
  moveWidgetRelative,
  tagBit,
  tileInsertionTargetAtPoint,
  toggleViewedTags,
  type Bounds,
  type InsertionTarget,
  type Rect,
  type Widget,
  type WidgetId,
  type WidgetOrder,
} from "webwm";
import { useArrangedWidgets, useDragHandle, useElementSize } from "webwm/react";

const work = tagBit(0);
const personal = tagBit(1);
const media = tagBit(2);
const allowedTags = allTagsMask(3);

// A collapsed frame is its title bar: 35px bar inside a 3px border, top and bottom.
const COLLAPSED_HEIGHT = 41;

const widgets: Widget[] = [
  { id: "editor", tags: work, minWidth: 390, minHeight: 200 },
  { id: "terminal", tags: work | personal, minWidth: 280, minHeight: 160 },
  { id: "calendar", tags: personal, minWidth: 250, minHeight: 170 },
  { id: "music", tags: media, minWidth: 220, minHeight: 150 },
  { id: "reference", tags: work | media, minWidth: 270, minHeight: 170 },
];

const details: Record<WidgetId, { title: string; description: string }> = {
  editor: { title: "Editor", description: "A React component, arranged by the pure layout core." },
  terminal: { title: "Terminal", description: "Shared on Work and Personal." },
  calendar: { title: "Calendar", description: "Personal board · today" },
  music: { title: "Music", description: "Media board · now playing" },
  reference: { title: "Reference", description: "Shared on Work and Media." },
};

const widgetFiles: Record<WidgetId, string> = {
  editor: "index.tsx",
  terminal: "terminal",
  calendar: "calendar.tsx",
  music: "music.tsx",
  reference: "README.md",
};

function WidgetContent({ id }: { readonly id: WidgetId }) {
  if (id === "editor") {
    return (
      <div className="code-preview" aria-label="Example TypeScript code">
        <div>
          <span>01</span>
          <code>
            <b>const</b> layout = <em>tile</em>(
          </code>
        </div>
        <div>
          <span>02</span>
          <code> widgets, bounds,</code>
        </div>
        <div>
          <span>03</span>
          <code>
            {" "}
            &#123; nmaster: <i>2</i>, mfact: <i>0.58</i> &#125;
          </code>
        </div>
        <div>
          <span>04</span>
          <code>);</code>
        </div>
      </div>
    );
  }
  if (id === "terminal") {
    return (
      <div className="terminal-preview">
        <div>
          <span className="prompt">➜</span> pnpm test
        </div>
        <div className="terminal-muted">✓ 98 tests passed</div>
        <div>
          <span className="prompt">➜</span> <span className="terminal-cursor">▍</span>
        </div>
      </div>
    );
  }
  if (id === "calendar") {
    return (
      <div className="calendar-preview">
        <span>14:30</span>
        <div>
          <strong>Design review</strong>
          <small>Workspace · 45 min</small>
        </div>
      </div>
    );
  }
  if (id === "music") {
    return (
      <div className="music-preview">
        <span className="album-art">♫</span>
        <div>
          <strong>Binary Sunset</strong>
          <small>Now playing</small>
          <span className="music-progress" />
        </div>
      </div>
    );
  }
  return (
    <div className="reference-preview">
      <div>
        <span>01</span>
        <code># dwm-inspired layout</code>
      </div>
      <div>
        <span>02</span>
        <code>Pure geometry · browser native</code>
      </div>
      <div>
        <span>03</span>
        <code>Tile / Grid / Monocle</code>
      </div>
    </div>
  );
}

const tags = [
  { name: "Work", mask: work },
  { name: "Personal", mask: personal },
  { name: "Media", mask: media },
];

interface DragPreview {
  readonly widgetId: WidgetId;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly target: InsertionTarget | null;
}

interface WidgetFrameProps {
  readonly widget: Widget;
  readonly rect: Rect;
  readonly collapsed: boolean;
  readonly focused: boolean;
  readonly maximized: boolean;
  readonly pinned: boolean;
  readonly canReorder: boolean;
  readonly dragPreview: DragPreview | null;
  readonly onFocus: (id: WidgetId) => void;
  readonly onMaximize: (id: WidgetId) => void;
  readonly onPin: (id: WidgetId) => void;
  readonly onDragStart: (id: WidgetId) => void;
  readonly onDragMove: (
    id: WidgetId,
    clientX: number,
    clientY: number,
    dx: number,
    dy: number,
  ) => void;
  readonly onDragEnd: (id: WidgetId, clientX: number, clientY: number) => void;
  readonly onDragCancel: () => void;
}

function WidgetFrame({
  widget,
  rect,
  collapsed,
  focused,
  maximized,
  pinned,
  canReorder,
  dragPreview,
  onFocus,
  onMaximize,
  onPin,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: WidgetFrameProps) {
  const dragging = dragPreview?.widgetId === widget.id;
  const handleRef = useDragHandle<HTMLSpanElement>({
    canDrag: () => canReorder && !pinned,
    onDragStart: () => onDragStart(widget.id),
    onDragMove: ({ clientX, clientY, deltaX, deltaY }) =>
      onDragMove(widget.id, clientX, clientY, deltaX, deltaY),
    onDragEnd: ({ clientX, clientY }) => onDragEnd(widget.id, clientX, clientY),
    onDragCancel,
  });
  const frameStyle: CSSProperties = {
    width: rect.w,
    height: rect.h,
    transform: `translate(${rect.x + (dragging ? dragPreview.deltaX : 0)}px, ${rect.y + (dragging ? dragPreview.deltaY : 0)}px)`,
  };

  return (
    <article
      data-widget-id={widget.id}
      className={`widget${focused ? " is-focused" : ""}${dragging ? " is-dragging" : ""}${collapsed ? " is-collapsed" : ""}`}
      style={frameStyle}
      onClick={() => onFocus(widget.id)}
    >
      <header className="widget-bar">
        <span
          ref={handleRef}
          className={`widget-label${canReorder && !pinned ? " is-draggable" : ""}`}
          aria-label={`${widget.id} drag handle`}
        >
          <span className="widget-file-icon" aria-hidden="true">
            {widget.id === "reference" ? "↓" : widget.id === "terminal" ? "›" : "◉"}
          </span>
          {widgetFiles[widget.id]}
        </span>
        <span className="widget-actions">
          <button
            type="button"
            aria-label={`${pinned ? "Unpin" : "Pin"} ${widget.id}`}
            aria-pressed={pinned}
            onClick={(event) => {
              event.stopPropagation();
              onPin(widget.id);
            }}
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            aria-label={`${maximized ? "Restore" : "Maximize"} ${widget.id}`}
            aria-pressed={maximized}
            onClick={(event) => {
              event.stopPropagation();
              onMaximize(widget.id);
            }}
          >
            {maximized ? "Restore" : "Max"}
          </button>
        </span>
      </header>
      {/* Collapsed frames keep their content mounted, so it keeps its state while folded away. */}
      <div className="widget-body" hidden={collapsed}>
        <div className="widget-eyebrow">
          {widget.id === "editor" ? "ACTIVE FILE" : "OPEN WIDGET"}
        </div>
        <h2>{details[widget.id].title}</h2>
        <p>{details[widget.id].description}</p>
        <WidgetContent id={widget.id} />
      </div>
    </article>
  );
}

interface DividerProps {
  readonly left: number;
  readonly height: number;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onPointer: (clientX: number) => void;
  readonly onChange: (value: number) => void;
}

function MasterDivider({ left, height, value, min, max, onPointer, onChange }: DividerProps) {
  const handleRef = useDragHandle<HTMLDivElement>({
    onDragStart: ({ clientX }) => onPointer(clientX),
    onDragMove: ({ clientX }) => onPointer(clientX),
    onDragEnd: ({ clientX }) => onPointer(clientX),
  });

  return (
    <div
      ref={handleRef}
      className="master-divider"
      role="separator"
      aria-label="Master and stack divider"
      aria-orientation="vertical"
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      style={{ left: left - 7, height }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const step = event.key === "ArrowLeft" ? -0.05 : 0.05;
        onChange(Math.min(max, Math.max(min, value + step)));
      }}
    />
  );
}

function WorkspacePage() {
  const [order, setOrder] = useState<WidgetOrder>({
    tileOrder: widgets.map(({ id }) => id),
    focusOrder: widgets.map(({ id }) => id),
  });
  const [activeTags, setActiveTags] = useState(work);
  const [layout, setLayout] = useState<"tile" | "grid" | "monocle">("tile");
  const [layoutBeforeMonocle, setLayoutBeforeMonocle] = useState<"tile" | "grid">("tile");
  const [focusedId, setFocusedId] = useState<WidgetId | null>("editor");
  const [pinnedIds, setPinnedIds] = useState<ReadonlySet<WidgetId>>(() => new Set());
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [mfact, setMfact] = useState(0.58);
  const [workspaceRef, size] = useElementSize<HTMLDivElement>();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nmaster = size.width < 640 ? 0 : 2;
  const bounds: Bounds = { x: 0, y: 0, w: size.width, h: size.height };
  const visibleWidgets = order.tileOrder
    .map((id) => widgets.find((widget) => widget.id === id))
    .filter((widget): widget is Widget => widget !== undefined && isVisible(widget, activeTags));
  const mfactRange = bounds.w > 0 ? masterStackMfactRange(visibleWidgets, bounds, nmaster) : null;
  const effectiveMfact = mfactRange
    ? Math.min(mfactRange.max, Math.max(mfactRange.min, mfact))
    : mfact;
  const arrangement = useArrangedWidgets(widgets, order, bounds, {
    activeTags,
    layout,
    focusedWidgetId: focusedId ?? undefined,
    nmaster,
    mfact: effectiveMfact,
    collapsedHeight: COLLAPSED_HEIGHT,
  });
  const showDivider =
    layout === "tile" &&
    arrangement.mode !== "stack" &&
    mfactRange !== null &&
    hasMasterStack(arrangement.placements.length, nmaster);

  const insertionTarget = (clientX: number, clientY: number): InsertionTarget | null => {
    const surface = surfaceRef.current;
    if (!surface || layout === "monocle") return null;
    const surfaceRect = surface.getBoundingClientRect();
    const x = clientX - surfaceRect.left;
    const y = clientY - surfaceRect.top;
    if (layout === "grid") return gridInsertionTargetAtPoint(arrangement.placements, x, y);
    return tileInsertionTargetAtPoint(
      arrangement.placements,
      x,
      y,
      arrangement.mode === "stack" ? 0 : nmaster,
    );
  };

  const resizeDivider = (clientX: number) => {
    const surface = surfaceRef.current;
    if (!surface || !mfactRange) return;
    setMfact(mfactFromPointer(clientX - surface.getBoundingClientRect().left, bounds, mfactRange));
  };

  const selectLayout = (next: "tile" | "grid") => {
    setDragPreview(null);
    setLayoutBeforeMonocle(next);
    setLayout(next);
  };

  const focusWidget = (widgetId: WidgetId) => {
    const result = focus(widgets, order, activeTags, widgetId);
    setOrder(result.order);
    setFocusedId(result.widget?.id ?? null);
  };

  const toggleTag = (mask: number) => {
    const nextTags = toggleViewedTags(activeTags, mask, allowedTags);
    const result = focus(widgets, order, nextTags);
    setDragPreview(null);
    setActiveTags(nextTags);
    setOrder(result.order);
    setFocusedId(result.widget?.id ?? null);
  };

  const toggleMax = (widgetId: WidgetId) => {
    setDragPreview(null);
    if (layout === "monocle" && arrangement.placements[0]?.widget.id === widgetId) {
      setLayout(layoutBeforeMonocle);
      return;
    }

    focusWidget(widgetId);
    if (layout !== "monocle") setLayoutBeforeMonocle(layout);
    setLayout("monocle");
  };

  const togglePin = (widgetId: WidgetId) => {
    setPinnedIds((current) => {
      const next = new Set(current);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  };

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <p className="breadcrumbs">
          apps <span>›</span> web <span>›</span> workspace.tsx
        </p>
        <div className="heading-row">
          <div>
            <p className="section-label">INTERACTIVE PREVIEW</p>
            <h1>Widget workspace</h1>
          </div>
          <span className="live-indicator">
            <span /> LIVE
          </span>
        </div>
        <p className="intro-copy">
          Dwm-style tiling, composed with React. Drag a widget tab to reorder, pin it in place, or
          resize the master column. The content stays yours; webwm only computes geometry.
        </p>
      </div>

      <div className="controls">
        <div className="control-group" aria-label="Visible boards">
          <span className="control-label">BOARD</span>
          {tags.map(({ name, mask }) => (
            <button
              key={name}
              type="button"
              aria-pressed={(activeTags & mask) !== 0}
              onClick={() => toggleTag(mask)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="control-group" aria-label="Layout">
          <span className="control-label">LAYOUT</span>
          <button
            type="button"
            aria-pressed={layout === "tile"}
            onClick={() => selectLayout("tile")}
          >
            Tile
          </button>
          <button
            type="button"
            aria-pressed={layout === "grid"}
            onClick={() => selectLayout("grid")}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="workspace" ref={workspaceRef}>
        <div
          ref={surfaceRef}
          className="layout-surface"
          style={{ width: arrangement.contentBounds.w, height: arrangement.contentBounds.h }}
        >
          {arrangement.placements.map(({ widget, rect, collapsed }) => (
            <WidgetFrame
              key={widget.id}
              widget={widget}
              rect={rect}
              collapsed={collapsed === true}
              focused={widget.id === focusedId}
              maximized={layout === "monocle" && widget.id === arrangement.placements[0]?.widget.id}
              pinned={pinnedIds.has(widget.id)}
              canReorder={layout !== "monocle"}
              dragPreview={dragPreview}
              onFocus={focusWidget}
              onMaximize={toggleMax}
              onPin={togglePin}
              onDragStart={(id) =>
                setDragPreview({ widgetId: id, deltaX: 0, deltaY: 0, target: null })
              }
              onDragMove={(id, clientX, clientY, deltaX, deltaY) =>
                setDragPreview({
                  widgetId: id,
                  deltaX,
                  deltaY,
                  target: insertionTarget(clientX, clientY),
                })
              }
              onDragEnd={(id, clientX, clientY) => {
                const target = insertionTarget(clientX, clientY);
                if (target) {
                  setOrder((current) =>
                    moveWidgetRelative(current, id, target.widgetId, target.edge),
                  );
                }
                setDragPreview(null);
              }}
              onDragCancel={() => setDragPreview(null)}
            />
          ))}
          {dragPreview?.target && (
            <div
              className={`insertion-indicator${layout === "grid" ? " is-vertical" : ""}`}
              style={{
                left: dragPreview.target.indicator.x,
                top: dragPreview.target.indicator.y,
                width: layout === "grid" ? 4 : dragPreview.target.indicator.w,
                height: layout === "grid" ? dragPreview.target.indicator.h : 4,
              }}
            />
          )}
          {showDivider && mfactRange && (
            <MasterDivider
              left={Math.floor(bounds.w * effectiveMfact)}
              height={arrangement.contentBounds.h}
              value={effectiveMfact}
              min={mfactRange.min}
              max={mfactRange.max}
              onPointer={resizeDivider}
              onChange={setMfact}
            />
          )}
        </div>
      </div>

      <p className="status-line">
        Layout: {layout} · View: {arrangement.mode} · Visible widgets:{" "}
        {arrangement.placements.length}
        {showDivider ? ` · Master: ${Math.round(effectiveMfact * 100)}%` : ""}
      </p>
    </main>
  );
}

export const Route = createFileRoute("/")({ component: WorkspacePage });
