/**
 * Rasterises the brand mark into every icon the browser and the manifest ask
 * for. Chromium is already a dev dependency through Playwright, so the set is
 * reproducible without adding an image library.
 *
 * Run with `pnpm brand:assets`. The generated files are committed: the manifest
 * needs stable URLs, and CI should not have to launch a browser to build.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..");
const MARK_PATH = join(ROOT, "public/brand/mark.svg");
const PAPER = "#fbfbfa";

/** The mark's contents without its outer `<svg>` element, so a wrapper can own it. */
function markContents(mark) {
  return mark
    .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim();
}

function plainSvg(contents, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">${contents}</svg>`;
}

/** The mark on an opaque tile, scaled down so the artwork keeps a safe margin. */
function tileSvg(contents, size, scale, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="${radius}" fill="${PAPER}" />
    <g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${contents}</g>
  </svg>`;
}

async function renderPng(browser, svg, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`,
  );
  const png = await page.screenshot({
    omitBackground: true,
    type: "png",
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  return png;
}

/** Packs PNG payloads into a multi-resolution `.ico` (PNG-in-ICO, Vista and later). */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

async function main() {
  const mark = await readFile(MARK_PATH, "utf8");
  const contents = markContents(mark);
  if (!contents) {
    throw new Error(`Could not read the mark geometry from ${MARK_PATH}`);
  }

  await mkdir(join(ROOT, "public/brand/icons"), { recursive: true });
  await mkdir(join(ROOT, "public/brand/screenshots"), { recursive: true });

  const browser = await chromium.launch();
  try {
    const faviconSizes = [16, 32, 48];
    const faviconImages = [];
    for (const size of faviconSizes) {
      const png = await renderPng(browser, plainSvg(contents, size), size);
      faviconImages.push({ size, png });
    }

    await writeFile(join(ROOT, "app/favicon.ico"), packIco(faviconImages));
    await writeFile(join(ROOT, "app/icon.svg"), `${mark.trim()}\n`);

    // iOS applies its own mask, so the touch icon gets an edge-to-edge tile.
    const apple = await renderPng(browser, tileSvg(contents, 180, 0.78, 0), 180);
    await writeFile(join(ROOT, "app/apple-icon.png"), apple);

    for (const size of [192, 512]) {
      const png = await renderPng(browser, tileSvg(contents, size, 0.86, 7), size);
      await writeFile(join(ROOT, `public/brand/icons/icon-${size}.png`), png);
    }

    const maskable = await renderPng(browser, tileSvg(contents, 512, 0.58, 7), 512);
    await writeFile(join(ROOT, "public/brand/icons/icon-maskable-512.png"), maskable);

    console.log(
      `[brand] wrote favicon.ico (${faviconSizes.join(", ")}), app/icon.svg, app/apple-icon.png and the manifest icon set`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[brand] asset generation failed:", error);
  process.exitCode = 1;
});
