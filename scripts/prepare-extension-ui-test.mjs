// This harness is never included in extension releases. It runs the real panel
// with fake Chrome APIs and synthetic values on localhost, without Fidelity.
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build/extension-ui-test");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "build/extension/extension"), path.join(output, "extension"), { recursive: true });
await cp(path.join(root, "build/extension/src"), path.join(output, "src"), { recursive: true });
let html = await readFile(path.join(root, "extension/sidepanel.html"), "utf8");
html = html.replace('src="panel.js"', 'src="harness.js"').replace("<main>", '<main><p>TEST MODE · synthetic data · no provider access</p><button id="test-navigation" type="button">Simulate navigation</button>');
await writeFile(path.join(output, "extension/index.html"), html);
await writeFile(path.join(output, "extension/harness.js"), `
const sourceUrl = "https://workplaceservices.fidelity.com/mybenefits/dcnav/pages/contributions#/landing";
let granted = false;
let onUpdated = () => {};
globalThis.chrome = {
  permissions: {
    request: async () => { granted = true; return true; },
    remove: async () => { granted = false; return true; },
    contains: async () => granted,
  },
  alarms: { create: async () => {} },
  tabs: {
    query: async () => [{ id: 1, url: sourceUrl }],
    onUpdated: { addListener: (fn) => { onUpdated = fn; } },
    onActivated: { addListener: () => {} },
  },
  scripting: { executeScript: async () => [{ frameId: 0, result: {
    url: sourceUrl, text: "Contribution rate: 6%\\nEmployee YTD contributions: $12,000.00",
  } }] },
};
document.getElementById("test-navigation").addEventListener("click", () => onUpdated());
await import("./panel.js");
`);
console.log("Synthetic UI harness prepared at build/extension-ui-test/extension/index.html");
