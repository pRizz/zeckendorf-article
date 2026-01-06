import * as fs from "node:fs/promises";
import * as path from "node:path";
import sharp from "sharp";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
// @ts-ignore - Side-effect import for AMS configuration; module exists at runtime but TypeScript may not resolve it in all environments
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';

type RenderConfig = {
  equationsDir: string;
  outDir: string;
  display: boolean; // true -> display math, false -> inline math
  pngScale?: number; // Scale factor for PNG rendering (default: 1, e.g., 10 for 10x upscale)
  // Margin is needed because when the svg is rendered to png, the edges of the white outlines were being clipped.
  margin?: number; // Margin in SVG units (default: 0, e.g., 50 for 50 units of margin)
};

const BRIGHT_OUTLINE_STROKE_COLOR = "#ddd";
const BRIGHT_OUTLINE_STROKE_WIDTH = 45;

function slugify(filename: string): string {
  // euler.tex -> euler
  return filename.replace(/\.[^.]+$/, "");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function listTexFiles(dir: string): Promise<string[]> {
  const items = await fs.readdir(dir, { withFileTypes: true });
  return items
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".tex"))
    .map((d) => d.name)
    .sort();
}

function createMathJax() {
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);

  const tex = new TeX({
    packages: ["base", "ams"],
    // You can add macros here if you want deterministic shorthand:
    // macros: { RR: "\\mathbb{R}" }
  });

  const svg = new SVG({
    fontCache: "none", // "none" => each SVG is self-contained (often best for Medium)
  });

  const html = mathjax.document("", { InputJax: tex, OutputJax: svg });

  return { adaptor, html };
}

function wrapSvg(svgInner: string): string {
  // MathJax returns a full <svg ...>...</svg> string already.
  // This helper is here if you want post-processing later.
  return svgInner.trim() + "\n";
}

async function renderOne(
  html: ReturnType<typeof createMathJax>["html"],
  adaptor: ReturnType<typeof createMathJax>["adaptor"],
  latex: string,
  display: boolean
): Promise<string> {
  const node = html.convert(latex, { display });
  // Get the full HTML with mjx-container
  const fullHtml = adaptor.outerHTML(node);
  
  // Extract just the SVG element by finding the <svg> tag and its closing tag
  const svgMatch = fullHtml.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    throw new Error("No SVG element found in MathJax output");
  }
  
  const svgText = svgMatch[0];
  const svgWithOutline = addOutlineToMathJaxSvg(svgText, { stroke: BRIGHT_OUTLINE_STROKE_COLOR, strokeWidth: BRIGHT_OUTLINE_STROKE_WIDTH });
  return wrapSvg(svgWithOutline);
}

async function main(cfg: RenderConfig): Promise<void> {
  const equationsDir = path.resolve(cfg.equationsDir);
  const outDir = path.resolve(cfg.outDir);

  await ensureDir(outDir);

  const files = await listTexFiles(equationsDir);
  if (files.length === 0) {
    console.error(`No .tex files found in ${equationsDir}`);
    process.exitCode = 1;
    return;
  }

  const { adaptor, html } = createMathJax();

  for (const file of files) {
    const inPath = path.join(equationsDir, file);
    const latex = (await fs.readFile(inPath, "utf8")).trim();

    if (!latex) {
      console.warn(`Skipping empty file: ${file}`);
      continue;
    }

    let svg = await renderOne(html, adaptor, latex, cfg.display);

    // Add margin to SVG if specified
    const margin = cfg.margin ?? 0;
    if (margin > 0) {
      svg = addMarginToSvg(svg, margin);
    }

    const base = slugify(file);
    const svgPath = path.join(outDir, `${base}.svg`);
    await fs.writeFile(svgPath, svg, "utf8");
    console.log(`Wrote ${path.relative(process.cwd(), svgPath)}${margin > 0 ? ` (margin: ${margin})` : ""}`);

    // Also render PNG
    const pngPath = path.join(outDir, `${base}.png`);
    const scale = cfg.pngScale ?? 1;
    // Use density to control rasterization resolution (default is 72 DPI)
    // Scale of 10x means 720 DPI for sharp rendering
    const density = Math.round(72 * scale);
    
    // For PNG, we need to add padding using extend if margin is specified
    // Convert margin from SVG units to pixels at the given density
    // const marginPixels = margin > 0 ? Math.round(margin * (density / 72)) : 0;
    
    const sharpInstance = sharp(Buffer.from(svg), { density });
    // if (marginPixels > 0) {
    //   // Extend the image with transparent padding
    //   await sharpInstance
    //     .extend({
    //       top: marginPixels,
    //       bottom: marginPixels,
    //       left: marginPixels,
    //       right: marginPixels,
    //       background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
    //     })
    //     .png()
    //     .toFile(pngPath);
    // } else {
      await sharpInstance
        .png()
        .toFile(pngPath);
    // }
    console.log(`Wrote ${path.relative(process.cwd(), pngPath)} (scale: ${scale}x${margin > 0 ? `, margin: ${margin}` : ""})`);
  }
}

await main({
  equationsDir: "equations",
  outDir: "out",
  display: true,
  pngScale: 10, // 10x upscale for sharp PNG rendering
  margin: 20 // 50 SVG units of margin around the equation
});

type OutlineOpts = {
  stroke: string;        // e.g. "#fff"
  strokeWidth: number;   // e.g. 0.6
};

export function addOutlineToMathJaxSvg(svgText: string, opts: OutlineOpts): string {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");

  const paths = Array.from(doc.getElementsByTagName("path"));
  for (const p of paths) {
    // Only touch paths that are filled (MathJax glyphs typically have fill)
    // If you want to outline *everything*, remove this guard.
    const fill = p.getAttribute("fill");
    if (fill === "none") continue;

    p.setAttribute("stroke", opts.stroke);
    p.setAttribute("stroke-width", String(opts.strokeWidth));
    p.setAttribute("paint-order", "stroke fill");
    p.setAttribute("stroke-linejoin", "round");
  }

  return new XMLSerializer().serializeToString(doc);
}

function addMarginToSvg(svgText: string, margin: number): string {
  if (margin <= 0) return svgText;
  
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svgElement = doc.getElementsByTagName("svg")[0];
  if (!svgElement) return svgText;

  const viewBox = svgElement.getAttribute("viewBox");
  if (!viewBox) return svgText;

  const parts = viewBox.split(/\s+/).map(Number);
  if (parts.length !== 4) return svgText;
  
  const [x, y, width, height] = parts;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return svgText;
  }
  console.log(`x: ${x}, y: ${y}, width: ${width}, height: ${height}`);
  
  // Expand viewBox by margin on all sides
  const newX = x - margin;
  const newY = y - margin;
  const newWidth = width + 2 * margin;
  const newHeight = height + 2 * margin;

  console.log(`newX: ${newX}, newY: ${newY}, newWidth: ${newWidth}, newHeight: ${newHeight}`);

  svgElement.setAttribute("viewBox", `${newX} ${newY} ${newWidth} ${newHeight}`);

  // Also update width/height if they exist
  const widthAttr = svgElement.getAttribute("width");
  const heightAttr = svgElement.getAttribute("height");

  console.log(`widthAttr: ${widthAttr}, heightAttr: ${heightAttr}`);
  if (widthAttr && !widthAttr.includes("%")) {
    const widthValue = parseFloat(widthAttr);
    if (!isNaN(widthValue) && width > 0 && height > 0) {
      const aspectRatio = width / height;
      const newWidthValue = widthValue + 2 * margin * (widthValue / width);
      const newHeightValue = newWidthValue / aspectRatio;
      console.log(`newWidthValue: ${newWidthValue}, newHeightValue: ${newHeightValue}`);
      // The original width/height is in ex units, so we need to add the margin in ex units
      svgElement.setAttribute("width", String(newWidthValue + "ex"));
      if (heightAttr && !heightAttr.includes("%")) {
        svgElement.setAttribute("height", String(newHeightValue + "ex"));
      }
    }
  }

  return new XMLSerializer().serializeToString(doc);
}
