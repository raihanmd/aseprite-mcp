import { resolve, relative, dirname, isAbsolute } from "node:path";

// Offline checks for the documentation bundle; no downloads or editor changes.
const root = resolve(import.meta.dir, "..");
const manifest = await Bun.file(resolve(root, "docs/sources/manifest.json")).json();
const failures: string[] = [];
const seenPaths = new Set<string>();
let checkedSources = 0;

for (const entry of manifest.entries) {
  if (seenPaths.has(entry.upstreamPath)) failures.push(`Duplicate source: ${entry.upstreamPath}`);
  seenPaths.add(entry.upstreamPath);
  if (entry.status !== "captured") {
    if (entry.localPath !== null) failures.push(`Uncaptured source has a local path: ${entry.upstreamPath}`);
    continue;
  }
  if (typeof entry.localPath !== "string") {
    failures.push(`Missing local path: ${entry.upstreamPath}`);
    continue;
  }
  const target = resolve(root, entry.localPath);
  const local = relative(resolve(root, "docs/sources/aseprite-api"), target);
  if (local.startsWith("..") || isAbsolute(local)) {
    failures.push(`Source path escapes snapshot directory: ${entry.localPath}`);
    continue;
  }
  const file = Bun.file(target);
  if (!(await file.exists())) {
    failures.push(`Missing source file: ${entry.localPath}`);
    continue;
  }
  const content = await file.text();
  if (content.trim().length === 0) failures.push(`Empty source: ${entry.localPath}`);
  if (/Failed to fetch|Cache miss|Search code, repositories|cite/.test(content)) {
    failures.push(`Retrieval artifacts in source: ${entry.localPath}`);
  }
  const lineCount = content.replace(/\n$/, "").split("\n").length;
  if (lineCount !== entry.reportedLines) failures.push(`Line count mismatch: ${entry.localPath}`);
  const digest = new Bun.CryptoHasher("sha256").update(content).digest("hex");
  if (entry.sha256 !== digest) failures.push(`SHA-256 mismatch: ${entry.localPath}`);
  checkedSources++;
}

const license = await Bun.file(resolve(root, manifest.licensePath)).text();
if (!license.includes("Permission is hereby granted") || !license.includes("Copyright")) {
  failures.push("Missing source documentation license notice");
}

let checkedDocs = 0;
async function checkLinks(path: string) {
  const content = await Bun.file(path).text();
  for (const match of content.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1]!.replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link)) continue;
    const location = link.split("#")[0]!;
    if (!location) continue;
    const target = resolve(dirname(path), decodeURIComponent(location));
    if (!(await Bun.file(target).exists())) failures.push(`Broken link in ${relative(root, path)}: ${link}`);
  }
  checkedDocs++;
}
for (const filename of ["README.md", "CONTRIBUTING.md", "ROADMAP.md", "CHANGELOG.md", "AGENTS.md"]) {
  await checkLinks(resolve(root, filename));
}
for (const directory of ['docs','skills']) {
for await (const path of new Bun.Glob("**/*.md").scan({ cwd: resolve(root, directory), absolute: true })) {
  if (path.includes("/sources/aseprite-api/")) continue;
  await checkLinks(path);
}
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${checkedSources} source files and links in ${checkedDocs} authored documents.`);
  console.log("Aseprite runtime behavior has not been tested by this check.");
}
