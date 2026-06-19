import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTrashHandlerRoute, parseApiRoute, requiresAdminRoute } from "../server-lib/api-routing.js";

const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const wildcardRewrite = vercelConfig.rewrites.find((rewrite: { source: string }) => rewrite.source === "/api/:apiPath(.*)");

assert.equal(wildcardRewrite?.destination, "/api?apiPath=:apiPath");
assert.ok(vercelConfig.functions["api/index.ts"]);
assert.equal(vercelConfig.functions["api/[...path].ts"], undefined);

assert.deepEqual(parseApiRoute("/api/patients/trash?unused=true"), {
  parts: ["patients", "trash"],
  route: "patients/trash",
});
assert.deepEqual(parseApiRoute("/api/patients/trash/clear"), {
  parts: ["patients", "trash", "clear"],
  route: "patients/trash/clear",
});
assert.equal(isTrashHandlerRoute("patients/trash"), true);
assert.equal(isTrashHandlerRoute("patients/trash/clear"), true);
assert.equal(requiresAdminRoute("patients/trash", ["patients", "trash"], "GET"), false);
assert.equal(requiresAdminRoute("patients/trash/clear", ["patients", "trash", "clear"], "POST"), true);
assert.equal(requiresAdminRoute("patients/abc/restore", ["patients", "abc", "restore"], "POST"), false);
assert.equal(requiresAdminRoute("patients/abc/permanent", ["patients", "abc", "permanent"], "DELETE"), true);

console.log("Vercel routing tests passed");
