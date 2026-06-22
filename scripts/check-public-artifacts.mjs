import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const publicRoot = join(process.cwd(), "dist", "client");

const forbiddenExact = new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json"]);
const forbiddenDirectories = new Set(["legacy-prototype", ".git"]);
const forbiddenExtensions = [".log", ".env"];

function walk(dir) {
  const findings = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const rel = relative(publicRoot, fullPath);
    const segments = rel.split(sep);

    if (segments.some((segment) => forbiddenDirectories.has(segment))) {
      findings.push(rel);
      continue;
    }

    if (entry.isDirectory()) {
      findings.push(...walk(fullPath));
      continue;
    }

    if (
      forbiddenExact.has(entry.name) ||
      forbiddenExtensions.some((ext) => entry.name.endsWith(ext))
    ) {
      findings.push(rel);
    }
  }
  return findings;
}

if (!existsSync(publicRoot)) {
  console.log("dist/client not found; skipping public artifact security check.");
  process.exit(0);
}

const findings = walk(publicRoot);

// Scan non-admin public client JS chunks for forbidden Supabase/Auth/PostgREST markers
const astroDir = join(publicRoot, "_astro");
if (existsSync(astroDir)) {
  const forbiddenClientMarkers = ["supabase", "PostgREST", "GoTrue", "@supabase", "createClient"];
  for (const entry of readdirSync(astroDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.includes("admin")) {
      const fullPath = join(astroDir, entry.name);
      const content = readFileSync(fullPath, "utf8");
      const found = forbiddenClientMarkers.filter((marker) => content.includes(marker));
      if (found.length > 0) {
        console.error(
          `Security violation: Public chunk '${entry.name}' contains forbidden markers: ${found.join(", ")}`
        );
        findings.push(relative(publicRoot, fullPath));
      }
    }
  }
}

if (findings.length) {
  console.error("Forbidden public artifacts found:");
  findings.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Public artifact security check passed.");
