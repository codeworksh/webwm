import { expect, type Locator, type Page } from "@playwright/test";

export async function dragPointer(page: Page, from: Locator, to: Locator, yFraction = 0.75) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error("Drag source or target has no browser rectangle");

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height * yFraction, { steps: 8 });
}

export async function expectDisjoint(rectangles: Locator) {
  // The imperative DOM renderer commits all style writes in the next rAF.
  await expect
    .poll(async () => {
      const boxes = await rectangles.evaluateAll((nodes) =>
        nodes
          .filter((node) => !(node as HTMLElement).hidden)
          .map((node) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          }),
      );

      for (let left = 0; left < boxes.length; left++) {
        if (boxes[left].width <= 0 || boxes[left].height <= 0) return false;
        for (let right = left + 1; right < boxes.length; right++) {
          const a = boxes[left];
          const b = boxes[right];
          const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapWidth > 1 && overlapHeight > 1) return false;
        }
      }
      return true;
    })
    .toBe(true);
}
