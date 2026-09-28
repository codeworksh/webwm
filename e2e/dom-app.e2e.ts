import { expect, test } from "@playwright/test";
import { dragPointer, expectDisjoint } from "./layout-helpers.ts";

test("vanilla DOM app applies tags, layouts, and Max/Restore", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5183/");

  await expect(page.locator("#layout-mode")).toHaveText("preferred");
  await expect(page.locator('[data-widget-id="editor"]')).toBeVisible();
  await expect(page.locator('[data-widget-id="music"]')).toBeHidden();
  await expectDisjoint(page.locator("[data-widget-id]"));

  await page.getByRole("button", { name: "Media" }).click();
  await expect(page.locator('[data-widget-id="music"]')).toBeVisible();
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator("#layout-name")).toHaveText("grid");
  await expectDisjoint(page.locator("[data-widget-id]"));

  await page.getByRole("button", { name: "Maximize music" }).click();
  await expect(page.locator("#layout-name")).toHaveText("monocle");
  await expect(page.locator('[data-widget-id="music"]')).toBeVisible();
  await expect(page.locator('[data-widget-id="editor"]')).toBeHidden();
  await page.getByRole("button", { name: "Restore music" }).click();
  await expect(page.locator("#layout-name")).toHaveText("grid");
  expect(errors).toEqual([]);
});

test("vanilla DOM handle, pin, reorder, and minimum-safe divider work", async ({ page }) => {
  await page.goto("http://127.0.0.1:5183/");
  await expect(page.locator('[data-widget-id="editor"]')).toBeVisible();
  const editor = page.locator('[data-widget-id="editor"]');
  const terminal = page.locator('[data-widget-id="terminal"]');
  const editorHandle = editor.locator("[data-drag-handle]");
  const beforeEditorY = (await editor.boundingBox())?.y ?? 0;
  const beforeTerminalY = (await terminal.boundingBox())?.y ?? 0;
  expect(beforeEditorY).toBeLessThan(beforeTerminalY);

  await page.getByRole("button", { name: "Pin editor" }).click();
  await dragPointer(page, editorHandle, terminal);
  await expect(page.locator("#drop-indicator")).toBeHidden();
  await page.mouse.up();
  await page.getByRole("button", { name: "Pin editor" }).click();
  await dragPointer(page, editorHandle, terminal);
  await expect(page.locator("#drop-indicator")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => (await editor.boundingBox())?.y ?? 0)
    .toBeGreaterThan((await terminal.boundingBox())?.y ?? 0);
  await expectDisjoint(page.locator("[data-widget-id]"));

  const divider = page.getByRole("separator", { name: "Resize master column" });
  await expect(divider).toBeVisible();
  const box = await divider.boundingBox();
  if (!box) throw new Error("Divider has no rectangle");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 1000, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await editor.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(420);
  await expectDisjoint(page.locator("[data-widget-id]"));
});

test("vanilla DOM Grid edge insertion and narrow view stay disjoint", async ({ page }) => {
  await page.goto("http://127.0.0.1:5183/");
  await expect(page.locator('[data-widget-id="editor"]')).toBeVisible();
  await page.getByRole("button", { name: "Media" }).click();
  await page.getByRole("button", { name: "Grid" }).click();
  const music = page.locator('[data-widget-id="music"] [data-drag-handle]');
  const editor = page.locator('[data-widget-id="editor"]');
  await expect
    .poll(async () => (await page.locator('[data-widget-id="music"]').boundingBox())?.y ?? 0)
    .toBeGreaterThan((await editor.boundingBox())?.y ?? 0);
  const source = await music.boundingBox();
  const target = await editor.boundingBox();
  if (!source || !target) throw new Error("Grid drag has no browser rectangle");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 4, target.y + target.height / 2, { steps: 8 });
  await expect(page.locator("#drop-indicator")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => {
      const musicBox = await page.locator('[data-widget-id="music"]').boundingBox();
      const editorBox = await editor.boundingBox();
      return Boolean(
        musicBox && editorBox && musicBox.x < editorBox.x && Math.abs(musicBox.y - editorBox.y) < 1,
      );
    })
    .toBe(true);
  await expectDisjoint(page.locator("[data-widget-id]"));

  await page.setViewportSize({ width: 520, height: 700 });
  await expectDisjoint(page.locator("[data-widget-id]"));
  await expect(page.locator("#master-divider")).toBeHidden();
});
