import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

function RootLayout() {
  return (
    <div className="ide-shell">
      <header className="titlebar">
        <div className="window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="titlebar-brand">WEBWM</span>
        <div className="command-center">
          <span aria-hidden="true">⌕</span>
          <span>webwm / widget workspace</span>
        </div>
        <span className="titlebar-version">TypeScript · React</span>
      </header>

      <div className="shell-body">
        <nav className="activity-rail" aria-label="Primary navigation">
          <Link to="/" aria-label="Workspace" activeProps={{ "aria-current": "page" }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
          </Link>
          <Link to="/about" aria-label="About" activeProps={{ "aria-current": "page" }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7.2h.01" strokeLinecap="round" />
            </svg>
          </Link>
          <span className="rail-spacer" />
          <span className="rail-mark" aria-label="Library demo">
            wm
          </span>
        </nav>

        <aside className="explorer" aria-label="Project explorer">
          <div className="explorer-heading">
            EXPLORER <span aria-hidden="true">···</span>
          </div>
          <div className="explorer-section">
            <span aria-hidden="true">⌄</span> WEBWM
          </div>
          <div className="file-tree" aria-hidden="true">
            <div className="folder-row">
              <span>⌄</span>
              <span className="folder-glyph">▣</span> apps
            </div>
            <div className="folder-row depth-1">
              <span>⌄</span>
              <span className="folder-glyph">▣</span> web
            </div>
            <div className="file-row depth-2 is-selected">
              <span className="file-glyph react">◉</span> workspace.tsx
            </div>
            <div className="file-row depth-2">
              <span className="file-glyph ts">TS</span> routes.ts
            </div>
            <div className="folder-row depth-1">
              <span>›</span>
              <span className="folder-glyph">▣</span> playground
            </div>
            <div className="folder-row">
              <span>⌄</span>
              <span className="folder-glyph">▣</span> src
            </div>
            <div className="file-row depth-1">
              <span className="file-glyph ts">TS</span> lib/index.ts
            </div>
            <div className="file-row depth-1">
              <span className="file-glyph ts">TS</span> react/index.ts
            </div>
            <div className="file-row depth-1">
              <span className="file-glyph ts">TS</span> dom/index.ts
            </div>
          </div>
          <div className="explorer-section lower">
            <span aria-hidden="true">›</span> OUTLINE
          </div>
          <div className="explorer-section">
            <span aria-hidden="true">›</span> TIMELINE
          </div>
          <div className="explorer-hint">Two apps. One layout engine.</div>
        </aside>

        <div className="editor-pane">
          <nav className="editor-tabs" aria-label="App pages">
            <Link to="/" activeProps={{ "aria-current": "page" }}>
              <span className="tab-icon react">◉</span> workspace.tsx{" "}
              <span className="tab-close" aria-hidden="true">
                ×
              </span>
            </Link>
            <Link to="/about" activeProps={{ "aria-current": "page" }}>
              <span className="tab-icon md">↓</span> README.md{" "}
              <span className="tab-close" aria-hidden="true">
                ×
              </span>
            </Link>
          </nav>
          <div className="editor-scroll">
            <Outlet />
          </div>
        </div>
      </div>

      <footer className="global-status">
        <div>
          <span className="status-branch">⑂ main</span>
          <span>◈ webwm</span>
          <span>layout ready</span>
        </div>
        <div>
          <span>TypeScript</span>
          <span>UTF-8</span>
          <span>React + TanStack Router</span>
        </div>
      </footer>
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
