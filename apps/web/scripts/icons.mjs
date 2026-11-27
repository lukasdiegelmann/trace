// Renders the PWA icons from public/favicon.svg (needs rsvg-convert, from
// librsvg). Run `pnpm --filter web icons` after changing the SVG; the PNGs are
// committed.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
const svg = readFileSync(`${pub}favicon.svg`, "utf8");
mkdirSync(`${pub}icons`, { recursive: true });

function render(source, size, out) {
  const png = execFileSync(
    "rsvg-convert",
    ["-w", String(size), "-h", String(size)],
    {
      input: source,
    },
  );
  writeFileSync(`${pub}icons/${out}`, png);
}

render(svg, 192, "pwa-192x192.png");
render(svg, 512, "pwa-512x512.png");
render(svg, 180, "apple-touch-icon-180x180.png");

// Maskable: full-bleed background, the mark inside the 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#171717"/>
  <g transform="translate(76.8 76.8) scale(0.7)">
    <path d="M136 152h240v56h-92v200h-56V208h-92z" fill="#ffd100"/>
  </g>
</svg>`;
render(maskable, 512, "maskable-512x512.png");
