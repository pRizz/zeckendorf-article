import * as fs from "node:fs/promises";
import * as path from "node:path";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
function slugify(filename) {
    // euler.tex -> euler
    return filename.replace(/\.[^.]+$/, "");
}
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
async function listTexFiles(dir) {
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
        packages: [
            'base',
            'ams',
            'autoload',
            'require',
            'newcommand',
            'configmacros',
            'tagformat',
            'textmacros',
            'unicode',
            'color',
            'colortbl',
            'mathtools',
            'physics',
            'mhchem',
        ],
        // You can add macros here if you want deterministic shorthand:
        // macros: { RR: "\\mathbb{R}" }
    });
    const svg = new SVG({
        fontCache: "none", // "none" => each SVG is self-contained (often best for Medium)
    });
    const html = mathjax.document("", { InputJax: tex, OutputJax: svg });
    return { adaptor, html };
}
function wrapSvg(svgInner) {
    // MathJax returns a full <svg ...>...</svg> string already.
    // This helper is here if you want post-processing later.
    return svgInner.trim() + "\n";
}
async function renderOne(html, adaptor, latex, display) {
    const node = html.convert(latex, { display });
    // Get the full HTML with mjx-container
    const fullHtml = adaptor.outerHTML(node);
    // Extract just the SVG element by finding the <svg> tag and its closing tag
    const svgMatch = fullHtml.match(/<svg[\s\S]*?<\/svg>/);
    if (!svgMatch) {
        throw new Error("No SVG element found in MathJax output");
    }
    const svgText = svgMatch[0];
    return wrapSvg(svgText);
}
async function main(cfg) {
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
        const svg = await renderOne(html, adaptor, latex, cfg.display);
        const base = slugify(file);
        const outPath = path.join(outDir, `${base}.svg`);
        await fs.writeFile(outPath, svg, "utf8");
        console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
    }
}
await main({
    equationsDir: "equations",
    outDir: "out",
    display: true
});
//# sourceMappingURL=render.js.map