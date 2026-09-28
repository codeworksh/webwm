import { expect, test } from "@playwright/test";
import { dragPointer, expectDisjoint } from "./layout-helpers.ts";

test("React app composes tags, layouts, Max/Restore, and routes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5184/");

  await expect(page.getByRole("heading", { name: "Widget workspace" })).toBeVisible();
  await expect(page.locator(".widget")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
  await expectDisjoint(page.locator(".widget"));

  await page.getByRole("button", { name: "Media" }).click();
  await expect(page.locator(".widget")).toHaveCount(4);
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator(".status-line")).toContainText("Layout: grid");
  await expectDisjoint(page.locator(".widget"));

  await page.getByRole("button", { name: "Work" }).click();
  await expect(page.locator(".widget")).toHaveCount(2);
  await page.getByRole("button", { name: "Maximize music" }).click();
  await expect(page.locator(".widget")).toHaveCount(1);
  await expect(page.locator(".status-line")).toContainText("Layout: monocle");
  await page.getByRole("button", { name: "Restore music" }).click();
  await expect(page.locator(".widget")).toHaveCount(2);
  await expect(page.locator(".status-line")).toContainText("Layout: grid");

  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading", { name: "About this example" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("React handle drag respects Pin and commits only on release", async ({ page }) => {
  await page.goto("http://127.0.0.1:5184/");
  const widgets = page.locator(".widget");
  const order = () =>
    widgets.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-widget-id")));
  await expect(widgets).toHaveCount(3);
  expect(await order()).toEqual(["editor", "terminal", "reference"]);

  await page.getByRole("button", { name: "Pin editor" }).click();
  await dragPointer(
    page,
    page.getByLabel("editor drag handle"),
    page.locator('[data-widget-id="terminal"]'),
  );
  await expect(page.locator(".insertion-indicator")).toHaveCount(0);
  await page.mouse.up();
  expect(await order()).toEqual(["editor", "terminal", "reference"]);

  await page.getByRole("button", { name: "Unpin editor" }).click();
  await dragPointer(
    page,
    page.getByLabel("editor drag handle"),
    page.locator('[data-widget-id="terminal"]'),
  );
  await expect(page.locator(".widget.is-dragging")).toHaveAttribute("data-widget-id", "editor");
  await expect(page.locator(".insertion-indicator")).toBeVisible();
  expect(await order()).toEqual(["editor", "terminal", "reference"]);
  await page.mouse.up();
  await expect(page.locator(".insertion-indicator")).toHaveCount(0);
  await expect.poll(order).toEqual(["terminal", "editor", "reference"]);
  await expectDisjoint(widgets);
});

test("React divider stops at widget minimums and hides at narrow width", async ({ page }) => {
  await page.goto("http://127.0.0.1:5184/");
  const divider = page.getByRole("separator", { name: "Master and stack divider" });
  await expect(divider).toBeVisible();
  const initialValue = Number(await divider.getAttribute("aria-valuenow"));
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => Number(await divider.getAttribute("aria-valuenow")))
    .toBeGreaterThan(initialValue);

  const box = await divider.boundingBox();
  if (!box) throw new Error("Divider has no rectangle");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 1000, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const editor = page.locator('[data-widget-id="editor"]');
  await expect
    .poll(async () => (await editor.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(390);
  await expectDisjoint(page.locator(".widget"));

  await page.setViewportSize({ width: 580, height: 760 });
  await expect(divider).toHaveCount(0);
  await expectDisjoint(page.locator(".widget"));
});

test("React Grid drag previews a vertical edge and reorders by row", async ({ page }) => {
  await page.goto("http://127.0.0.1:5184/");
  await page.getByRole("button", { name: "Media" }).click();
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator(".widget")).toHaveCount(4);

  const music = page.getByLabel("music drag handle");
  const editor = page.locator('[data-widget-id="editor"]');
  const source = await music.boundingBox();
  const target = await editor.boundingBox();
  if (!source || !target) throw new Error("Grid drag has no browser rectangle");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 4, target.y + target.height / 2, { steps: 8 });
  await expect(page.locator(".insertion-indicator.is-vertical")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .locator(".widget")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-widget-id"))),
    )
    .toEqual(["music", "editor", "terminal", "reference"]);
  await expectDisjoint(page.locator(".widget"));
});
