// Gera versões otimizadas das imagens pesadas do site público.
// - hero-bg / cta-bg: WebP (mantém o .jpg como fallback no CSS via image-set)
// - favicon-64.png: ícone leve a partir do logo (o logo grande continua para o header/footer)
//
// Uso: node scripts/optimize-images.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";

const imgDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "img");

async function size(file) {
  try {
    return ((await stat(join(imgDir, file))).size / 1024).toFixed(0) + " KB";
  } catch {
    return "—";
  }
}

async function toWebp(source, target, { width } = {}) {
  let pipeline = sharp(join(imgDir, source));
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  await pipeline.webp({ quality: 72, effort: 6 }).toFile(join(imgDir, target));
  console.log(`${source} (${await size(source)}) -> ${target} (${await size(target)})`);
}

async function optimizeVariant(source, name, width, format) {
  const target = `${name}-${width}.${format}`;
  let pipeline = sharp(join(imgDir, source));
  pipeline = pipeline.resize({ width, withoutEnlargement: true });
  if (format === "webp") {
    pipeline = pipeline.webp({ quality: 72, effort: 6 });
  } else if (format === "avif") {
    pipeline = pipeline.avif({ quality: 65, effort: 4 });
  }
  await pipeline.toFile(join(imgDir, target));
  console.log(`${source} (${await size(source)}) -> ${target} (${await size(target)})`);
}

async function favicon() {
  await sharp(join(imgDir, "logo-nova-sem-fundo.png"))
    .resize({ width: 64, height: 64, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(imgDir, "favicon-64.png"));
  console.log(
    `logo-nova-sem-fundo.png (${await size("logo-nova-sem-fundo.png")}) -> favicon-64.png (${await size("favicon-64.png")})`
  );
}

await toWebp("hero-bg.jpg", "hero-bg.webp", { width: 1920 });
await toWebp("cta-bg.jpg", "cta-bg.webp", { width: 1920 });

const widths = [640, 960, 1280, 1600];
const formats = ["webp", "avif"];

for (const name of ["hero-bg", "cta-bg"]) {
  for (const width of widths) {
    for (const format of formats) {
      await optimizeVariant(`${name}.jpg`, name, width, format);
    }
  }
}

await favicon();
console.log("Pronto.");
