import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "property-photos";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const execute = process.argv.includes("--execute");

function loadDotenv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional; environment variables can be supplied by the shell.
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or set it in the shell.`);
  }
  return value;
}

async function listObjects(storage, prefix = "") {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await storage.list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = !item.id && !item.metadata;
      if (isFolder) {
        paths.push(...(await listObjects(storage, path)));
      } else {
        paths.push(path);
      }
    }

    if (data.length < limit) break;
    offset += data.length;
  }

  return paths;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

loadDotenv();

const supabaseUrl = requiredEnv("PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: photos, error: photosError } = await supabase
  .from("property_photos")
  .select("storage_path, thumb_path, card_path, full_path");

if (photosError) throw photosError;

const referencedPaths = new Set();
for (const photo of photos || []) {
  for (const path of [photo.storage_path, photo.thumb_path, photo.card_path, photo.full_path]) {
    if (path) referencedPaths.add(path);
  }
}

const storage = supabase.storage.from(BUCKET);
const allPaths = await listObjects(storage);
const orphanPaths = allPaths.filter((path) => {
  const propertyId = path.split("/")[0];
  return UUID_RE.test(propertyId) && !referencedPaths.has(path);
});

console.log(`Bucket: ${BUCKET}`);
console.log(`Referenced photo paths: ${referencedPaths.size}`);
console.log(`Storage object paths: ${allPaths.length}`);
console.log(`Orphan object paths: ${orphanPaths.length}`);

for (const path of orphanPaths.slice(0, 30)) console.log(`- ${path}`);
if (orphanPaths.length > 30) console.log(`...and ${orphanPaths.length - 30} more`);

if (!execute) {
  console.log("\nDry run only. Re-run with --execute to delete these orphan objects.");
  process.exit(0);
}

for (const batch of chunk(orphanPaths, 100)) {
  const { error } = await storage.remove(batch);
  if (error) throw error;
}

console.log(`Deleted ${orphanPaths.length} orphan object(s).`);
