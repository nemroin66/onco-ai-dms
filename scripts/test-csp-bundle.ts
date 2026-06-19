import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const assetsDirectory = path.resolve("dist/assets");
const dashboardChunks = (await readdir(assetsDirectory))
  .filter((file) => /^DashboardView-.*\.js$/.test(file));

assert.ok(dashboardChunks.length > 0, "No built DashboardView chunk found. Run Vite before this test.");

const unsafePatterns = [
  { name: "eval()", pattern: /\beval\s*\(/ },
  { name: "new Function()", pattern: /\bnew\s+Function\s*\(/ },
  {
    name: "indirect Function constructor",
    pattern: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Function\s*;[\s\S]{0,160}?\bnew\s+\1\s*\(/,
  },
];

for (const file of dashboardChunks) {
  const source = await readFile(path.join(assetsDirectory, file), "utf8");
  for (const unsafe of unsafePatterns) {
    assert.doesNotMatch(source, unsafe.pattern, `${file} contains CSP-unsafe ${unsafe.name}`);
  }
}

console.log(`CSP bundle test passed (${dashboardChunks.length} dashboard chunk checked)`);
