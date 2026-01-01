# Zeckendorf Article

A TypeScript tool for rendering LaTeX equations to high-quality SVG and PNG images using MathJax. Designed for creating publication-ready mathematical equations with customizable styling, including white outlines for better visibility on dark backgrounds.

## Features

- **LaTeX to SVG/PNG**: Converts LaTeX equations to both SVG (vector) and PNG (raster) formats
- **High-Quality Rendering**: PNG output supports configurable scaling (default 10x) for crisp images
- **White Outlines**: Automatically adds white stroke outlines to equation paths for better readability on dark backgrounds
- **Customizable Margins**: Add padding around equations to prevent edge clipping
- **MathJax Integration**: Uses MathJax 4.x with TeX input and SVG output
- **Batch Processing**: Processes all `.tex` files in a directory automatically

## Installation

This project uses `pnpm` as the package manager. Make sure you have Node.js installed, then:

```bash
pnpm install
```

## Usage

### Build

Compile TypeScript to JavaScript:

```bash
pnpm run build
```

### Render Equations

Render all `.tex` files from the `equations` directory to the `out` directory:

```bash
pnpm run render
```

This will:
1. Read all `.tex` files from the `equations/` directory
2. Convert each LaTeX equation to SVG using MathJax
3. Add white outlines to the SVG paths
4. Apply margins (if configured)
5. Save both SVG and PNG versions to the `out/` directory

## Configuration

The rendering configuration is set in `src/render.ts` at the bottom of the file:

```typescript
await main({
  equationsDir: "equations",
  outDir: "out",
  display: true,        // true = display math, false = inline math
  pngScale: 10,         // Scale factor for PNG (10x = 720 DPI)
  margin: 20            // Margin in SVG units
});
```

### Configuration Options

- **`equationsDir`**: Directory containing `.tex` files (default: `"equations"`)
- **`outDir`**: Output directory for SVG and PNG files (default: `"out"`)
- **`display`**: `true` for display math (block equations), `false` for inline math
- **`pngScale`**: Scale factor for PNG rendering. Higher values = higher resolution (default: `10`)
- **`margin`**: Margin in SVG units to add around equations (default: `0`)

## Project Structure

```
zeckendorf-article/
├── equations/          # Input LaTeX files (.tex)
├── out/                # Output SVG and PNG files
├── src/
│   └── render.ts       # Main rendering script
├── package.json
├── tsconfig.json
└── LICENSE.txt         # MIT License
```

## Example Equations

The project includes example equations demonstrating:
- Binary number representation
- Zeckendorf representation (Fibonacci-based number system)
- Fibbinary representation
- Euler's identity

## Dependencies

- **@mathjax/src**: MathJax 4.x for LaTeX rendering
- **sharp**: High-performance image processing for PNG generation
- **@xmldom/xmldom**: XML parsing for SVG manipulation
- **tsx**: TypeScript execution
- **typescript**: TypeScript compiler

## Development

The project uses TypeScript with strict type checking. Source files are in `src/`, and compiled JavaScript is output to the same directory.

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

Copyright (c) 2026 Peter Ryszkiewicz

