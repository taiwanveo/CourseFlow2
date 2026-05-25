import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vendorThemes = join(__dirname, "..", "vendor", "web-video-presentation", "themes");
const outThemes = join(__dirname, "..", "dist", "themes");

if (existsSync(vendorThemes)) {
  cpSync(vendorThemes, outThemes, { recursive: true });
  console.log("Themes copied to dist/themes");
}

const baseCandidates = [
  join(__dirname, "..", "vendor", "web-video-presentation", "templates", "src", "styles", "base.css"),
  join(__dirname, "..", "..", "..", "skills", "web-video-presentation", "templates", "src", "styles", "base.css"),
];
for (const src of baseCandidates) {
  if (existsSync(src)) {
    writeFileSync(join(__dirname, "..", "dist", "theme-base.css"), readFileSync(src, "utf8"));
    console.log("theme-base.css copied to dist/");
    break;
  }
}

const fontCandidates = [
  join(__dirname, "..", "vendor", "web-video-presentation", "templates", "src", "styles", "fonts.css"),
  join(__dirname, "..", "..", "..", "skills", "web-video-presentation", "templates", "src", "styles", "fonts.css"),
];
for (const src of fontCandidates) {
  if (existsSync(src)) {
    writeFileSync(join(__dirname, "..", "dist", "theme-fonts.css"), readFileSync(src, "utf8"));
    console.log("theme-fonts.css copied to dist/");
    break;
  }
}
