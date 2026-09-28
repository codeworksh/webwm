import { createFileRoute } from "@tanstack/react-router";

function AboutPage() {
  return (
    <main className="about-page">
      <h2>About this example</h2>
      <p>
        This TanStack Router application consumes the same webwm package as a React app. Layout
        calculations stay in the pure core; React owns the widget content and renders placements.
      </p>
    </main>
  );
}

export const Route = createFileRoute("/about")({ component: AboutPage });
